'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text:       string;
  label?:     string;
  className?: string;
}

export default function CopyButton({ text, label, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
        copied ? 'text-emerald-600' : 'text-slate-400 hover:text-brand-dark'
      } ${className}`}
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {label && <span>{copied ? 'Copied!' : label}</span>}
    </button>
  );
}
