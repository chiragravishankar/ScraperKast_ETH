'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileNavProps {
  docsUrl:   string;
  npmUrl:    string;
  githubUrl: string;
}

/**
 * Hamburger menu shown on mobile (< md breakpoint).
 * The desktop nav links are hidden via Tailwind's `hidden md:flex` in page.tsx
 * and this component is shown via `md:hidden`.
 */
export default function MobileNav({ docsUrl, npmUrl, githubUrl }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  // Close on resize to desktop width so we don't leave a stale open state
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) setOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll while menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const links = [
    { label: 'Docs',   href: docsUrl   },
    { label: 'npm',    href: npmUrl    },
    { label: 'GitHub', href: githubUrl },
  ];

  return (
    <div className="md:hidden">
      {/* Hamburger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
        className="flex flex-col justify-center gap-[5px] w-8 h-8 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark"
      >
        <motion.span
          animate={open ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          className="block h-0.5 w-full bg-gray-700 rounded origin-center"
        />
        <motion.span
          animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.15 }}
          className="block h-0.5 w-full bg-gray-700 rounded"
        />
        <motion.span
          animate={open ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          className="block h-0.5 w-full bg-gray-700 rounded origin-center"
        />
      </button>

      {/* Dropdown overlay */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 top-16 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setOpen(false)}
            />

            {/* Menu panel */}
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed top-16 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-lg px-5 py-4"
            >
              <nav className="flex flex-col gap-1">
                {links.map(({ label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="py-3 px-2 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:text-brand-dark transition-colors"
                  >
                    {label}
                  </a>
                ))}

                <div className="mt-2 pt-3 border-t border-gray-100">
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center gap-2 w-full bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-gray-700 transition-colors"
                  >
                    <GitHubIcon />
                    Star on GitHub
                  </a>
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
    </svg>
  );
}
