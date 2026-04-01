"use client";

import { useState, ReactNode } from "react";
import { Phone as PhoneIcon } from "lucide-react";
import PhoneDetail from "@/components/PhoneDetail";
import { useData } from "@/lib/DataProvider";
import type { Phone, Transaction } from "@/lib/types";
import { formatBirr, formatDate } from "@/lib/format";

interface SellerDetailProps {
  sellerId: number;
  pushView: (content: ReactNode, title: string) => void;
  onAction: () => void;
}

function SellerPhonesList({ phones, pushView, onRefresh }: { phones: Phone[]; pushView: (content: ReactNode, title: string) => void; onRefresh: () => void }) {
  if (phones.length === 0) return <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No phones with this seller</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {phones.map((p) => {
        const aging = p.distributed_at ? Math.floor((Date.now() - new Date(p.distributed_at).getTime()) / 86400000) : null;
        return (
          <button key={p.id} onClick={() => pushView(
            <PhoneDetail phoneId={p.id} pushView={pushView} onAction={onRefresh} />,
            `${p.brand} ${p.model}`
          )} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            width: "100%", padding: "12px 14px",
            background: "var(--bg)", border: "1px solid var(--surface-border)", borderRadius: 10,
            color: "var(--white)", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left",
          }}>
            <div style={{ minWidth: 0 }}>
              <div>{p.brand} {p.model}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {[p.storage, p.color].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--white)" }}>{formatBirr(p.asking_price)}</div>
              {aging !== null && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{aging}d</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PaymentHistoryList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) return <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No payment history</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {transactions.map((t) => (
        <div key={t.id} style={{
          padding: "10px 14px", background: "var(--bg)", border: "1px solid var(--surface-border)", borderRadius: 10,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{t.description}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{formatDate(t.created_at)}</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.type === "income" ? "var(--green)" : "var(--error)" }}>
            {t.type === "income" ? "+" : "-"}{formatBirr(t.amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

function CollectPaymentForm({ phones, sellerId, onDone }: { phones: Phone[]; sellerId: number; onDone: () => void }) {
  const data = useData();
  const [mode, setMode] = useState<"per_phone" | "lump_sum">("per_phone");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [lumpAmount, setLumpAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [saving, setSaving] = useState(false);

  const togglePhone = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectedTotal = phones.filter((p) => selectedIds.includes(p.id)).reduce((s, p) => s + p.asking_price, 0);

  async function handleSubmit() {
    const amt = mode === "per_phone" ? selectedTotal : Number(lumpAmount);
    if (!confirm(`Collect ETB ${amt.toLocaleString()} via ${method}?`)) return;
    setSaving(true);
    if (mode === "per_phone") {
      await data.collectPerPhone(sellerId, selectedIds, method);
    } else {
      await data.collectLumpSum(sellerId, Number(lumpAmount), method, null);
    }
    onDone();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {(["per_phone", "lump_sum"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: 10, borderRadius: 8, border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: 13,
            background: mode === m ? "var(--accent)" : "var(--bg)",
            color: mode === m ? "var(--white)" : "var(--muted)",
          }}>{m === "per_phone" ? "Per Phone" : "Lump Sum"}</button>
        ))}
      </div>

      {mode === "per_phone" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {phones.map((p) => (
            <button key={p.id} onClick={() => togglePhone(p.id)} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              width: "100%", padding: "10px 14px",
              background: selectedIds.includes(p.id) ? "color-mix(in srgb, var(--accent) 15%, var(--bg))" : "var(--bg)",
              border: `1px solid ${selectedIds.includes(p.id) ? "var(--accent)" : "var(--surface-border)"}`,
              borderRadius: 10, color: "var(--white)", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left",
            }}>
              <div>{p.brand} {p.model}</div>
              <div style={{ color: "var(--white)" }}>{formatBirr(p.asking_price)}</div>
            </button>
          ))}
          {selectedIds.length > 0 && (
            <div style={{ padding: 10, textAlign: "center", fontSize: 14, fontWeight: 700, color: "var(--green)" }}>
              Total: {formatBirr(selectedTotal)}
            </div>
          )}
        </div>
      ) : (
        <div>
          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Amount (ETB)</label>
          <input type="number" inputMode="numeric" value={lumpAmount} onChange={(e) => setLumpAmount(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--surface-border)", background: "var(--bg)", color: "var(--white)", fontSize: 16, outline: "none", boxSizing: "border-box" }} />
        </div>
      )}

      <div>
        <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Payment Method</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["cash", "bank"] as const).map((m) => (
            <button key={m} onClick={() => setMethod(m)} style={{
              flex: 1, padding: 10, borderRadius: 8, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 14, textTransform: "capitalize",
              background: method === m ? "var(--accent)" : "var(--bg)",
              color: method === m ? "var(--white)" : "var(--muted)",
            }}>{m}</button>
          ))}
        </div>
      </div>

      <button onClick={handleSubmit} disabled={saving || (mode === "per_phone" && selectedIds.length === 0) || (mode === "lump_sum" && !lumpAmount)} style={{
        padding: 13, borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15,
        background: "var(--green)", color: "var(--white)",
        cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
      }}>
        {saving ? "Collecting..." : "Confirm Collection"}
      </button>
    </div>
  );
}

function GivePhoneForm({ sellerId, onDone }: { sellerId: number; onDone: () => void }) {
  const data = useData();
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const inStockPhones = data.phones.filter((p) => p.status === "in_stock");

  const filtered = inStockPhones.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.brand.toLowerCase().includes(q) || p.model.toLowerCase().includes(q);
  });

  async function handleGive(phoneId: number) {
    const phone = data.getPhone(phoneId);
    if (!confirm(`Give ${phone?.brand} ${phone?.model} to this seller?`)) return;
    setSaving(true);
    await data.distributePhone(phoneId, sellerId);
    onDone();
  }

  return (
    <div>
      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search phones..."
        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--surface-border)", background: "var(--bg)", color: "var(--white)", fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((p) => (
          <button key={p.id} onClick={() => !saving && handleGive(p.id)} disabled={saving} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            width: "100%", padding: "12px 14px",
            background: "var(--bg)", border: "1px solid var(--surface-border)", borderRadius: 10,
            color: "var(--white)", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", textAlign: "left",
            opacity: saving ? 0.6 : 1,
          }}>
            <div>
              <div>{p.brand} {p.model}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{[p.storage, p.color].filter(Boolean).join(" · ")}</div>
            </div>
            <div style={{ color: "var(--white)", fontSize: 14, fontWeight: 700 }}>{formatBirr(p.asking_price)}</div>
          </button>
        ))}
        {filtered.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No phones in stock</p>}
      </div>
    </div>
  );
}

export default function SellerDetail({ sellerId, pushView, onAction }: SellerDetailProps) {
  const data = useData();

  const seller = data.getSeller(sellerId);
  const sellerStats = data.getSellerStats(sellerId);
  const sellerPhones = data.phones.filter((p) => p.seller_id === sellerId && p.status === "with_seller");
  const sellerTransactions = data.transactions.filter((t) => t.seller_id === sellerId);

  if (!seller) return <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Seller not found</div>;

  const totalOwed = sellerPhones.reduce((s, p) => s + p.asking_price, 0);
  const phoneCount = sellerPhones.length;

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--white)", margin: 0 }}>{seller.name}</h2>
        {seller.location && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{seller.location}</div>}
        {seller.phone_number && (
          <a href={`tel:${seller.phone_number}`} style={{ fontSize: 13, color: "var(--accent)", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
            <PhoneIcon size={13} />{seller.phone_number}
          </a>
        )}
      </div>

      {/* Balance card */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, padding: "12px 14px", background: "var(--bg)", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Owed</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--amber)", marginTop: 4 }}>{formatBirr(totalOwed)}</div>
        </div>
        <div style={{ flex: 1, padding: "12px 14px", background: "var(--bg)", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Phones Held</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--white)", marginTop: 4 }}>{phoneCount}</div>
        </div>
      </div>

      {/* Memo */}
      {seller.memo && (
        <div style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "var(--muted)" }}>
          {seller.memo}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {phoneCount > 0 && (
          <>
            <button onClick={() => pushView(
              <SellerPhonesList phones={sellerPhones} pushView={pushView} onRefresh={onAction} />,
              "Their Phones"
            )} style={{
              padding: 13, borderRadius: 10, border: "1px solid var(--surface-border)",
              fontWeight: 700, fontSize: 15, background: "transparent", color: "var(--white)", cursor: "pointer",
            }}>
              Their Phones ({phoneCount})
            </button>
            <button onClick={() => pushView(
              <CollectPaymentForm phones={sellerPhones} sellerId={seller.id} onDone={onAction} />,
              "Collect Payment"
            )} style={{
              padding: 13, borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15,
              background: "var(--green)", color: "var(--white)", cursor: "pointer",
            }}>
              Collect Payment
            </button>
          </>
        )}
        <button onClick={() => pushView(
          <GivePhoneForm sellerId={seller.id} onDone={onAction} />,
          "Give Phone"
        )} style={{
          padding: 13, borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15,
          background: "var(--accent)", color: "var(--white)", cursor: "pointer",
        }}>
          Give Phone
        </button>
        {sellerTransactions.length > 0 && (
          <button onClick={() => pushView(
            <PaymentHistoryList transactions={sellerTransactions} />,
            "Payment History"
          )} style={{
            padding: 13, borderRadius: 10, border: "1px solid var(--surface-border)",
            fontWeight: 700, fontSize: 15, background: "transparent", color: "var(--muted)", cursor: "pointer",
          }}>
            Payment History ({sellerTransactions.length})
          </button>
        )}
      </div>
    </div>
  );
}
