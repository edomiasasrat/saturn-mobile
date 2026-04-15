"use client";

import { useState, useMemo } from "react";
import { Search, Trash2, Minus, Plus, Edit3, ChevronDown, ChevronUp } from "lucide-react";
import BottomSheet from "@/components/BottomSheet";
import FAB from "@/components/FAB";
import { formatBirr, formatDate } from "@/lib/format";
import { useData } from "@/lib/DataProvider";
import type { Loan } from "@/lib/types";

type LoanTab = "given" | "taken";

export default function LoansPage() {
  const { loans, addLoan, updateLoan, deleteLoan, addLoanPayment, adjustLoanAmount, loading } = useData();

  const [tab, setTab] = useState<LoanTab>("given");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Add form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment form
  const [payLoanId, setPayLoanId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMemo, setPayMemo] = useState("");

  // Edit form
  const [editLoanId, setEditLoanId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editMemo, setEditMemo] = useState("");

  // Adjust form
  const [adjustLoanId, setAdjustLoanId] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");

  const givenLoans = useMemo(() => loans.filter((l) => (l.loan_type || "given") === "given"), [loans]);
  const takenLoans = useMemo(() => loans.filter((l) => l.loan_type === "taken"), [loans]);

  const totalGiven = useMemo(() => givenLoans.reduce((s, l) => s + l.remaining_amount, 0), [givenLoans]);
  const totalTaken = useMemo(() => takenLoans.reduce((s, l) => s + l.remaining_amount, 0), [takenLoans]);

  const activeLoans = tab === "given" ? givenLoans : takenLoans;

  const filtered = useMemo(() => {
    if (!search.trim()) return activeLoans;
    const q = search.toLowerCase();
    return activeLoans.filter((l) => l.person_name.toLowerCase().includes(q));
  }, [activeLoans, search]);

  const resetAdd = () => { setName(""); setPhone(""); setAmount(""); setMemo(""); setError(null); };

  const handleAdd = async () => {
    const parsed = parseFloat(amount);
    if (!name.trim()) { setError("Name is required."); return; }
    if (!amount || isNaN(parsed) || parsed <= 0) { setError("Enter a valid amount."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await addLoan({ person_name: name.trim(), phone_number: phone.trim() || null, original_amount: parsed, loan_type: tab, memo: memo.trim() || null });
      setAddOpen(false);
      resetAdd();
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const handlePay = async () => {
    if (payLoanId == null) return;
    const parsed = parseFloat(payAmount);
    if (!payAmount || isNaN(parsed) || parsed <= 0) { setError("Enter a valid amount."); return; }
    const loan = loans.find((l) => l.id === payLoanId);
    if (loan && parsed > loan.remaining_amount) { setError(`Cannot exceed remaining amount (${formatBirr(loan.remaining_amount)}).`); return; }
    setError(null);
    setSubmitting(true);
    try {
      await addLoanPayment(payLoanId, parsed, payMemo.trim() || null);
      setPayOpen(false);
      setPayAmount("");
      setPayMemo("");
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (editLoanId == null) return;
    if (!editName.trim()) { setError("Name is required."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await updateLoan(editLoanId, { person_name: editName.trim(), phone_number: editPhone.trim() || null, memo: editMemo.trim() || null });
      setEditOpen(false);
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const handleAdjust = async () => {
    if (adjustLoanId == null) return;
    const parsed = parseFloat(adjustAmount);
    if (adjustAmount === "" || isNaN(parsed) || parsed < 0) { setError("Enter a valid amount."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await adjustLoanAmount(adjustLoanId, parsed);
      setAdjustOpen(false);
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const openPay = (loanId: number) => {
    setPayLoanId(loanId);
    setPayAmount("");
    setPayMemo("");
    setError(null);
    setPayOpen(true);
  };

  const openEdit = (loanId: number) => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;
    setEditLoanId(loanId);
    setEditName(loan.person_name);
    setEditPhone(loan.phone_number || "");
    setEditMemo(loan.memo || "");
    setError(null);
    setEditOpen(true);
  };

  const openAdjust = (loanId: number) => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;
    setAdjustLoanId(loanId);
    setAdjustAmount(String(loan.remaining_amount));
    setError(null);
    setAdjustOpen(true);
  };

  const handleDelete = async (loanId: number) => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;
    if (!confirm(`Remove loan for ${loan.person_name}? This cannot be undone.`)) return;
    await deleteLoan(loanId);
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

  const renderLoanCard = (loan: Loan) => {
    const isExpanded = expandedId === loan.id;
    const paidPercent = loan.original_amount > 0 ? Math.round(((loan.original_amount - loan.remaining_amount) / loan.original_amount) * 100) : 0;
    const isPaidOff = loan.remaining_amount <= 0;
    const isGiven = (loan.loan_type || "given") === "given";

    return (
      <div key={loan.id} style={{
        background: "var(--surface)", border: "1px solid var(--surface-border)",
        borderRadius: 12, overflow: "hidden",
      }}>
        <div
          onClick={() => setExpandedId(isExpanded ? null : loan.id)}
          style={{
            padding: "14px 14px", display: "flex", justifyContent: "space-between",
            alignItems: "center", cursor: "pointer",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--white)", display: "flex", alignItems: "center", gap: 8 }}>
              {loan.person_name}
              {isPaidOff && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", background: "color-mix(in srgb, var(--green) 15%, transparent)", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>
                  Paid
                </span>
              )}
            </div>
            {loan.phone_number && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{loan.phone_number}</div>
            )}
            {loan.memo && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{loan.memo}</div>
            )}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: isPaidOff ? "var(--green)" : isGiven ? "var(--amber)" : "var(--error)" }}>
                {formatBirr(loan.remaining_amount)}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                of {formatBirr(loan.original_amount)}
              </div>
            </div>
            {isExpanded ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
          </div>
        </div>

        <div style={{ height: 3, background: "var(--bg)", margin: "0 14px 0" }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: isPaidOff ? "var(--green)" : "var(--accent)",
            width: `${Math.min(paidPercent, 100)}%`,
            transition: "width 0.3s",
          }} />
        </div>

        {isExpanded && (
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--surface-border)", marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
              <span>Added: {formatDate(loan.created_at)}</span>
              <span>{paidPercent}% paid</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {!isPaidOff && (
                <button onClick={(e) => { e.stopPropagation(); openPay(loan.id); }} style={{
                  flex: 1, padding: "11px 0", borderRadius: 8, border: "none",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                  background: "var(--green)", color: "var(--white)",
                }}>
                  <Minus size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Record Payment
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); openAdjust(loan.id); }} style={{
                flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid var(--surface-border)",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                background: "transparent", color: "var(--accent)",
              }}>
                <Plus size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Adjust Amount
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={(e) => { e.stopPropagation(); openEdit(loan.id); }} style={{
                flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid var(--surface-border)",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                background: "transparent", color: "var(--white)",
              }}>
                <Edit3 size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Edit
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(loan.id); }} style={{
                flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid color-mix(in srgb, var(--error) 40%, transparent)",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                background: "transparent", color: "var(--error)",
              }}>
                <Trash2 size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", paddingBottom: 96 }}>
      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        padding: "20px 20px 14px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--surface-border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--white)", letterSpacing: "-0.5px" }}>
            Loans
          </h1>
        </div>

        {/* Given/Taken tabs */}
        <div style={{ display: "flex", border: "1px solid var(--surface-border)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
          <button onClick={() => setTab("given")} style={{
            flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700,
            background: tab === "given" ? "var(--accent)" : "transparent",
            color: tab === "given" ? "var(--white)" : "var(--muted)",
            transition: "all 0.15s",
          }}>
            Given ({givenLoans.length})
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: tab === "given" ? "var(--white)" : "var(--amber)" }}>
              {formatBirr(totalGiven)}
            </div>
          </button>
          <button onClick={() => setTab("taken")} style={{
            flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700,
            background: tab === "taken" ? "var(--accent)" : "transparent",
            color: tab === "taken" ? "var(--white)" : "var(--muted)",
            transition: "all 0.15s",
          }}>
            Taken ({takenLoans.length})
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: tab === "taken" ? "var(--white)" : "var(--error)" }}>
              {formatBirr(totalTaken)}
            </div>
          </button>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--bg)", border: "1px solid var(--surface-border)",
          borderRadius: 10, padding: "0 12px",
        }}>
          <Search size={16} color="var(--muted)" />
          <input
            type="text" placeholder="Search by name..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, padding: "10px 0", border: "none", background: "transparent",
              color: "var(--white)", fontSize: 15, outline: "none",
            }}
          />
        </div>
      </div>

      {/* Loan list */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "48px 0", fontSize: 15 }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "64px 0", fontSize: 15 }}>
            {search ? "No loans match your search." : tab === "given" ? "No loans given yet. Tap + to add one." : "No loans taken yet. Tap + to add one."}
          </p>
        ) : (
          filtered.map(renderLoanCard)
        )}
      </div>

      <FAB onClick={() => { resetAdd(); setAddOpen(true); }} />

      {/* Add Loan Sheet */}
      <BottomSheet open={addOpen} onClose={() => !submitting && setAddOpen(false)} title={tab === "given" ? "Add Loan Given" : "Add Loan Taken"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lbl}>{tab === "given" ? "Who owes you? *" : "Who do you owe? *"}</label>
            <input type="text" placeholder="Person name" value={name} onChange={(e) => setName(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Phone Number</label>
            <input type="tel" placeholder="09..." value={phone} onChange={(e) => setPhone(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Amount (ETB) *</label>
            <input type="number" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Memo</label>
            <textarea placeholder="What's this for?" value={memo} onChange={(e) => setMemo(e.target.value)} rows={2}
              style={{ ...inp, resize: "none", fontFamily: "inherit" }} />
          </div>
          {error && (
            <div style={{
              color: "var(--error)", fontSize: 13, padding: "8px 12px", borderRadius: 8,
              background: "color-mix(in srgb, var(--error) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
            }}>{error}</div>
          )}
          <button onClick={handleAdd} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--accent)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Saving..." : "Add Loan"}
          </button>
        </div>
      </BottomSheet>

      {/* Record Payment Sheet */}
      <BottomSheet open={payOpen} onClose={() => !submitting && setPayOpen(false)} title="Record Payment">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {payLoanId && (() => {
            const loan = loans.find((l) => l.id === payLoanId);
            const isGiven = loan && (loan.loan_type || "given") === "given";
            return loan ? (
              <div style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: 10, fontSize: 13, color: "var(--muted)" }}>
                {isGiven
                  ? <>{loan.person_name} owes <span style={{ color: "var(--amber)", fontWeight: 700 }}>{formatBirr(loan.remaining_amount)}</span></>
                  : <>You owe {loan.person_name} <span style={{ color: "var(--error)", fontWeight: 700 }}>{formatBirr(loan.remaining_amount)}</span></>
                }
              </div>
            ) : null;
          })()}
          <div>
            <label style={lbl}>Amount Paid (ETB) *</label>
            <input type="number" inputMode="numeric" placeholder="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Memo</label>
            <input type="text" placeholder="Optional note..." value={payMemo} onChange={(e) => setPayMemo(e.target.value)} style={inp} />
          </div>
          {error && (
            <div style={{
              color: "var(--error)", fontSize: 13, padding: "8px 12px", borderRadius: 8,
              background: "color-mix(in srgb, var(--error) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
            }}>{error}</div>
          )}
          <button onClick={handlePay} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--green)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Saving..." : "Confirm Payment"}
          </button>
        </div>
      </BottomSheet>

      {/* Edit Loan Sheet */}
      <BottomSheet open={editOpen} onClose={() => !submitting && setEditOpen(false)} title="Edit Loan">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lbl}>Person Name *</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Phone Number</label>
            <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Memo</label>
            <textarea value={editMemo} onChange={(e) => setEditMemo(e.target.value)} rows={2}
              style={{ ...inp, resize: "none", fontFamily: "inherit" }} />
          </div>
          {error && (
            <div style={{
              color: "var(--error)", fontSize: 13, padding: "8px 12px", borderRadius: 8,
              background: "color-mix(in srgb, var(--error) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
            }}>{error}</div>
          )}
          <button onClick={handleEdit} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--accent)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </BottomSheet>

      {/* Adjust Amount Sheet */}
      <BottomSheet open={adjustOpen} onClose={() => !submitting && setAdjustOpen(false)} title="Adjust Remaining Amount">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {adjustLoanId && (() => {
            const loan = loans.find((l) => l.id === adjustLoanId);
            return loan ? (
              <div style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: 10, fontSize: 13, color: "var(--muted)" }}>
                Current remaining: <span style={{ color: "var(--amber)", fontWeight: 700 }}>{formatBirr(loan.remaining_amount)}</span>
                <br />Original: {formatBirr(loan.original_amount)}
              </div>
            ) : null;
          })()}
          <div>
            <label style={lbl}>New Remaining Amount (ETB)</label>
            <input type="number" inputMode="numeric" placeholder="0" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} style={inp} />
          </div>
          {error && (
            <div style={{
              color: "var(--error)", fontSize: 13, padding: "8px 12px", borderRadius: 8,
              background: "color-mix(in srgb, var(--error) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
            }}>{error}</div>
          )}
          <button onClick={handleAdjust} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--accent)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Saving..." : "Update Amount"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
