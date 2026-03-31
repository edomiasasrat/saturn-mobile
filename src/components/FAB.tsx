"use client";
import { Plus } from "lucide-react";

export default function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      position: "fixed", bottom: 90, right: 20, width: 52, height: 52,
      borderRadius: "50%", background: "var(--accent)", color: "var(--white)",
      border: "none", boxShadow: "0 4px 20px rgba(230,50,50,0.4)",
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40,
    }}>
      <Plus size={26} />
    </button>
  );
}
