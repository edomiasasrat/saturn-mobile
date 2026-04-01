"use client";

import { useState } from "react";
import type { BankEntry } from "@/lib/types";
import { formatBirr, formatDate } from "@/lib/format";
import BottomSheet from "@/components/BottomSheet";
import FAB from "@/components/FAB";
import { useData } from "@/lib/DataProvider";

type EntryType = "deposit" | "withdrawal";

// ── Compact row ────────────────────────────────────────────────────────────────
function EntryRow({ entry }: { entry: BankEntry }) {
  const isDeposit = entry.type === "deposit";
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--surface-border)",
      borderRadius: "var(--radius)",
      padding: "12px 14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)", textTransform: "capitalize" }}>
          {entry.type}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
          {[entry.memo, formatDate(entry.created_at)].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isDeposit ? "var(--green)" : "var(--error)" }}>
          {isDeposit ? "+" : "-"}{formatBirr(entry.amount)}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
          Bal: {formatBirr(entry.balance_after)}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BankPage() {
  const { bankEntries, getBankBalance, addBankEntry, loading } = useData();

  const [sheetOpen, setSheetOpen] = useState(false);

  // form
  const [entryType, setEntryType] = useState<EntryType>("deposit");
  const [amount, setAmount]       = useState("");
  const [memo, setMemo]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const balance = getBankBalance();

  // Sort entries newest first for display
  const entries = [...bankEntries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const openSheet = () => {
    setEntryType("deposit");
    setAmount("");
    setMemo("");
    setError(null);
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setError("Enter a valid amount."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await addBankEntry({ type: entryType, amount: parsed, memo: memo.trim() || null });
      setSheetOpen(false);
    } catch { setError("Something went wrong. Try again."); }
    finally  { setSubmitting(false); }
  };

  // ── shared styles ────────────────────────────────────────────────
  const input: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "var(--bg)", border: "1px solid var(--surface-border)",
    borderRadius: 8, padding: "10px 12px",
    color: "var(--white)", fontSize: 16, outline: "none",
  };
  const label: React.CSSProperties = {
    display: "block", fontSize: 13, fontWeight: 600,
    color: "var(--muted)", marginBottom: 6,
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: 96 }}>

      {/* ── Sticky header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--surface)", borderBottom: "1px solid var(--surface-border)", padding: "20px 20px 16px" }}>
        <h1 style={{ color: "var(--white)", fontSize: 22, fontWeight: 800, margin: "0 0 14px", letterSpacing: "-0.01em" }}>
          Bank
        </h1>
        <div style={{ background: "var(--bg)", border: "1px solid var(--surface-border)", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
            Current Balance
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: loading ? "var(--muted)" : "var(--white)", letterSpacing: "-0.02em" }}>
            {loading ? "\u2014" : formatBirr(balance)}
          </div>
        </div>
      </div>

      {/* ── Entry list ── */}
      <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "48px 0", fontSize: 15 }}>Loading...</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "64px 0", fontSize: 15 }}>No bank entries yet</div>
        ) : (
          entries.map((e) => <EntryRow key={e.id} entry={e} />)
        )}
      </div>

      <FAB onClick={openSheet} />

      {/* ── Bottom Sheet ── */}
      <BottomSheet open={sheetOpen} onClose={() => !submitting && setSheetOpen(false)} title="Add Bank Entry">

        {/* Toggle */}
        <div style={{ display: "flex", border: "1px solid var(--surface-border)", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
          {(["deposit", "withdrawal"] as EntryType[]).map((t) => (
            <button key={t} onClick={() => setEntryType(t)} style={{
              flex: 1, padding: "11px 0", border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600, textTransform: "capitalize",
              background: entryType === t ? "var(--accent)" : "var(--surface)",
              color: entryType === t ? "var(--white)" : "var(--muted)",
              transition: "background 0.15s, color 0.15s",
            }}>
              {t === "deposit" ? "Deposit" : "Withdrawal"}
            </button>
          ))}
        </div>

        {/* Amount */}
        <label style={label}>Amount *</label>
        <input type="number" inputMode="decimal" placeholder="0.00"
          value={amount} onChange={(e) => setAmount(e.target.value)}
          style={{ ...input, marginBottom: 16 }} />

        {/* Memo */}
        <label style={label}>Memo</label>
        <textarea placeholder="Optional note..." value={memo}
          onChange={(e) => setMemo(e.target.value)} rows={3}
          style={{ ...input, resize: "none", marginBottom: 20, fontFamily: "inherit" }} />

        {/* Error */}
        {error && (
          <div style={{
            color: "var(--error)", fontSize: 13, marginBottom: 12,
            padding: "8px 12px", borderRadius: 8,
            background: "color-mix(in srgb, var(--error) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting} style={{
          width: "100%", padding: 14, borderRadius: 12, border: "none",
          cursor: submitting ? "not-allowed" : "pointer",
          fontSize: 16, fontWeight: 700,
          color: "var(--white)",
          background: submitting ? "var(--surface)" : "var(--accent)",
          opacity: submitting ? 0.5 : 1,
          transition: "opacity 0.15s, background 0.2s",
        }}>
          {submitting ? "Saving..." : entryType === "deposit" ? "Add Deposit" : "Add Withdrawal"}
        </button>
      </BottomSheet>
    </div>
  );
}
