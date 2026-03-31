"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { Phone as PhoneIcon } from "lucide-react";
import PhoneDetail from "@/components/PhoneDetail";
import type { SellerWithStats, Phone, Transaction } from "@/lib/types";
import { formatBirr, formatDate } from "@/lib/format";

interface SellerDetailProps {
  sellerId: number;
  pushView: (content: ReactNode, title: string) => void;
  onAction: () => void;
}

/* ─── Shared style helpers ─── */

const btnBase = {
  padding: 13,
  borderRadius: 10,
  fontWeight: 700 as const,
  fontSize: 15,
  cursor: "pointer" as const,
  border: "none" as const,
  width: "100%" as const,
};

const outlineBtn = {
  ...btnBase,
  background: "transparent",
  border: "1px solid var(--surface-border)",
  color: "var(--white)",
};

const methodToggle = (active: boolean) => ({
  flex: 1,
  padding: 10,
  borderRadius: 8,
  border: "none" as const,
  cursor: "pointer" as const,
  fontWeight: 600 as const,
  fontSize: 14,
  textTransform: "capitalize" as const,
  background: active ? "var(--accent)" : "var(--bg)",
  color: active ? "var(--white)" : "var(--muted)",
});

/* ─── Sub-view: Their Phones ─── */

function SellerPhonesList({
  sellerId,
  pushView,
  onRefresh,
}: {
  sellerId: number;
  pushView: (content: ReactNode, title: string) => void;
  onRefresh: () => void;
}) {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/phones?seller_id=${sellerId}&status=with_seller`);
    if (res.ok) {
      const data = await res.json();
      setPhones(Array.isArray(data) ? data : data.phones || []);
    }
    setLoading(false);
  }, [sellerId]);

  useEffect(() => { load(); }, [load]);

  async function handleReturn(phoneId: number) {
    setReturning(phoneId);
    await fetch(`/api/phones/${phoneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "return" }),
    });
    setReturning(null);
    await load();
    onRefresh();
  }

  if (loading) return <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Loading...</div>;
  if (phones.length === 0) return <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No phones with this seller</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {phones.map((p) => {
        const days = p.distributed_at
          ? Math.floor((Date.now() - new Date(p.distributed_at).getTime()) / 86400000)
          : null;
        return (
          <div key={p.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 14px", background: "var(--bg)",
            border: "1px solid var(--surface-border)", borderRadius: 10,
          }}>
            <div
              style={{ flex: 1, cursor: "pointer" }}
              onClick={() =>
                pushView(
                  <PhoneDetail
                    phoneId={p.id}
                    pushView={pushView}
                    onAction={() => { load(); onRefresh(); }}
                  />,
                  `${p.brand} ${p.model}`
                )
              }
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>
                {p.brand} {p.model}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {formatBirr(p.asking_price)}
                {days !== null && <span style={{ marginLeft: 8, color: "var(--accent)" }}>{days}d</span>}
              </div>
            </div>
            <button
              onClick={() => handleReturn(p.id)}
              disabled={returning === p.id}
              style={{
                padding: "6px 12px", borderRadius: 8, border: "1px solid var(--surface-border)",
                background: "transparent", color: "var(--accent)", fontSize: 12, fontWeight: 600,
                cursor: returning === p.id ? "not-allowed" : "pointer",
                opacity: returning === p.id ? 0.6 : 1,
              }}
            >
              {returning === p.id ? "..." : "Return"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Sub-view: Payment History ─── */

function PaymentHistoryList({ transactions }: { transactions: Transaction[] }) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (sorted.length === 0)
    return <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No payment history</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sorted.map((t) => (
        <div key={t.id} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 14px", background: "var(--bg)",
          border: "1px solid var(--surface-border)", borderRadius: 10,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{t.description}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{formatDate(t.created_at)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>
              +{formatBirr(t.amount)}
            </span>
            {t.payment_method && (
              <span style={{
                padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                textTransform: "uppercase",
                background: t.payment_method === "cash" ? "var(--bg)" : "color-mix(in srgb, var(--accent) 15%, transparent)",
                color: t.payment_method === "cash" ? "var(--muted)" : "var(--accent)",
                border: t.payment_method === "cash" ? "1px solid var(--surface-border)" : "none",
              }}>
                {t.payment_method}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Sub-view: Collect Payment ─── */

function CollectPaymentForm({
  sellerId,
  phones,
  onDone,
}: {
  sellerId: number;
  phones: Phone[];
  onDone: () => void;
}) {
  const [tab, setTab] = useState<"per_phone" | "lump_sum">("per_phone");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [saving, setSaving] = useState(false);

  // Lump sum state
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const total = phones
    .filter((p) => selectedIds.includes(p.id))
    .reduce((s, p) => s + p.asking_price, 0);

  function togglePhone(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    setSaving(true);
    if (tab === "per_phone") {
      if (selectedIds.length === 0) { setSaving(false); return; }
      await fetch(`/api/sellers/${sellerId}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "per_phone", phone_ids: selectedIds, payment_method: method }),
      });
    } else {
      if (!amount) { setSaving(false); return; }
      await fetch(`/api/sellers/${sellerId}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "lump_sum", amount: Number(amount), payment_method: method, memo }),
      });
    }
    setSaving(false);
    onDone();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Tab toggle */}
      <div style={{ display: "flex", gap: 0, borderRadius: 10, overflow: "hidden", border: "1px solid var(--surface-border)" }}>
        {(["per_phone", "lump_sum"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: 10, border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: 13,
            background: tab === t ? "var(--accent)" : "var(--bg)",
            color: tab === t ? "var(--white)" : "var(--muted)",
          }}>
            {t === "per_phone" ? "Per Phone" : "Lump Sum"}
          </button>
        ))}
      </div>

      {tab === "per_phone" ? (
        <>
          {phones.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No phones to collect for</div>
          )}
          {phones.map((p) => (
            <label key={p.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", background: "var(--bg)",
              border: "1px solid var(--surface-border)", borderRadius: 10,
              cursor: "pointer",
            }}>
              <input
                type="checkbox"
                checked={selectedIds.includes(p.id)}
                onChange={() => togglePhone(p.id)}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>
                  {p.brand} {p.model}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {formatBirr(p.asking_price)}
                </div>
              </div>
            </label>
          ))}
          {selectedIds.length > 0 && (
            <div style={{ padding: 14, background: "var(--bg)", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Total</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--green)", marginTop: 4 }}>{formatBirr(total)}</div>
            </div>
          )}
        </>
      ) : (
        <>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Amount (ETB)</label>
            <input
              type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--surface-border)", background: "var(--bg)", color: "var(--white)", fontSize: 16, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Memo</label>
            <textarea
              value={memo} onChange={(e) => setMemo(e.target.value)}
              placeholder="Optional note..."
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--surface-border)", background: "var(--bg)", color: "var(--white)", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
        </>
      )}

      {/* Payment method */}
      <div>
        <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Payment Method</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["cash", "bank"] as const).map((m) => (
            <button key={m} onClick={() => setMethod(m)} style={methodToggle(method === m)}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleSubmit} disabled={saving} style={{
        ...btnBase,
        background: "var(--green)", color: "var(--white)",
        opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer",
      }}>
        {saving
          ? "Collecting..."
          : tab === "per_phone"
            ? `Collect ${formatBirr(total)}`
            : `Collect ${formatBirr(Number(amount) || 0)}`}
      </button>
    </div>
  );
}

/* ─── Sub-view: Give Phone ─── */

function GivePhoneForm({
  sellerId,
  onDone,
}: {
  sellerId: number;
  onDone: () => void;
}) {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/phones?status=in_stock")
      .then((r) => r.json())
      .then((data) => {
        setPhones(Array.isArray(data) ? data : data.phones || []);
        setLoading(false);
      });
  }, []);

  const filtered = phones.filter(
    (p) =>
      p.brand.toLowerCase().includes(search.toLowerCase()) ||
      p.model.toLowerCase().includes(search.toLowerCase())
  );

  async function handleGive(phoneId: number) {
    setAssigning(phoneId);
    await fetch(`/api/phones/${phoneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "distribute", seller_id: sellerId }),
    });
    setAssigning(null);
    onDone();
  }

  if (loading) return <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Loading...</div>;

  return (
    <div>
      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search phones..."
        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--surface-border)", background: "var(--bg)", color: "var(--white)", fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" }}
      />
      {filtered.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No in-stock phones found</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => handleGive(p.id)}
            disabled={assigning === p.id}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              width: "100%", padding: "12px 14px",
              background: "var(--bg)", border: "1px solid var(--surface-border)", borderRadius: 10,
              color: "var(--white)", cursor: assigning === p.id ? "not-allowed" : "pointer",
              textAlign: "left", opacity: assigning === p.id ? 0.6 : 1,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.brand} {p.model}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {formatBirr(p.asking_price)}
                {p.storage && <span style={{ marginLeft: 8 }}>{p.storage}</span>}
              </div>
            </div>
            <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>
              {assigning === p.id ? "..." : "Give"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function SellerDetail({ sellerId, pushView, onAction }: SellerDetailProps) {
  const [seller, setSeller] = useState<SellerWithStats | null>(null);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/sellers/${sellerId}`);
    if (!res.ok) return;
    const data = await res.json();
    setSeller(data.seller);
    setPhones(data.phones || []);
    setTransactions(data.transactions || []);
  }, [sellerId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = useCallback(async () => {
    await loadData();
    onAction();
  }, [loadData, onAction]);

  if (!seller) return <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Loading...</div>;

  const withSellerPhones = phones.filter((p) => p.status === "with_seller");

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--white)", margin: 0 }}>
          {seller.name}
        </h2>
        {seller.location && (
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{seller.location}</div>
        )}
        {seller.phone_number && (
          <a href={`tel:${seller.phone_number}`} style={{
            fontSize: 13, color: "var(--accent)", marginTop: 4, display: "inline-block", textDecoration: "none",
          }}>
            <PhoneIcon size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
            {seller.phone_number}
          </a>
        )}
      </div>

      {/* Balance card */}
      <div style={{
        padding: 16, background: "var(--bg)", borderRadius: 12,
        border: "1px solid var(--surface-border)", marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Owed</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", marginTop: 4 }}>
              {formatBirr(seller.total_owed)}
            </div>
          </div>
          <div style={{ width: 1, background: "var(--surface-border)" }} />
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Phones</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--white)", marginTop: 4 }}>
              {seller.phones_held}
            </div>
          </div>
          <div style={{ width: 1, background: "var(--surface-border)" }} />
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Collected</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)", marginTop: 4 }}>
              {formatBirr(seller.total_collected)}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() =>
            pushView(
              <CollectPaymentForm
                sellerId={sellerId}
                phones={withSellerPhones}
                onDone={handleAction}
              />,
              "Collect Payment"
            )
          }
          style={{ ...btnBase, flex: 1, background: "var(--green)", color: "var(--white)" }}
        >
          Collect Payment
        </button>
        <button
          onClick={() =>
            pushView(
              <GivePhoneForm sellerId={sellerId} onDone={handleAction} />,
              "Give Phone"
            )
          }
          style={{ ...btnBase, flex: 1, background: "var(--accent)", color: "var(--white)" }}
        >
          Give Phone
        </button>
        {seller.phone_number && (
          <a href={`tel:${seller.phone_number}`} style={{
            ...outlineBtn, flex: 0, padding: "13px 16px", textAlign: "center",
            textDecoration: "none", display: "flex", alignItems: "center",
          }}>
            <PhoneIcon size={16} />
          </a>
        )}
      </div>

      {/* Navigation buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={() =>
            pushView(
              <SellerPhonesList
                sellerId={sellerId}
                pushView={pushView}
                onRefresh={handleAction}
              />,
              "Their Phones"
            )
          }
          style={{
            ...outlineBtn,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <span>Their Phones</span>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>{seller.phones_held} phones &rarr;</span>
        </button>
        <button
          onClick={() =>
            pushView(
              <PaymentHistoryList transactions={transactions} />,
              "Payment History"
            )
          }
          style={{
            ...outlineBtn,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <span>Payment History</span>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>{transactions.length} entries &rarr;</span>
        </button>
      </div>
    </div>
  );
}
