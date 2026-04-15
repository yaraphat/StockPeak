"use client";

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

interface StockResult {
  ticker: string;
  company_name: string;
  company_name_bn: string | null;
  category: string | null;
  sector: string | null;
}

interface Props {
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
}

export function StockSearch({ placeholder = "Search stocks...", autoFocus = false, compact = false }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StockResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open) return;
    debounceRef.current = setTimeout(() => fetchResults(q), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, open, fetchResults]);

  // Global "/" keyboard shortcut
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside to close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function selectResult(r: StockResult) {
    setOpen(false);
    setQ("");
    router.push(`/stocks/${r.ticker}`);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusIdx >= 0 && results[focusIdx]) selectResult(results[focusIdx]);
      else if (q.trim()) router.push(`/stocks/${q.trim().toUpperCase()}`);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className={`relative ${compact ? "w-full max-w-sm" : "w-full max-w-md"}`}>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)] pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setFocusIdx(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          className={`w-full pl-10 pr-12 ${compact ? "py-1.5 text-sm" : "py-2.5 text-sm"} bg-white border border-[var(--color-border)] rounded-lg outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 font-body placeholder:text-[var(--color-muted)]`}
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-muted)] bg-[var(--background)] border border-[var(--color-border)] rounded px-1.5 py-0.5 font-mono pointer-events-none hidden sm:inline-block">
          /
        </kbd>
      </div>

      {open && (q.length > 0 || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 max-h-80 overflow-y-auto">
          {loading && results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--color-muted)]">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--color-muted)]">
              No stocks found. Press Enter to try {q.trim().toUpperCase()} directly.
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.ticker}
                type="button"
                onClick={() => selectResult(r)}
                onMouseEnter={() => setFocusIdx(i)}
                className={`w-full text-left px-4 py-2.5 border-b border-[var(--color-border-subtle)] last:border-b-0 transition-colors ${
                  i === focusIdx ? "bg-[rgba(0,102,204,0.06)]" : "hover:bg-[var(--background)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-semibold text-sm text-[var(--color-primary)]">
                      {r.ticker}
                    </div>
                    {r.company_name && r.company_name.toUpperCase() !== r.ticker.toUpperCase() && (
                      <div className="text-xs text-[var(--color-muted)] truncate">
                        {r.company_name}
                      </div>
                    )}
                    {r.sector && (
                      <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                        {r.sector}
                      </div>
                    )}
                  </div>
                  {r.category && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${
                      r.category === "A"
                        ? "bg-[rgba(22,163,74,0.1)] text-[#16A34A]"
                        : r.category === "Z"
                        ? "bg-[rgba(220,38,38,0.1)] text-[#DC2626]"
                        : "bg-[var(--background)] text-[var(--color-muted)]"
                    }`}>
                      {r.category}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
