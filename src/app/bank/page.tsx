"use client";

import { useState } from "react";
import { Edit3, Wallet, TrendingUp, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import BottomSheet from "@/components/BottomSheet";
import FAB from "@/components/FAB";
import { useData } from "@/lib/DataProvider";
import type { BankAccount, BankLog } from "@/lib/types";

type Currency = "birr" | "usd" | "usdt";
const currencyLabels: Record<Currency, string> = { birr: "ETB", usd: "USD", usdt: "USDT" };

export default function BankPage() {
  const { bankAccounts, bankLog, getTotalLiquid, addBankAccount, updateBankBalance, updateBankRate, deleteBankAccount, loading } = useData();

  const [editOpen, setEditOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit balance form
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMemo, setEditMemo] = useState("");

  // Edit rate form
  const [rateAccount, setRateAccount] = useState<BankAccount | null>(null);
  const [rateValue, setRateValue] = useState("");

  // Add form
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState<Currency>("birr");
  const [newAmount, setNewAmount] = useState("");
  const [newRate, setNewRate] = useState("");

  const openEditBalance = (account: BankAccount) => {
    setEditAccount(account);
    setEditAmount(String(account.balance));
    setEditMemo("");
    setRateValue(String(account.exchange_rate));
    setError(null);
    setEditOpen(true);
  };

  const openEditRate = (account: BankAccount) => {
    setRateAccount(account);
    setRateValue(String(account.exchange_rate));
    setError(null);
    setRateOpen(true);
  };

  const handleUpdateBalance = async () => {
    if (!editAccount) return;
    const parsed = parseFloat(editAmount);
    if (editAmount === "" || isNaN(parsed)) { setError("Enter a valid amount."); return; }
    setSubmitting(true);
    try {
      // Update balance
      await updateBankBalance(editAccount.id, parsed, editMemo.trim() || null);
      // Update exchange rate if changed (non-birr only)
      if (editAccount.currency !== "birr" && rateValue !== "") {
        const parsedRate = parseFloat(rateValue);
        if (!isNaN(parsedRate) && parsedRate > 0 && parsedRate !== editAccount.exchange_rate) {
          await updateBankRate(editAccount.id, parsedRate);
        }
      }
      setEditOpen(false);
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const handleUpdateRate = async () => {
    if (!rateAccount) return;
    const parsed = parseFloat(rateValue);
    if (rateValue === "" || isNaN(parsed) || parsed <= 0) { setError("Enter a valid rate."); return; }
    setSubmitting(true);
    try {
      await updateBankRate(rateAccount.id, parsed);
      setRateOpen(false);
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const handleAddBank = async () => {
    if (!newName.trim()) { setError("Bank name is required."); return; }
    const parsed = parseFloat(newAmount);
    if (newAmount === "" || isNaN(parsed) || parsed < 0) { setError("Enter a valid starting balance."); return; }
    const rate = newCurrency !== "birr" ? parseFloat(newRate) : 1;
    if (newCurrency !== "birr" && (newRate === "" || isNaN(rate) || rate <= 0)) { setError("Enter a valid exchange rate."); return; }
    setSubmitting(true);
    try {
      await addBankAccount({ name: newName.trim(), currency: newCurrency, balance: parsed, exchange_rate: rate });
      setAddOpen(false);
      setNewName(""); setNewAmount(""); setNewRate(""); setNewCurrency("birr");
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    setSubmitting(true);
    try {
      await deleteBankAccount(id);
      setDeleteConfirm(null);
    } catch { /* ignore */ }
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

  const totalLiquid = loading ? 0 : getTotalLiquid();

  // Build a map of account names for the log
  const accountMap = new Map<number, BankAccount>();
  for (const a of bankAccounts) accountMap.set(a.id, a);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", paddingBottom: 96 }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--surface)",
        borderBottom: "1px solid var(--surface-border)",
        padding: "20px 20px 16px",
      }}>
        <h1 style={{ color: "var(--white)", fontSize: 22, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
          Bank
        </h1>
        <div style={{
          background: "var(--bg)", border: "1px solid var(--surface-border)",
          borderRadius: 12, padding: "12px 16px", textAlign: "center",
        }}>
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
            Total Liquid
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: loading ? "var(--muted)" : "var(--white)", letterSpacing: "-0.02em" }}>
            {loading ? "\u2014" : `ETB ${totalLiquid.toLocaleString()}`}
          </div>
        </div>
      </div>

      {/* Account cards */}
      <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "48px 0", fontSize: 15 }}>Loading...</div>
        ) : bankAccounts.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "64px 20px", fontSize: 15 }}>
            <Wallet size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div>No banks yet. Tap + to add one.</div>
          </div>
        ) : (
          bankAccounts.map((account) => (
            <div key={account.id} style={{
              background: "var(--surface)", border: "1px solid var(--surface-border)",
              borderRadius: 12, padding: 14,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: "var(--white)" }}>{account.name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                    background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--surface-border)",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {currencyLabels[account.currency]}
                  </span>
                </div>
                <button
                  onClick={() => setDeleteConfirm(account.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Balance row */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 12px", background: "var(--bg)", borderRadius: 8,
              }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "var(--white)" }}>
                  {account.balance.toLocaleString()}
                </span>
                <button
                  onClick={() => openEditBalance(account)}
                  style={{
                    background: "none", border: "1px solid var(--surface-border)",
                    borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                    color: "var(--accent)", fontSize: 12, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Edit3 size={12} /> Update
                </button>
              </div>

              {/* Exchange rate (non-birr only) */}
              {account.currency !== "birr" && (
                <div
                  onClick={() => openEditRate(account)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px", background: "var(--bg)", borderRadius: 8,
                    marginTop: 6, cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <TrendingUp size={14} style={{ color: "var(--accent)" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>
                      1 {currencyLabels[account.currency]} = {account.exchange_rate.toLocaleString()} ETB
                    </span>
                  </div>
                  <Edit3 size={12} style={{ color: "var(--accent)" }} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Activity Log */}
      {!loading && bankLog.length > 0 && (
        <div style={{ padding: "20px 16px 0" }}>
          <h2 style={{
            fontSize: 11, fontWeight: 700, color: "var(--muted)",
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
          }}>
            Recent Activity
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {bankLog.slice(0, 20).map((log) => {
              const account = accountMap.get(log.account_id);
              const delta = log.balance_after - log.balance_before;
              const isPositive = delta >= 0;
              const currency = account?.currency || "birr";
              return (
                <div key={log.id} style={{
                  padding: "10px 12px", background: "var(--surface)",
                  border: "1px solid var(--surface-border)", borderRadius: 8,
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>
                      {account?.name || "Unknown"}
                    </div>
                    {log.memo && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{log.memo}</div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                      {formatDate(log.created_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isPositive ? "var(--green)" : "var(--error)" }}>
                      {isPositive ? "+" : ""}{delta.toLocaleString()} {currencyLabels[currency as Currency]}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {log.balance_before.toLocaleString()} → {log.balance_after.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <FAB onClick={() => { setNewName(""); setNewAmount(""); setNewRate(""); setNewCurrency("birr"); setError(null); setAddOpen(true); }} />

      {/* Update Balance Sheet */}
      <BottomSheet open={editOpen} onClose={() => !submitting && setEditOpen(false)} title="Update Balance">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            padding: "10px 14px", background: "var(--bg)", borderRadius: 10,
            fontSize: 14, color: "var(--muted)", textAlign: "center",
          }}>
            <span style={{ color: "var(--white)", fontWeight: 700 }}>{editAccount?.name}</span>
            {" \u00b7 "}
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{editAccount ? currencyLabels[editAccount.currency] : ""}</span>
          </div>
          <div>
            <label style={lbl}>Current Balance</label>
            <input
              type="number" inputMode="decimal" placeholder="0"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              style={{ ...inp, fontSize: 20, fontWeight: 700, textAlign: "center", padding: "14px 12px" }}
            />
          </div>
          {editAccount && editAccount.currency !== "birr" && (
            <div>
              <label style={lbl}>Exchange Rate (1 {currencyLabels[editAccount.currency]} = ? ETB)</label>
              <input
                type="number" inputMode="decimal" placeholder="e.g. 130"
                value={rateValue}
                onChange={(e) => setRateValue(e.target.value)}
                style={inp}
              />
            </div>
          )}
          <div>
            <label style={lbl}>Note (optional)</label>
            <textarea
              placeholder="Why is this changing?"
              value={editMemo}
              onChange={(e) => setEditMemo(e.target.value)}
              rows={2}
              style={{ ...inp, resize: "none", fontFamily: "inherit" }}
            />
          </div>
          {error && (
            <div style={{
              color: "var(--error)", fontSize: 13, padding: "8px 12px", borderRadius: 8,
              background: "color-mix(in srgb, var(--error) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
            }}>{error}</div>
          )}
          <button onClick={handleUpdateBalance} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--accent)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </BottomSheet>

      {/* Update Rate Sheet */}
      <BottomSheet open={rateOpen} onClose={() => !submitting && setRateOpen(false)} title="Exchange Rate">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            padding: "10px 14px", background: "var(--bg)", borderRadius: 10,
            fontSize: 14, color: "var(--muted)", textAlign: "center",
          }}>
            1 {rateAccount ? currencyLabels[rateAccount.currency] : ""} = ___ ETB
          </div>
          <input
            type="number" inputMode="decimal" placeholder="0"
            value={rateValue}
            onChange={(e) => setRateValue(e.target.value)}
            style={{ ...inp, fontSize: 20, fontWeight: 700, textAlign: "center", padding: "14px 12px" }}
          />
          {error && (
            <div style={{
              color: "var(--error)", fontSize: 13, padding: "8px 12px", borderRadius: 8,
              background: "color-mix(in srgb, var(--error) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
            }}>{error}</div>
          )}
          <button onClick={handleUpdateRate} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--accent)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </BottomSheet>

      {/* Add Bank Sheet */}
      <BottomSheet open={addOpen} onClose={() => !submitting && setAddOpen(false)} title="Add Bank">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lbl}>Bank Name</label>
            <input type="text" placeholder="e.g. CBE, Awash, Telebirr..." value={newName} onChange={(e) => setNewName(e.target.value)} style={inp} />
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
                  {currencyLabels[c]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Starting Balance</label>
            <input type="number" inputMode="decimal" placeholder="0" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} style={inp} />
          </div>
          {newCurrency !== "birr" && (
            <div>
              <label style={lbl}>Exchange Rate (1 {currencyLabels[newCurrency]} = ? ETB)</label>
              <input type="number" inputMode="decimal" placeholder="e.g. 130" value={newRate} onChange={(e) => setNewRate(e.target.value)} style={inp} />
            </div>
          )}
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

      {/* Delete Confirmation Sheet */}
      <BottomSheet open={deleteConfirm !== null} onClose={() => !submitting && setDeleteConfirm(null)} title="Delete Bank">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            padding: "12px 14px", background: "var(--bg)", borderRadius: 10,
            fontSize: 14, color: "var(--muted)", textAlign: "center",
          }}>
            Are you sure you want to delete <span style={{ color: "var(--white)", fontWeight: 700 }}>
              {deleteConfirm !== null ? accountMap.get(deleteConfirm)?.name : ""}
            </span>? This will remove the account and all its activity history.
          </div>
          <button onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--error)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
