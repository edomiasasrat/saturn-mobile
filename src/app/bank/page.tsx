"use client";

import { useState, useMemo } from "react";
import { Edit3, ChevronDown, ChevronUp, Plus, History } from "lucide-react";
import type { BankEntry } from "@/lib/types";
import { formatDate } from "@/lib/format";
import BottomSheet from "@/components/BottomSheet";
import FAB from "@/components/FAB";
import { useData } from "@/lib/DataProvider";

type Currency = "birr" | "usd" | "usdt";
const currencySymbols: Record<Currency, string> = { birr: "ETB", usd: "USD", usdt: "USDT" };

function formatAmount(amount: number, currency: Currency): string {
  return `${currencySymbols[currency]} ${amount.toLocaleString()}`;
}

interface BankGroup {
  name: string;
  balances: { birr: number; usd: number; usdt: number };
  entries: BankEntry[];
}

export default function BankPage() {
  const { bankEntries, addBankEntry, loading } = useData();

  const [editOpen, setEditOpen] = useState(false);
  const [addBankOpen, setAddBankOpen] = useState(false);
  const [expandedBank, setExpandedBank] = useState<string | null>(null);

  // Edit balance form
  const [editBankName, setEditBankName] = useState("");
  const [editCurrency, setEditCurrency] = useState<Currency>("birr");
  const [editAmount, setEditAmount] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add bank form
  const [newBankName, setNewBankName] = useState("");
  const [newCurrency, setNewCurrency] = useState<Currency>("birr");
  const [newAmount, setNewAmount] = useState("");
  const [newMemo, setNewMemo] = useState("");

  // Group entries by bank_name and compute balances
  const banks: BankGroup[] = useMemo(() => {
    const groups: Record<string, BankEntry[]> = {};
    for (const entry of bankEntries) {
      const name = entry.bank_name || "Cash";
      if (!groups[name]) groups[name] = [];
      groups[name].push(entry);
    }

    return Object.entries(groups).map(([name, entries]) => {
      // Sort entries newest first
      const sorted = [...entries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Get latest balance per currency
      const balances = { birr: 0, usd: 0, usdt: 0 };
      for (const curr of ["birr", "usd", "usdt"] as Currency[]) {
        const latest = sorted.find((e) => (e.currency || "birr") === curr);
        if (latest) balances[curr] = latest.balance_after;
      }

      return { name, balances, entries: sorted };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [bankEntries]);

  // Total balances across all banks
  const totals = useMemo(() => {
    const t = { birr: 0, usd: 0, usdt: 0 };
    for (const bank of banks) {
      t.birr += bank.balances.birr;
      t.usd += bank.balances.usd;
      t.usdt += bank.balances.usdt;
    }
    return t;
  }, [banks]);

  const openEditBalance = (bankName: string, currency: Currency, currentBalance: number) => {
    setEditBankName(bankName);
    setEditCurrency(currency);
    setEditAmount(String(currentBalance));
    setEditMemo("");
    setError(null);
    setEditOpen(true);
  };

  const handleEditBalance = async () => {
    const parsed = parseFloat(editAmount);
    if (editAmount === "" || isNaN(parsed)) { setError("Enter a valid amount."); return; }
    if (!editMemo.trim()) { setError("Memo is required for balance edits."); return; }
    setError(null);
    setSubmitting(true);

    // Find current balance for this bank+currency
    const bankEntryList = bankEntries.filter(
      (e) => (e.bank_name || "Cash") === editBankName && (e.currency || "birr") === editCurrency
    );
    const sorted = [...bankEntryList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const currentBalance = sorted.length > 0 ? sorted[0].balance_after : 0;
    const diff = parsed - currentBalance;

    if (diff === 0) {
      setEditOpen(false);
      setSubmitting(false);
      return;
    }

    try {
      await addBankEntry({
        type: diff > 0 ? "deposit" : "withdrawal",
        amount: Math.abs(diff),
        memo: editMemo.trim(),
        bank_name: editBankName === "Cash" ? null : editBankName,
        currency: editCurrency,
      });
      setEditOpen(false);
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const handleAddBank = async () => {
    if (!newBankName.trim()) { setError("Bank name is required."); return; }
    const parsed = parseFloat(newAmount);
    if (newAmount === "" || isNaN(parsed)) { setError("Enter a valid amount."); return; }
    if (!newMemo.trim()) { setError("Memo is required."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await addBankEntry({
        type: "deposit",
        amount: parsed,
        memo: newMemo.trim(),
        bank_name: newBankName.trim(),
        currency: newCurrency,
      });
      setAddBankOpen(false);
      setNewBankName("");
      setNewAmount("");
      setNewMemo("");
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "var(--bg)", border: "1px solid var(--surface-border)",
    borderRadius: 8, padding: "10px 12px",
    color: "var(--white)", fontSize: 16, outline: "none",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 13, fontWeight: 600,
    color: "var(--muted)", marginBottom: 6,
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", paddingBottom: 96 }}>
      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--surface)",
        borderBottom: "1px solid var(--surface-border)",
        padding: "20px 20px 16px",
      }}>
        <h1 style={{ color: "var(--white)", fontSize: 22, fontWeight: 800, margin: "0 0 14px", letterSpacing: "-0.01em" }}>
          Bank
        </h1>

        {/* Total balances */}
        <div style={{ display: "flex", gap: 8 }}>
          {([
            { key: "birr" as Currency, label: "ETB", bal: totals.birr },
            { key: "usd" as Currency, label: "USD", bal: totals.usd },
            { key: "usdt" as Currency, label: "USDT", bal: totals.usdt },
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
      </div>

      {/* Bank list */}
      <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "48px 0", fontSize: 15 }}>Loading...</div>
        ) : banks.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "64px 0", fontSize: 15 }}>No banks yet. Tap + to add one.</div>
        ) : (
          banks.map((bank) => {
            const isExpanded = expandedBank === bank.name;
            const hasNonZero = bank.balances.birr !== 0 || bank.balances.usd !== 0 || bank.balances.usdt !== 0;

            return (
              <div key={bank.name} style={{
                background: "var(--surface)", border: "1px solid var(--surface-border)",
                borderRadius: 12, overflow: "hidden",
              }}>
                {/* Bank header */}
                <div style={{ padding: "14px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--white)" }}>
                      {bank.name}
                    </div>
                    <button
                      onClick={() => setExpandedBank(isExpanded ? null : bank.name)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}
                    >
                      <History size={14} />
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Currency balances with edit buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {([
                      { key: "birr" as Currency, label: "ETB", bal: bank.balances.birr },
                      { key: "usd" as Currency, label: "USD", bal: bank.balances.usd },
                      { key: "usdt" as Currency, label: "USDT", bal: bank.balances.usdt },
                    ]).filter((c) => c.bal !== 0 || hasNonZero).map((c) => (
                      <div key={c.key} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "6px 10px", background: "var(--bg)", borderRadius: 8,
                      }}>
                        <div>
                          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginRight: 8 }}>{c.label}</span>
                          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--white)" }}>{c.bal.toLocaleString()}</span>
                        </div>
                        <button
                          onClick={() => openEditBalance(bank.name, c.key, c.bal)}
                          style={{
                            background: "none", border: "1px solid var(--surface-border)",
                            borderRadius: 6, padding: "4px 10px", cursor: "pointer",
                            color: "var(--accent)", fontSize: 12, fontWeight: 600,
                            display: "flex", alignItems: "center", gap: 4,
                          }}
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity log (expanded) */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid var(--surface-border)", padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                      Activity
                    </div>
                    {bank.entries.length === 0 ? (
                      <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: "12px 0" }}>No activity yet</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {bank.entries.slice(0, 20).map((entry) => {
                          const isDeposit = entry.type === "deposit";
                          const curr = (entry.currency || "birr") as Currency;
                          return (
                            <div key={entry.id} style={{
                              padding: "8px 10px", background: "var(--bg)", borderRadius: 8,
                              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: "var(--white)", fontWeight: 500 }}>
                                  {entry.memo || (isDeposit ? "Deposit" : "Withdrawal")}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                                  {formatDate(entry.created_at)}
                                </div>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: isDeposit ? "var(--green)" : "var(--error)" }}>
                                  {isDeposit ? "+" : "-"}{formatAmount(entry.amount, curr)}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                                  Bal: {formatAmount(entry.balance_after, curr)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <FAB onClick={() => { setNewBankName(""); setNewAmount(""); setNewMemo(""); setNewCurrency("birr"); setError(null); setAddBankOpen(true); }} />

      {/* Edit Balance Sheet */}
      <BottomSheet open={editOpen} onClose={() => !submitting && setEditOpen(false)} title={`Edit ${editBankName} Balance`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            padding: "10px 14px", background: "var(--bg)", borderRadius: 10,
            fontSize: 13, color: "var(--muted)", textAlign: "center",
          }}>
            Editing <span style={{ color: "var(--accent)", fontWeight: 700 }}>{currencySymbols[editCurrency]}</span> balance for <span style={{ color: "var(--white)", fontWeight: 700 }}>{editBankName}</span>
          </div>
          <div>
            <label style={lbl}>New Balance ({currencySymbols[editCurrency]}) *</label>
            <input type="number" inputMode="decimal" placeholder="0" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Memo (required) *</label>
            <textarea placeholder="Reason for adjustment..." value={editMemo} onChange={(e) => setEditMemo(e.target.value)} rows={2}
              style={{ ...inp, resize: "none", fontFamily: "inherit" }} />
          </div>
          {error && (
            <div style={{
              color: "var(--error)", fontSize: 13, padding: "8px 12px", borderRadius: 8,
              background: "color-mix(in srgb, var(--error) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
            }}>{error}</div>
          )}
          <button onClick={handleEditBalance} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--accent)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Saving..." : "Update Balance"}
          </button>
        </div>
      </BottomSheet>

      {/* Add Bank Sheet */}
      <BottomSheet open={addBankOpen} onClose={() => !submitting && setAddBankOpen(false)} title="Add Bank">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lbl}>Bank Name *</label>
            <input type="text" placeholder="e.g. CBE, Awash, Telebirr..." value={newBankName} onChange={(e) => setNewBankName(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Currency</label>
            <div style={{ display: "flex", border: "1px solid var(--surface-border)", borderRadius: 10, overflow: "hidden" }}>
              {(["birr", "usd", "usdt"] as Currency[]).map((c) => (
                <button key={c} onClick={() => setNewCurrency(c)} style={{
                  flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, textTransform: "uppercase",
                  background: newCurrency === c ? "var(--accent)" : "var(--surface)",
                  color: newCurrency === c ? "var(--white)" : "var(--muted)",
                  transition: "all 0.15s",
                }}>
                  {c === "birr" ? "ETB" : c.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Starting Balance *</label>
            <input type="number" inputMode="decimal" placeholder="0" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Memo (required) *</label>
            <textarea placeholder="e.g. Initial balance..." value={newMemo} onChange={(e) => setNewMemo(e.target.value)} rows={2}
              style={{ ...inp, resize: "none", fontFamily: "inherit" }} />
          </div>
          {error && (
            <div style={{
              color: "var(--error)", fontSize: 13, padding: "8px 12px", borderRadius: 8,
              background: "color-mix(in srgb, var(--error) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
            }}>{error}</div>
          )}
          <button onClick={handleAddBank} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--accent)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Saving..." : "Add Bank"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
