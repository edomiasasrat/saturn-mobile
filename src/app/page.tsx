"use client";

import { useState, ReactNode } from "react";
import StatCard from "@/components/StatCard";
import ModalDrilldown from "@/components/ModalDrilldown";
import PhoneDetail from "@/components/PhoneDetail";
import SellerDetail from "@/components/SellerDetail";
import { formatBirr, formatDate } from "@/lib/format";
import { useData } from "@/lib/DataProvider";
import type { Phone, Transaction, BankEntry, SellerWithStats } from "@/lib/types";

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
type ModalType = "phone" | "transaction" | "bank" | "seller" | null;

export default function Dashboard() {
  const { getDashboardStats, getTopSellers, phones, transactions, bankEntries, loading, refresh } = useData();

  const [period, setPeriod] = useState("today");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalItems, setModalItems] = useState<any[]>([]);
  const [modalIndex, setModalIndex] = useState(0);

  // Seller modal (separate instance for top sellers)
  const [sellerModalOpen, setSellerModalOpen] = useState(false);
  const [sellerList, setSellerList] = useState<SellerWithStats[]>([]);
  const [sellerIndex, setSellerIndex] = useState(0);

  // Computed instantly from context
  const stats = getDashboardStats(period);
  const topSellers = getTopSellers();

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

  function openBankModal() {
    if (bankEntries.length === 0) return;
    setModalType("bank");
    setModalItems(bankEntries);
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

  function renderContent(item: any, pushView: (content: ReactNode, title: string) => void): ReactNode {
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

    if (modalType === "bank") {
      const entry = item as BankEntry;
      const isDeposit = entry.type === "deposit";
      return (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--white)", margin: "0 0 16px" }}>
            {isDeposit ? "Bank Deposit" : "Bank Withdrawal"}
          </h2>
          <div style={{ marginBottom: 16 }}>
            {detailRow("Type", isDeposit ? "Deposit" : "Withdrawal")}
            {detailRow("Amount", formatBirr(entry.amount), isDeposit ? "var(--green)" : "var(--error)")}
            {entry.memo && detailRow("Memo", entry.memo)}
            {detailRow("Balance After", formatBirr(entry.balance_after))}
            {detailRow("Date", formatDate(entry.created_at))}
          </div>
        </div>
      );
    }

    return null;
  }

  function renderSellerContent(item: any, pushView: (content: ReactNode, title: string) => void): ReactNode {
    const seller = item as SellerWithStats;
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
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--white)", margin: 0 }}>
          Saturn Mobile
        </h1>
        <div style={{
          marginTop: 12,
          background: "var(--bg)",
          border: "1px solid var(--surface-border)",
          borderRadius: "var(--radius)",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Total Capital
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
            {loading ? "\u2014" : formatBirr(stats.total_capital)}
          </span>
        </div>
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
              <StatCard label="Money Out" value={formatBirr(stats.money_out_there)} color="var(--accent)" />
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
            <div onClick={() => openBankModal()} style={{ cursor: "pointer" }}>
              <StatCard label="Bank" value={formatBirr(stats.bank_balance)} />
            </div>
            <div onClick={() => openTransactionModal()} style={{ cursor: "pointer" }}>
              <StatCard label="Profit" value={formatBirr(stats.net_profit)} color={stats.net_profit >= 0 ? "var(--green)" : "var(--error)"} />
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
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
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
    </div>
  );
}
