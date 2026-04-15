"use client";

import { useState } from "react";
import type { BankEntry } from "@/lib/types";
import { formatBirr, formatDate } from "@/lib/format";
import BottomSheet from "@/components/BottomSheet";
import FAB from "@/components/FAB";
import { useData } from "@/lib/DataProvider";

type EntryType = "deposit" | "withdrawal";
type Currency = "birr" | "usd" | "usdt";

const currencySymbols: Record<Currency, string> = { birr: "ETB", usd: "USD", usdt: "USDT" };

function formatAmount(amount: number, currency: Currency): string {
  const sym = currencySymbols[currency];
  return `${sym} ${amount.toLocaleString()}`;
}

// ── Compact row ────────────────────────────────────────────────────────────────
function EntryRow({ entry }: { entry: BankEntry }) {
  const isDeposit = entry.type === "deposit";
  const curr = (entry.currency || "birr") as Currency;
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
          {[entry.bank_name, entry.memo, formatDate(entry.created_at)].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isDeposit ? "var(--green)" : "var(--error)" }}>
          {isDeposit ? "+" : "-"}{formatAmount(entry.amount, curr)}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
          Bal: {formatAmount(entry.balance_after, curr)}
        </div>
        {curr !== "birr" && (
          <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 2, textTransform: "uppercase", fontWeight: 600 }}>
            {currencySymbols[curr]}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BankPage() {
  const { bankEntries, getBankBalance, getAllBankBalances, addBankEntry, loading } = useData();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterCurrency, setFilterCurrency] = useState<Currency | "all">("all");

  // form
  const [entryType, setEntryType] = useState<EntryType>("deposit");
  const [amount, setAmount]       = useState("");
  const [memo, setMemo]           = useState("");
  const [bankName, setBankName]   = useState("");
  const [currency, setCurrency]   = useState<Currency>("birr");
  const [exchangeRate, setExchangeRate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const balances = getAllBankBalances();

  // Sort entries newest first for display, filter by currency
  const entries = [...bankEntries]
    .filter((e) => filterCurrency === "all" || (e.currency || "birr") === filterCurrency)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const openSheet = () => {
    setEntryType("deposit");
    setAmount("");
    setMemo("");
    setBankName("");
    setCurrency("birr");
    setExchangeRate("");
    setError(null);
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setError("Enter a valid amount."); return; }
    setError(null);
    setSubmitting(true);

    // Build memo: include exchange rate info for USD/USDT
    let finalMemo = memo.trim() || null;
    if (currency !== "birr" && exchangeRate && !isNaN(parseFloat(exchangeRate))) {
      const rate = parseFloat(exchangeRate);
      const birrValue = parsed * rate;
      const rateNote = `Rate: 1 ${currency.toUpperCase()} = ${rate} ETB → ${parsed} ${currency.toUpperCase()} = ETB ${birrValue.toLocaleString()}`;
      finalMemo = finalMemo ? `${finalMemo} | ${rateNote}` : rateNote;
    }

    try {
      await addBankEntry({
        type: entryType,
        amount: parsed,
        memo: finalMemo,
        bank_name: bankName.trim() || null,
        currency,
      });
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

        {/* Multi-currency balances */}
        <div style={{ display: "flex", gap: 8 }}>
          {([
            { key: "birr" as Currency, label: "ETB", bal: balances.birr },
            { key: "usd" as Currency, label: "USD", bal: balances.usd },
            { key: "usdt" as Currency, label: "USDT", bal: balances.usdt },
          ]).map((c) => (
            <div key={c.key} style={{
              flex: 1, background: "var(--bg)", border: "1px solid var(--surface-border)",
              borderRadius: 12, padding: "10px 12px", textAlign: "center",
            }}>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: loading ? "var(--muted)" : "var(--white)", letterSpacing: "-0.02em" }}>
                {loading ? "\u2014" : c.bal.toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {/* Currency filter */}
        <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
          {(["all", "birr", "usd", "usdt"] as const).map((c) => (
            <button key={c} onClick={() => setFilterCurrency(c)} style={{
              flex: 1, padding: "7px 0", border: filterCurrency === c ? "none" : "1px solid var(--surface-border)",
              borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              background: filterCurrency === c ? "var(--accent)" : "transparent",
              color: filterCurrency === c ? "var(--white)" : "var(--muted)",
              transition: "all 0.15s",
            }}>
              {c === "all" ? "All" : c === "birr" ? "ETB" : c.toUpperCase()}
            </button>
          ))}
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
        <div style={{ display: "flex", border: "1px solid var(--surface-border)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
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

        {/* Currency */}
        <label style={label}>Currency</label>
        <div style={{ display: "flex", border: "1px solid var(--surface-border)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
          {(["birr", "usd", "usdt"] as Currency[]).map((c) => (
            <button key={c} onClick={() => setCurrency(c)} style={{
              flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, textTransform: "uppercase",
              background: currency === c ? "var(--accent)" : "var(--surface)",
              color: currency === c ? "var(--white)" : "var(--muted)",
              transition: "background 0.15s, color 0.15s",
            }}>
              {c === "birr" ? "ETB" : c.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Bank Name */}
        <label style={label}>Bank Name</label>
        <input type="text" placeholder="e.g. CBE, Awash, Telebirr..."
          value={bankName} onChange={(e) => setBankName(e.target.value)}
          style={{ ...input, marginBottom: 16 }} />

        {/* Amount */}
        <label style={label}>Amount ({currency === "birr" ? "ETB" : currency.toUpperCase()}) *</label>
        <input type="number" inputMode="decimal" placeholder="0.00"
          value={amount} onChange={(e) => setAmount(e.target.value)}
          style={{ ...input, marginBottom: 16 }} />

        {/* Exchange Rate — only for USD/USDT */}
        {currency !== "birr" && (
          <>
            <label style={label}>Exchange Rate (1 {currency.toUpperCase()} = ? ETB)</label>
            <input type="number" inputMode="decimal" placeholder="e.g. 130"
              value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)}
              style={{ ...input, marginBottom: 8 }} />
            {amount && exchangeRate && !isNaN(parseFloat(amount)) && !isNaN(parseFloat(exchangeRate)) && (
              <div style={{
                padding: "10px 14px", marginBottom: 16, borderRadius: 10,
                background: "color-mix(in srgb, var(--accent) 10%, var(--bg))",
                border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                fontSize: 14, color: "var(--white)", fontWeight: 600, textAlign: "center",
              }}>
                {parseFloat(amount).toLocaleString()} {currency.toUpperCase()} × {parseFloat(exchangeRate).toLocaleString()} = <span style={{ color: "var(--green)", fontWeight: 700 }}>ETB {(parseFloat(amount) * parseFloat(exchangeRate)).toLocaleString()}</span>
              </div>
            )}
            {!(amount && exchangeRate && !isNaN(parseFloat(amount)) && !isNaN(parseFloat(exchangeRate))) && (
              <div style={{ marginBottom: 16 }} />
            )}
          </>
        )}

        {/* Memo */}
        <label style={label}>Memo</label>
        <textarea placeholder="Optional note..." value={memo}
          onChange={(e) => setMemo(e.target.value)} rows={2}
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
