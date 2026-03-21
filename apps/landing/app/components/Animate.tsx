'use client';

/**
 * Reusable framer-motion animation primitives.
 *
 * All components trigger their animation once when they enter the viewport
 * (once: true), so they don't re-animate on scroll-back.
 *
 * Import what you need:
 *   import { FadeIn, StaggerParent, StaggerChild } from './Animate';
 */

import { motion, type Variants } from 'framer-motion';

// ── Shared easing ─────────────────────────────────────────────────────────────

const EASE_OUT = [0.16, 1, 0.3, 1] as const;   // slightly springy ease-out
const VIEWPORT = { once: true, margin: '-72px' } as const;

// ── FadeIn ────────────────────────────────────────────────────────────────────

interface FadeInProps {
  children: React.ReactNode;
  /** Extra delay before the animation starts (seconds). Default: 0 */
  delay?: number;
  /** How far the element starts below its final position (px). Default: 20 */
  distance?: number;
  className?: string;
}

/**
 * Fades an element in and slides it up slightly when it scrolls into view.
 * Good for headings, paragraphs, and standalone elements.
 */
export function FadeIn({
  children,
  delay = 0,
  distance = 20,
  className,
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.55, ease: EASE_OUT, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Stagger group ─────────────────────────────────────────────────────────────

const staggerParentVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,   // 120 ms between each child — subtle, not distracting
      delayChildren: 0.05,
    },
  },
};

const staggerChildVariants: Variants = {
  hidden:  { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrap a list of `<StaggerChild>` elements with this to animate them in
 * sequentially when the group scrolls into view.
 *
 * @example
 * <StaggerParent className="grid grid-cols-3 gap-6">
 *   {items.map(item => <StaggerChild key={item.id}>{item.content}</StaggerChild>)}
 * </StaggerParent>
 */
export function StaggerParent({ children, className }: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={staggerParentVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Individual animated child inside a `<StaggerParent>`.
 * Inherits its animation timing from the parent stagger config.
 */
export function StaggerChild({ children, className }: StaggerProps) {
  return (
    <motion.div variants={staggerChildVariants} className={className}>
      {children}
    </motion.div>
  );
}

// ── HoverCard ────────────────────────────────────────────────────────────────

interface HoverCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Adds a subtle lift-and-shadow effect on hover.
 * Use this to wrap feature cards, pricing cards, etc.
 */
export function HoverCard({ children, className }: HoverCardProps) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 12px 32px -8px rgba(2,128,144,0.18)' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
