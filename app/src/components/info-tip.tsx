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
        className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full text-[10px] font-semibold leading-none text-[var(--color-muted)] bg-white border border-[var(--color-border)] hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] hover:shadow-[0_2px_6px_rgba(0,102,204,0.3)] transition-all cursor-help select-none"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 pointer-events-none normal-case tracking-normal"
        >
          <span
            className="block rounded-xl px-4 py-3 text-left normal-case tracking-normal"
            style={{
              background: "linear-gradient(180deg, #1f1d1a 0%, #141311 100%)",
              color: "#F5F5F4",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15), 0 12px 32px rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span className="flex items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-[rgba(255,255,255,0.1)]">
              <span className="font-display text-[13px] font-semibold tracking-tight text-white">
                {entry.title}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-[rgba(255,255,255,0.35)]">
                Glossary
              </span>
            </span>
            <span className="block text-[12px] leading-relaxed text-[rgba(255,255,255,0.9)]">
              {entry.en}
            </span>
            {entry.bn && (
              <span className="block mt-2 pt-2 border-t border-[rgba(255,255,255,0.1)] text-[12px] leading-relaxed text-[rgba(255,255,255,0.75)] font-bengali">
                {entry.bn}
              </span>
            )}
          </span>
          <span
            className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 rotate-45"
            style={{
              marginTop: -4,
              background: "#141311",
              borderRight: "1px solid rgba(255,255,255,0.08)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          />
        </span>
      )}
    </span>
  );
}
