'use client';

import { useEffect } from 'react';
import CursorGlow        from './CursorGlow';
import LandingNav        from './LandingNav';
import HeroSection       from './HeroSection';
import ProblemSection    from './ProblemSection';
import HowItWorksSection from './HowItWorksSection';
import FeaturesSection   from './FeaturesSection';
import PricingSection    from './PricingSection';
import CtaSection        from './CtaSection';
import LandingFooter     from './LandingFooter';

export default function LandingPage() {
  /* ── Lenis smooth scroll ── */
  useEffect(() => {
    let lenis: InstanceType<typeof import('lenis')['default']> | null = null;
    let rafId: number;

    async function init() {
      const LenisClass = (await import('lenis')).default;
      lenis = new LenisClass({
        duration:        1.4,
        easing:          (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel:     true,
        wheelMultiplier: 1.0,
        touchMultiplier: 2,
      });
      const raf = (time: number) => { lenis?.raf(time); rafId = requestAnimationFrame(raf); };
      rafId = requestAnimationFrame(raf);
    }

    void init();
    return () => { cancelAnimationFrame(rafId); lenis?.destroy(); };
  }, []);

  return (
    <div className="landing-light">
      <CursorGlow />
      <LandingNav />
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <FeaturesSection />
      <PricingSection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}
