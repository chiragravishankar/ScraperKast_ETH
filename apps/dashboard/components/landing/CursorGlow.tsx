'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';

export default function CursorGlow() {
  const [visible, setVisible] = useState(false);
  const rawX = useMotionValue(-1000);
  const rawY = useMotionValue(-1000);
  const x = useSpring(rawX, { stiffness: 100, damping: 25 });
  const y = useSpring(rawY, { stiffness: 100, damping: 25 });
  const bg = useMotionTemplate`radial-gradient(600px at ${x}px ${y}px, rgba(255,154,118,0.07), transparent 80%)`;

  useEffect(() => {
    const onMove = (e: MouseEvent) => { rawX.set(e.clientX); rawY.set(e.clientY); if (!visible) setVisible(true); };
    const onLeave = () => setVisible(false);
    window.addEventListener('mousemove', onMove);
    document.body.addEventListener('mouseleave', onLeave);
    return () => { window.removeEventListener('mousemove', onMove); document.body.removeEventListener('mouseleave', onLeave); };
  }, [rawX, rawY, visible]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-30"
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.4 }}
      style={{ background: bg }}
    />
  );
}
