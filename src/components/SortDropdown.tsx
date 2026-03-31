"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronsUpDown, Check } from "lucide-react";

interface SortOption {
  key: string;
  label: string;
}

interface SortDropdownProps {
  options: SortOption[];
  value: string;
  onChange: (key: string) => void;
}

export default function SortDropdown({ options, value, onChange }: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = options.find((o) => o.key === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "6px 10px", borderRadius: 8,
        background: "var(--bg)", border: "1px solid var(--surface-border)",
        color: "var(--muted)", fontSize: 12, fontWeight: 600,
        cursor: "pointer", whiteSpace: "nowrap",
      }}>
        {current?.label || "Sort"} <ChevronsUpDown size={14} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: 4,
          background: "var(--surface)", border: "1px solid var(--surface-border)",
          borderRadius: 10, padding: 4, minWidth: 160, zIndex: 100,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {options.map((opt) => (
            <button key={opt.key} onClick={() => { onChange(opt.key); setOpen(false); }} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", padding: "8px 12px", border: "none", borderRadius: 6,
              background: value === opt.key ? "rgba(230,50,50,0.1)" : "transparent",
              color: value === opt.key ? "var(--accent)" : "var(--white)",
              fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left",
            }}>
              {opt.label}
              {value === opt.key && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
