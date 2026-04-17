"use client";

import { useState, ReactNode } from "react";
import StatCard from "@/components/StatCard";
import ModalDrilldown from "@/components/ModalDrilldown";
import PhoneDetail from "@/components/PhoneDetail";
import SellerDetail from "@/components/SellerDetail";
import BottomSheet from "@/components/BottomSheet";
import FAB from "@/components/FAB";
import { formatBirr, formatDate } from "@/lib/format";
import { useData } from "@/lib/DataProvider";
import type { Phone, Transaction, SellerWithStats } from "@/lib/types";

const periods = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
];

/* ─── Detail row helper for inline cards ─── */
const detailRow = (label: string, value: string | null | undefined, color?: string) => {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--surface-border)" }}>
      <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: color || "var(--white)" }}>{value}</span>
    </div>
  );
};

/* ─── Modal content types ─── */
type ModalType = "phone" | "transaction" | "seller" | null;

export default function Dashboard() {
  const { getDashboardStats, getTopSellers, getPhoneActivity, getProfitLoss, getNetWorth, phones, transactions, bankAccounts, loading, refresh, addExpense, getTotalLiquid } = useData();

  const [period, setPeriod] = useState("today");

  // Modal state
  type ModalItem = Phone | Transaction;
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalItems, setModalItems] = useState<ModalItem[]>([]);
  const [modalIndex, setModalIndex] = useState(0);

  // Seller modal (separate instance for top sellers)
  const [sellerModalOpen, setSellerModalOpen] = useState(false);
  const [sellerList, setSellerList] = useState<SellerWithStats[]>([]);
  const [sellerIndex, setSellerIndex] = useState(0);

  // Expense form
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expCategory, setExpCategory] = useState("other");
  const [expPayment, setExpPayment] = useState<"cash" | "bank">("cash");
  const [expMemo, setExpMemo] = useState("");
  const [expSubmitting, setExpSubmitting] = useState(false);
  const [expError, setExpError] = useState<string | null>(null);

  // Computed instantly from context
  const stats = getDashboardStats(period);
  const topSellers = getTopSellers();
  const phoneActivity = getPhoneActivity(period);
  const pnl = getProfitLoss(period);

  // P&L for all three periods
  const pnlToday = getProfitLoss("today");
  const pnlWeek = getProfitLoss("week");
  const pnlMonth = getProfitLoss("month");

  /* ─── Stat card tap handlers ─── */

  function openPhoneModal(status: string) {
    const filtered: Phone[] = phones.filter((p) => p.status === status);
    if (filtered.length === 0) return;
    setModalType("phone");
    setModalItems(filtered);
    setModalIndex(0);
    setModalOpen(true);
  }

  function openTransactionModal(type?: string) {
    const filtered: Transaction[] = type
      ? transactions.filter((t) => t.type === type)
      : transactions;
    if (filtered.length === 0) return;
    setModalType("transaction");
    setModalItems(filtered);
    setModalIndex(0);
    setModalOpen(true);
  }

  function openSellerModal(sellerId: number) {
    const allSellers = [...topSellers].sort((a, b) => b.total_owed - a.total_owed);
    const idx = allSellers.findIndex((s) => s.id === sellerId);
    if (idx < 0) return;
    setSellerList(allSellers);
    setSellerIndex(idx);
    setSellerModalOpen(true);
  }

  /* ─── Render modal content based on type ─── */

  function renderContent(item: ModalItem, pushView: (content: ReactNode, title: string) => void): ReactNode {
    if (modalType === "phone") {
      return (
        <PhoneDetail
          phoneId={item.id}
          pushView={pushView}
          onAction={() => { refresh(); setModalOpen(false); }}
        />
      );
    }

    if (modalType === "transaction") {
      const tx = item as Transaction;
      const amountColor = tx.type === "income" ? "var(--green)" : "var(--error)";
      return (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--white)", margin: "0 0 16px" }}>
            {tx.description}
          </h2>
          <div style={{ marginBottom: 16 }}>
            {detailRow("Type", tx.type === "income" ? "Income" : "Expense")}
            {detailRow("Amount", formatBirr(tx.amount), amountColor)}
            {detailRow("Category", tx.category?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))}
            {tx.payment_method && detailRow("Payment", tx.payment_method === "cash" ? "Cash" : "Bank")}
            {tx.memo && detailRow("Memo", tx.memo)}
            {detailRow("Date", formatDate(tx.created_at))}
          </div>
        </div>
      );
    }

    return null;
  }

  function renderSellerContent(item: SellerWithStats, pushView: (content: ReactNode, title: string) => void): ReactNode {
    const seller = item;
    return (
      <SellerDetail
        sellerId={seller.id}
        pushView={pushView}
        onAction={() => { refresh(); setSellerModalOpen(false); }}
      />
    );
  }

  const top5 = [...topSellers]
    .sort((a, b) => b.total_owed - a.total_owed)
    .slice(0, 5);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", paddingBottom: 96 }}>
      {/* Sticky header */}
      <div style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--surface-border)",
        padding: "16px 16px 14px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/saturn-logo.svg" alt="Saturn" width={32} height={32} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--white)", margin: 0 }}>
            Saturn Mobile
          </h1>
        </div>
        {/* Net Worth */}
        {(() => {
          const nw = getNetWorth();
          return (
            <div style={{
              marginTop: 12,
              background: "var(--bg)",
              border: "1px solid var(--surface-border)",
              borderRadius: "var(--radius)",
              padding: "12px 16px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Net Worth
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: loading ? "var(--muted)" : nw >= 0 ? "var(--green)" : "var(--error)" }}>
                  {loading ? "\u2014" : formatBirr(nw)}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      <div style={{ padding: "12px 16px" }}>
        {/* Period filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {periods.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              flex: 1,
              padding: "8px 4px",
              border: period === p.key ? "none" : "1px solid var(--surface-border)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
              background: period === p.key ? "var(--accent)" : "transparent",
              color: period === p.key ? "var(--white)" : "var(--muted)",
              transition: "all 0.2s",
            }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div onClick={() => openPhoneModal("in_stock")} style={{ cursor: "pointer" }}>
              <StatCard label="In Stock" value={String(stats.phones_in_stock)} />
            </div>
            <div onClick={() => openPhoneModal("with_seller")} style={{ cursor: "pointer" }}>
              <StatCard label="With Sellers" value={String(stats.phones_with_sellers)} />
            </div>
            <div onClick={() => openPhoneModal("with_seller")} style={{ cursor: "pointer" }}>
              <StatCard label="Money Out" value={formatBirr(stats.money_out_there)} color="var(--amber)" />
            </div>
            <div onClick={() => openPhoneModal("in_stock")} style={{ cursor: "pointer" }}>
              <StatCard label="Stock Value" value={formatBirr(stats.stock_value)} />
            </div>
            <div onClick={() => openTransactionModal("income")} style={{ cursor: "pointer" }}>
              <StatCard label="Collections" value={formatBirr(stats.total_collections)} color="var(--green)" />
            </div>
            <div onClick={() => openTransactionModal("expense")} style={{ cursor: "pointer" }}>
              <StatCard label="Expenses" value={formatBirr(stats.total_expenses)} color="var(--error)" />
            </div>
            <div>
              <StatCard label="Bank (ETB)" value={formatBirr(getTotalLiquid())} />
            </div>
            <div onClick={() => openTransactionModal()} style={{ cursor: "pointer" }}>
              <StatCard label="Profit" value={formatBirr(stats.net_profit)} color={stats.net_profit >= 0 ? "var(--green)" : "var(--amber)"} />
            </div>
          </div>
        )}

        {/* ── Profit & Loss ── */}
        {!loading && (
          <div style={{ marginTop: 20 }}>
            <h2 style={{
              fontSize: 13, fontWeight: 600, color: "var(--muted)",
              textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px",
            }}>
              Profit & Loss
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {([
                { label: "Today", data: pnlToday },
                { label: "This Week", data: pnlWeek },
                { label: "This Month", data: pnlMonth },
              ]).map((row) => (
                <div key={row.label} style={{
                  background: "var(--surface)", border: "1px solid var(--surface-border)",
                  borderRadius: 10, padding: "12px 14px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{row.label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      In: {formatBirr(row.data.income)} &middot; Out: {formatBirr(row.data.expenses)}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 16, fontWeight: 700,
                    color: row.data.profit >= 0 ? "var(--green)" : "var(--error)",
                  }}>
                    {row.data.profit >= 0 ? "+" : ""}{formatBirr(row.data.profit)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Phone Activity ── */}
        {!loading && (
          <div style={{ marginTop: 20 }}>
            <h2 style={{
              fontSize: 13, fontWeight: 600, color: "var(--muted)",
              textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px",
            }}>
              Phone Activity ({periods.find((p) => p.key === period)?.label})
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{
                background: "var(--surface)", border: "1px solid var(--surface-border)",
                borderRadius: 10, padding: "14px", textAlign: "center",
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--white)" }}>{phoneActivity.bought}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", marginTop: 4 }}>Bought</div>
              </div>
              <div style={{
                background: "var(--surface)", border: "1px solid var(--surface-border)",
                borderRadius: 10, padding: "14px", textAlign: "center",
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{phoneActivity.sold}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", marginTop: 4 }}>Sold</div>
              </div>
              <div style={{
                background: "var(--surface)", border: "1px solid var(--surface-border)",
                borderRadius: 10, padding: "14px", textAlign: "center",
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>{phoneActivity.sold_by_me}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", marginTop: 4 }}>Sold by Me</div>
              </div>
              <div style={{
                background: "var(--surface)", border: "1px solid var(--surface-border)",
                borderRadius: 10, padding: "14px", textAlign: "center",
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--amber)" }}>{phoneActivity.sold_by_sellers}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", marginTop: 4 }}>Sold by Sellers</div>
              </div>
            </div>
          </div>
        )}

        {/* Top Sellers */}
        {top5.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h2 style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              margin: "0 0 10px",
            }}>
              Top Sellers
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {top5.map((seller) => (
                <div
                  key={seller.id}
                  onClick={() => openSellerModal(seller.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div style={{
                    background: "var(--surface)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>
                      {seller.name}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--amber)" }}>
                        {formatBirr(seller.total_owed)}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {seller.phones_held} phone{seller.phones_held !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats Modal Drilldown */}
      <ModalDrilldown
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        items={modalItems}
        currentIndex={modalIndex}
        onChangeIndex={setModalIndex}
        renderContent={renderContent}
      />

      {/* Seller Modal Drilldown */}
      <ModalDrilldown
        open={sellerModalOpen}
        onClose={() => setSellerModalOpen(false)}
        items={sellerList}
        currentIndex={sellerIndex}
        onChangeIndex={setSellerIndex}
        renderContent={renderSellerContent}
      />

      {/* Add Expense FAB */}
      <FAB onClick={() => {
        setExpAmount(""); setExpDesc(""); setExpCategory("other");
        setExpPayment("cash"); setExpMemo(""); setExpError(null);
        setExpenseOpen(true);
      }} />

      {/* Add Expense Sheet */}
      <BottomSheet open={expenseOpen} onClose={() => !expSubmitting && setExpenseOpen(false)} title="Add Expense">
        {(() => {
          const inp: React.CSSProperties = {
            width: "100%", padding: "10px 12px", border: "1px solid var(--surface-border)",
            borderRadius: 8, fontSize: 15, background: "var(--bg)", color: "var(--white)",
            boxSizing: "border-box" as const, outline: "none",
          };
          const lbl: React.CSSProperties = {
            display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)",
            marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.04em",
          };
          const categories = [
            { value: "rent", label: "Rent" },
            { value: "utilities", label: "Utilities" },
            { value: "transport", label: "Transport" },
            { value: "purchase", label: "Purchase" },
            { value: "other", label: "Other" },
          ];

          async function handleExpenseSubmit() {
            const parsed = parseFloat(expAmount);
            if (!expAmount || isNaN(parsed) || parsed <= 0) { setExpError("Enter a valid amount."); return; }
            if (!expDesc.trim()) { setExpError("Description is required."); return; }
            setExpError(null);
            setExpSubmitting(true);
            try {
              await addExpense({
                amount: parsed,
                description: expDesc.trim(),
                memo: expMemo.trim() || null,
                category: expCategory,
                payment_method: expPayment,
              });
              setExpenseOpen(false);
            } catch { setExpError("Something went wrong."); }
            finally { setExpSubmitting(false); }
          }

          return (
            <>
              <label style={lbl}>Amount *</label>
              <input type="number" inputMode="decimal" placeholder="0.00"
                value={expAmount} onChange={(e) => setExpAmount(e.target.value)}
                style={{ ...inp, marginBottom: 14 }} />

              <label style={lbl}>Description *</label>
              <input type="text" placeholder="What was this for?"
                value={expDesc} onChange={(e) => setExpDesc(e.target.value)}
                style={{ ...inp, marginBottom: 14 }} />

              <label style={lbl}>Category</label>
              <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)}
                style={{ ...inp, marginBottom: 14 }}>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>

              <label style={lbl}>Payment Method</label>
              <div style={{ display: "flex", border: "1px solid var(--surface-border)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                {(["cash", "bank"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setExpPayment(m)} style={{
                    flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: 600, textTransform: "capitalize",
                    background: expPayment === m ? "var(--accent)" : "var(--surface)",
                    color: expPayment === m ? "var(--white)" : "var(--muted)",
                  }}>{m}</button>
                ))}
              </div>

              <label style={lbl}>Memo</label>
              <textarea placeholder="Optional note..." value={expMemo}
                onChange={(e) => setExpMemo(e.target.value)} rows={2}
                style={{ ...inp, resize: "none" as const, marginBottom: 16, fontFamily: "inherit" }} />

              {expError && (
                <div style={{
                  color: "var(--error)", fontSize: 13, marginBottom: 12, padding: "8px 12px",
                  borderRadius: 8, background: "color-mix(in srgb, var(--error) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
                }}>{expError}</div>
              )}

              <button type="button" onClick={handleExpenseSubmit} disabled={expSubmitting} style={{
                width: "100%", padding: 14, borderRadius: 12, border: "none",
                cursor: expSubmitting ? "not-allowed" : "pointer",
                fontSize: 16, fontWeight: 700, color: "var(--white)",
                background: expSubmitting ? "var(--surface)" : "var(--accent)",
                opacity: expSubmitting ? 0.5 : 1,
              }}>
                {expSubmitting ? "Saving..." : "Add Expense"}
              </button>
            </>
          );
        })()}
      </BottomSheet>
    </div>
  );
}
