"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { X, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";

interface ViewStackItem {
  content: ReactNode;
  title: string;
}

interface ModalDrilldownProps<T extends { id: number | string }> {
  open: boolean;
  onClose: () => void;
  items: T[];
  currentIndex: number;
  onChangeIndex: (index: number) => void;
  renderContent: (item: T, pushView: (content: ReactNode, title: string) => void) => ReactNode;
}

export default function ModalDrilldown<T extends { id: number | string }>({ open, onClose, items, currentIndex, onChangeIndex, renderContent }: ModalDrilldownProps<T>) {
  const [viewStack, setViewStack] = useState<ViewStackItem[]>([]);

  useEffect(() => {
    setViewStack([]);
  }, [currentIndex, open]);

  const pushView = useCallback((content: ReactNode, title: string) => {
    setViewStack((prev) => [...prev, { content, title }]);
  }, []);

  const popView = useCallback(() => {
    setViewStack((prev) => prev.slice(0, -1));
  }, []);

  const goLeft = useCallback(() => {
    if (currentIndex > 0) onChangeIndex(currentIndex - 1);
  }, [currentIndex, onChangeIndex]);

  const goRight = useCallback(() => {
    if (currentIndex < items.length - 1) onChangeIndex(currentIndex + 1);
  }, [currentIndex, items.length, onChangeIndex]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || items.length === 0) return null;

  const currentItem = items[currentIndex];
  const inSubView = viewStack.length > 0;
  const topView = viewStack[viewStack.length - 1];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      />

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 205,
        width: "calc(100% - 32px)", maxWidth: 500, maxHeight: "85vh",
        background: "var(--surface)", border: "1px solid var(--surface-border)",
        borderRadius: 16, display: "flex", flexDirection: "column",
        animation: "modalIn 0.2s ease-out",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", borderBottom: "1px solid var(--surface-border)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {inSubView ? (
              <button onClick={popView} style={{
                background: "none", border: "none", color: "var(--accent)", cursor: "pointer",
                padding: 0, display: "flex", alignItems: "center",
              }}>
                <ArrowLeft size={18} />
              </button>
            ) : (
              /* Left arrow in header */
              <button onClick={goLeft} disabled={currentIndex === 0} style={{
                background: "none", border: "none", cursor: currentIndex === 0 ? "default" : "pointer",
                padding: 2, display: "flex", alignItems: "center",
                color: currentIndex === 0 ? "var(--surface-border)" : "var(--white)",
                opacity: currentIndex === 0 ? 0.3 : 1,
              }}>
                <ChevronLeft size={18} />
              </button>
            )}
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, minWidth: 60, textAlign: "center" }}>
              {inSubView ? topView.title : `${currentIndex + 1} / ${items.length}`}
            </span>
            {!inSubView && (
              /* Right arrow in header */
              <button onClick={goRight} disabled={currentIndex >= items.length - 1} style={{
                background: "none", border: "none", cursor: currentIndex >= items.length - 1 ? "default" : "pointer",
                padding: 2, display: "flex", alignItems: "center",
                color: currentIndex >= items.length - 1 ? "var(--surface-border)" : "var(--white)",
                opacity: currentIndex >= items.length - 1 ? 0.3 : 1,
              }}>
                <ChevronRight size={18} />
              </button>
            )}
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--muted)", cursor: "pointer",
            padding: 4, display: "flex", alignItems: "center",
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", padding: "16px", flex: 1 }}>
          {inSubView ? topView.content : renderContent(currentItem, pushView)}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
