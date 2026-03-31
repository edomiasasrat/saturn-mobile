"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import BottomSheet from "@/components/BottomSheet";
import FAB from "@/components/FAB";
import { formatBirr, formatDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";

type FilterType = "all" | "income" | "expense";
type TxType = "income" | "expense";
type TxCategory = Transaction["category"];

const CATEGORIES: { value: TxCategory; label: string }[] = [
  { value: "phone_sale", label: "Phone Sale" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

const SEEDS = [
  { type: "income",  amount: 18000, description: "Samsung Galaxy A54 sold",  memo: "Customer paid cash",           category: "phone_sale" },
  { type: "expense", amount: 8000,  description: "Monthly shop rent",        memo: "Paid to landlord Ato Kebede", category: "rent"       },
  { type: "income",  amount: 15000, description: "iPhone 13 sold",           memo: "Sold to regular customer",    category: "phone_sale" },
  { type: "expense", amount: 1500,  description: "Electricity bill",         memo: "March payment",               category: "utilities"  },
  { type: "expense", amount: 800,   description: "Bus fare to Merkato",      memo: "Picked up new stock",         category: "transport"  },
  { type: "income",  amount: 500,   description: "Screen protector install", memo: "Walk-in customer",            category: "other"      },
] as const;

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const seededRef = useRef(false);

  const [txType, setTxType] = useState<TxType>("income");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TxCategory>("other");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (skipSeed = false) => {
    setLoading(true);
    try {
      const params = filter !== "all" ? `?type=${filter}` : "";
      const res = await fetch(`/api/transactions${params}`);
      if (!res.ok) throw new Error();
      const data: Transaction[] = await res.json();

      if (!skipSeed && !seededRef.current && filter === "all" && data.length === 0) {
        seededRef.current = true;
        await Promise.all(
          SEEDS.map((tx) =>
            fetch("/api/transactions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(tx),
            })
          )
        );
        await fetchTransactions(true);
        return;
      }
      setTransactions(data);
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch {
      alert("Failed to delete. Please try again.");
    }
  };

  const resetForm = () => {
    setTxType("income"); setAmount(""); setDescription("");
    setCategory("other"); setMemo(""); setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) return setFormError("Enter a valid amount.");
    if (!description.trim()) return setFormError("Description is required.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: txType, amount: parsed, description: description.trim(), category, memo: memo.trim() || null }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error ?? "Failed to save"); }
      const newTx: Transaction = await res.json();
      if (filter === "all" || filter === txType) setTransactions((prev) => [newTx, ...prev]);
      setSheetOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid var(--surface-border)", borderRadius: 8, fontSize: 15, background: "var(--bg)", color: "var(--white)", boxSizing: "border-box", outline: "none" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", paddingBottom: 96 }}>

      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, padding: "20px 20px 0", background: "var(--surface)", borderBottom: "1px solid var(--surface-border)" }}>
        <h1 style={{ margin: "0 0 14px", fontSize: 24, fontWeight: 800, color: "var(--white)", letterSpacing: "-0.5px" }}>
          Transactions
        </h1>
        <div style={{ display: "flex", gap: 8, paddingBottom: 14 }}>
          {(["all", "income", "expense"] as FilterType[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 18px", borderRadius: 999, border: filter === f ? "none" : "1px solid var(--surface-border)", cursor: "pointer", fontSize: 14, fontWeight: 600, background: filter === f ? "var(--accent)" : "transparent", color: filter === f ? "var(--white)" : "var(--muted)" }}>
              {f === "all" ? "All" : f === "income" ? "Income" : "Expense"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "48px 0", fontSize: 15 }}>Loading...</p>
        ) : transactions.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "64px 0", fontSize: 15 }}>
            {filter === "all" ? "No transactions yet. Tap + to add one." : `No ${filter} transactions found.`}
          </p>
        ) : transactions.map((tx) => (
          <div key={tx.id} style={{ background: "var(--surface)", border: "1px solid var(--surface-border)", borderRadius: "var(--radius)", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                {tx.category.replace("_", " ")} · {formatDate(tx.created_at)}
              </div>
              {tx.memo && (
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, fontStyle: "italic" }}>{tx.memo}</div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: tx.type === "income" ? "var(--accent)" : "var(--error)" }}>
                {tx.type === "income" ? "+" : "-"}{formatBirr(tx.amount)}
              </span>
              <button onClick={() => handleDelete(tx.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex" }}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <FAB onClick={() => { resetForm(); setSheetOpen(true); }} />

      {/* Add Transaction Sheet */}
      <BottomSheet open={sheetOpen} onClose={() => { setSheetOpen(false); resetForm(); }} title="Add Transaction">
        <form onSubmit={handleSubmit} noValidate>

          {/* Type toggle */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {(["income", "expense"] as TxType[]).map((t) => (
              <button key={t} type="button" onClick={() => setTxType(t)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 700, border: txType === t ? "none" : "1px solid var(--surface-border)", background: txType === t ? "var(--accent)" : "var(--surface)", color: txType === t ? "var(--white)" : "var(--muted)" }}>
                {t === "income" ? "Gebi (Income)" : "Wechi (Expense)"}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="tx-amount">Amount (ETB) *</label>
            <input id="tx-amount" type="number" inputMode="decimal" min="0.01" step="any" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} style={inp} required />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="tx-desc">Description *</label>
            <input id="tx-desc" type="text" placeholder="What was this for?" value={description} onChange={(e) => setDescription(e.target.value)} style={inp} required />
          </div>

          {/* Category */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="tx-cat">Category</label>
            <select id="tx-cat" value={category} onChange={(e) => setCategory(e.target.value as TxCategory)} style={inp}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Memo */}
          <div style={{ marginBottom: 18 }}>
            <label style={lbl} htmlFor="tx-memo">Memo</label>
            <textarea id="tx-memo" placeholder="Optional note..." value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
          </div>

          {/* Error */}
          {formError && (
            <div style={{ marginBottom: 14, padding: "10px 14px", background: "color-mix(in srgb, var(--error) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--error) 30%, transparent)", borderRadius: 8, color: "var(--error)", fontSize: 14 }}>
              {formError}
            </div>
          )}

          <button type="submit" disabled={submitting} style={{ width: "100%", padding: "13px 0", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.65 : 1, color: "var(--white)", background: "var(--accent)" }}>
            {submitting ? "Saving..." : txType === "income" ? "Add Income" : "Add Expense"}
          </button>

        </form>
      </BottomSheet>
    </div>
  );
}
