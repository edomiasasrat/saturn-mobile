"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import { formatBirr } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

const periods = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [period, setPeriod] = useState("today");

  const load = useCallback(async () => {
    const res = await fetch(`/api/dashboard?period=${period}`);
    const data = await res.json();
    setStats(data);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      {/* Header */}
      <div style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--surface-border)",
        padding: "16px 16px 14px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--white)" }}>
            🪐 Saturn Mobile
          </h1>
        </div>
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
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Capital</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: "var(--success)" }}>
            {stats ? formatBirr(stats.total_capital) : "—"}
          </span>
        </div>
      </div>

      <div style={{ padding: "12px 16px" }}>
        {/* Period filter */}
        <div style={{
          display: "flex",
          gap: 6,
          marginBottom: 14,
        }}>
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
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Link href="/inventory" style={{ textDecoration: "none" }}>
              <StatCard label="Phones" value={String(stats.phones_in_stock)} />
            </Link>
            <Link href="/inventory" style={{ textDecoration: "none" }}>
              <StatCard label="Inventory" value={formatBirr(stats.inventory_value_selling)} />
            </Link>
            <Link href="/transactions" style={{ textDecoration: "none" }}>
              <StatCard label="Income" value={formatBirr(stats.total_income)} accent="success" />
            </Link>
            <Link href="/transactions" style={{ textDecoration: "none" }}>
              <StatCard label="Expenses" value={formatBirr(stats.total_expenses)} accent="danger" />
            </Link>
            <Link href="/transactions" style={{ textDecoration: "none" }}>
              <StatCard label="Net Profit" value={formatBirr(stats.net_profit)} accent={stats.net_profit >= 0 ? "success" : "danger"} />
            </Link>
            <Link href="/bank" style={{ textDecoration: "none" }}>
              <StatCard label="Bank" value={formatBirr(stats.bank_balance)} />
            </Link>
            <Link href="/debts" style={{ textDecoration: "none" }}>
              <StatCard label="Owed to Me" value={formatBirr(stats.total_owed_to_me)} accent="success" />
            </Link>
            <Link href="/debts" style={{ textDecoration: "none" }}>
              <StatCard label="I Owe" value={formatBirr(stats.total_i_owe)} accent="danger" />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
