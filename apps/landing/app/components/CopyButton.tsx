'use client';

import { useState } from 'react';

interface CopyButtonProps {
  /** The text that gets written to the clipboard on click. */
  text: string;
  /** Label shown before the user copies. Default: "Copy" */
  label?: string;
  /** Label shown for 2 s after a successful copy. Default: "Copied!" */
  successLabel?: string;
  className?: string;
}

/**
 * A button that copies `text` to the clipboard and briefly shows a success
 * state. Fully self-contained — no external dependencies.
 *
 * Usage:
 *   <CopyButton text="npm install @scraperkast/middleware-express" />
 */
export default function CopyButton({
  text,
  label = 'Copy',
  successLabel = 'Copied!',
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. HTTP in some browsers) — fail silently
    }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? successLabel : `${label}: ${text}`}
      className={className}
    >
      {copied ? successLabel : label}
    </button>
  );
}
