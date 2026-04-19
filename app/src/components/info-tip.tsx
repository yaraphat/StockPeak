"use client";

import { useState, useRef, useEffect } from "react";
import { GLOSSARY } from "@/lib/glossary";

export function InfoTip({ term, className = "" }: { term: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const entry = GLOSSARY[term];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  if (!entry) return null;

  return (
    <span
      ref={ref}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`What is ${entry.title}?`}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-bold text-[var(--color-muted)] bg-[var(--background)] border border-[var(--color-border)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors cursor-help"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 pointer-events-none"
        >
          <span className="block bg-[#1a1a1a] text-white text-[11px] leading-snug rounded-lg px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
            <span className="block font-semibold mb-1 text-white">{entry.title}</span>
            <span className="block text-[rgba(255,255,255,0.85)]">{entry.en}</span>
            {entry.bn && (
              <span className="block mt-1 pt-1 border-t border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.75)] font-bengali">
                {entry.bn}
              </span>
            )}
          </span>
          <span
            className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 rotate-45 bg-[#1a1a1a]"
            style={{ marginTop: -4 }}
          />
        </span>
      )}
    </span>
  );
}
