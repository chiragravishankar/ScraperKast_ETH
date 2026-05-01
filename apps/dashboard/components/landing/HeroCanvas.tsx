'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Particle { x:number; y:number; size:number; color:string; dur:number; delay:number; }
interface Shape    { x:number; y:number; size:number; color:string; rot:number; dur:number; }

const COLORS = ['#FF9A76','#7BA7FF','#B794F6','#FFB3D9'];

export default function HeroCanvas() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shapes,    setShapes]    = useState<Shape[]>([]);

  useEffect(() => {
    setParticles(Array.from({ length: 120 }, () => ({
      x:     Math.random() * 100,
      y:     Math.random() * 100,
      size:  1 + Math.random() * 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      dur:   4 + Math.random() * 5,
      delay: Math.random() * 5,
    })));
    setShapes(Array.from({ length: 18 }, () => ({
      x:     Math.random() * 100,
      y:     Math.random() * 100,
      size:  50 + Math.random() * 120,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot:   Math.random() * 360,
      dur:   16 + Math.random() * 12,
    })));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* ── Gradient background ── */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse 60% 50% at 15% 25%, rgba(255,154,118,0.18) 0%, transparent 60%),
          radial-gradient(ellipse 55% 45% at 85% 75%, rgba(123,167,255,0.18) 0%, transparent 60%),
          radial-gradient(ellipse 40% 40% at 50% 50%, rgba(183,148,246,0.10) 0%, transparent 55%),
          linear-gradient(145deg, #FFF5F0 0%, #F5F7FF 45%, #F8F0FF 100%)
        `,
      }} />

      {/* ── Animated large orbs ── */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{ width: 700, height: 700, top: '-15%', left: '-10%',
          background: 'radial-gradient(circle, rgba(255,154,118,0.22) 0%, transparent 68%)' }}
        animate={{ x:[0,80,0], y:[0,40,0], scale:[1,1.15,1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{ width: 600, height: 600, bottom: '-10%', right: '-8%',
          background: 'radial-gradient(circle, rgba(123,167,255,0.22) 0%, transparent 68%)' }}
        animate={{ x:[0,-70,0], y:[0,-50,0], scale:[1,1.2,1] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }}
      />
      <motion.div
        className="absolute rounded-full blur-2xl"
        style={{ width: 400, height: 400, top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(circle, rgba(183,148,246,0.18) 0%, transparent 65%)' }}
        animate={{ scale:[1,1.4,1], rotate:[0,180,360] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
      />

      {/* ── Floating geometric shapes ── */}
      {shapes.map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-2xl"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            background: s.color,
            opacity: 0.07,
            rotate: s.rot,
          }}
          animate={{
            y:      [0, -28, 0],
            rotate: [s.rot, s.rot + 180, s.rot + 360],
            scale:  [1, 1.08, 1],
          }}
          transition={{ duration: s.dur, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
        />
      ))}

      {/* ── Particles ── */}
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
          animate={{ y:[0,-40,0], x:[0, (i%2===0?12:-12), 0], opacity:[0.25,0.65,0.25] }}
          transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
        />
      ))}

      {/* ── Subtle grid ── */}
      <div className="absolute inset-0 lp-grid-light opacity-60" />

      {/* ── Bottom vignette ── */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
           style={{ background: 'linear-gradient(to top, #FAFBFF 0%, transparent 100%)' }} />
    </div>
  );
}
