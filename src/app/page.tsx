"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import { formatBirr } from "@/lib/format";
import type { DashboardStats, SellerWithStats } from "@/lib/types";

const periods = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topSellers, setTopSellers] = useState<SellerWithStats[]>([]);
  const [period, setPeriod] = useState("today");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?period=${period}`);
      if (!res.ok) throw new Error();
      const data: { stats: DashboardStats; topSellers: SellerWithStats[] } = await res.json();
      setStats(data.stats);
      setTopSellers(data.topSellers ?? []);
    } catch {
      // keep previous data
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

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
            {stats ? formatBirr(stats.total_capital) : "\u2014"}
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
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Link href="/stock" style={{ textDecoration: "none" }}>
              <StatCard label="In Stock" value={String(stats.phones_in_stock)} />
            </Link>
            <Link href="/sellers" style={{ textDecoration: "none" }}>
              <StatCard label="With Sellers" value={String(stats.phones_with_sellers)} />
            </Link>
            <Link href="/sellers" style={{ textDecoration: "none" }}>
              <StatCard label="Money Out" value={formatBirr(stats.money_out_there)} color="var(--accent)" />
            </Link>
            <Link href="/stock" style={{ textDecoration: "none" }}>
              <StatCard label="Stock Value" value={formatBirr(stats.stock_value)} />
            </Link>
            <Link href="/transactions" style={{ textDecoration: "none" }}>
              <StatCard label="Collections" value={formatBirr(stats.total_collections)} color="var(--green)" />
            </Link>
            <Link href="/transactions" style={{ textDecoration: "none" }}>
              <StatCard label="Expenses" value={formatBirr(stats.total_expenses)} color="var(--error)" />
            </Link>
            <Link href="/bank" style={{ textDecoration: "none" }}>
              <StatCard label="Bank" value={formatBirr(stats.bank_balance)} />
            </Link>
            <Link href="/transactions" style={{ textDecoration: "none" }}>
              <StatCard label="Profit" value={formatBirr(stats.net_profit)} color={stats.net_profit >= 0 ? "var(--green)" : "var(--error)"} />
            </Link>
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
                <Link key={seller.id} href={`/sellers/${seller.id}`} style={{ textDecoration: "none" }}>
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
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
