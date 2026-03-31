"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { Phone as PhoneIcon, Copy, Check } from "lucide-react";
import type { Phone, Seller } from "@/lib/types";
import { formatBirr, formatDate } from "@/lib/format";

interface PhoneDetailProps {
  phoneId: number;
  pushView: (content: ReactNode, title: string) => void;
  onAction: () => void;
}

const condLabels: Record<string, string> = { new: "New", used_good: "Used - Good", used_fair: "Used - Fair" };
const statusLabels: Record<string, string> = { in_stock: "In Stock", with_seller: "With Seller", sold: "Sold" };
const statusColors: Record<string, string> = { in_stock: "var(--green)", with_seller: "var(--accent)", sold: "var(--muted)" };

const row = (label: string, value: string | null | undefined, color?: string) => {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--surface-border)" }}>
      <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: color || "var(--white)" }}>{value}</span>
    </div>
  );
};

function SellerPicker({ onPick }: { onPick: (sellerId: number) => void }) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/sellers").then((r) => r.json()).then(setSellers);
  }, []);

  const filtered = sellers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search sellers..."
        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--surface-border)", background: "var(--bg)", color: "var(--white)", fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" }}
      />
      {filtered.map((s) => (
        <button key={s.id} onClick={() => onPick(s.id)} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          width: "100%", padding: "12px 14px", marginBottom: 6,
          background: "var(--bg)", border: "1px solid var(--surface-border)", borderRadius: 10,
          color: "var(--white)", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left",
        }}>
          <div>
            <div>{s.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.location}</div>
          </div>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>→</span>
        </button>
      ))}
      {filtered.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No sellers found</p>}
    </div>
  );
}

function QuickSellForm({ phone, onDone }: { phone: Phone; onDone: () => void }) {
  const [price, setPrice] = useState(String(phone.asking_price));
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    await fetch(`/api/phones/${phone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "quick_sell", price: Number(price), payment_method: method }),
    });
    onDone();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Selling Price (ETB)</label>
        <input type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--surface-border)", background: "var(--bg)", color: "var(--white)", fontSize: 16, outline: "none", boxSizing: "border-box" }} />
      </div>
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
      <button onClick={handleSubmit} disabled={saving} style={{
        padding: 13, borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15,
        background: "var(--green)", color: "var(--white)", cursor: saving ? "not-allowed" : "pointer",
        opacity: saving ? 0.6 : 1,
      }}>
        {saving ? "Selling..." : `Sell for ${formatBirr(Number(price) || 0)}`}
      </button>
    </div>
  );
}

function CollectForm({ phone, onDone }: { phone: Phone; onDone: () => void }) {
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!phone.seller_id) return;
    setSaving(true);
    await fetch(`/api/sellers/${phone.seller_id}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "per_phone", phone_ids: [phone.id], payment_method: method }),
    });
    onDone();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ padding: 14, background: "var(--bg)", borderRadius: 10, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Collection Amount</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)", marginTop: 4 }}>{formatBirr(phone.asking_price)}</div>
      </div>
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
      <button onClick={handleSubmit} disabled={saving} style={{
        padding: 13, borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15,
        background: "var(--green)", color: "var(--white)", cursor: saving ? "not-allowed" : "pointer",
        opacity: saving ? 0.6 : 1,
      }}>
        {saving ? "Collecting..." : "Confirm Collection"}
      </button>
    </div>
  );
}

export default function PhoneDetail({ phoneId, pushView, onAction }: PhoneDetailProps) {
  const [phone, setPhone] = useState<Phone | null>(null);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadPhone = useCallback(async () => {
    const res = await fetch(`/api/phones/${phoneId}`);
    if (!res.ok) return;
    const p: Phone = await res.json();
    setPhone(p);
    if (p.seller_id) {
      const sRes = await fetch(`/api/sellers/${p.seller_id}`);
      if (sRes.ok) {
        const data = await sRes.json();
        setSellerName(data.seller?.name || data.name || null);
      }
    }
  }, [phoneId]);

  useEffect(() => { loadPhone(); }, [loadPhone]);

  const handleAction = useCallback(async () => {
    await loadPhone();
    onAction();
  }, [loadPhone, onAction]);

  if (!phone) return <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Loading...</div>;

  const aging = phone.distributed_at ? Math.floor((Date.now() - new Date(phone.distributed_at).getTime()) / 86400000) : null;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--white)", margin: 0 }}>
          {phone.brand} {phone.model}
        </h2>
        <span style={{
          display: "inline-block", marginTop: 6, padding: "3px 10px", borderRadius: 8,
          fontSize: 12, fontWeight: 600,
          color: statusColors[phone.status], background: `color-mix(in srgb, ${statusColors[phone.status]} 15%, transparent)`,
        }}>
          {statusLabels[phone.status]}
        </span>
        {aging !== null && (
          <span style={{
            display: "inline-block", marginLeft: 8, padding: "3px 10px", borderRadius: 8,
            fontSize: 12, fontWeight: 600, color: "var(--amber, var(--error))",
            background: "var(--amber-dim, var(--error-dim))",
          }}>
            {aging}d with seller
          </span>
        )}
      </div>

      {phone.status === "with_seller" && sellerName && (
        <div style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: 10, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>With Seller</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--white)", marginTop: 2 }}>{sellerName}</div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        {phone.imei && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--surface-border)" }}>
            <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>IMEI</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{phone.imei}</span>
              <button onClick={() => { navigator.clipboard.writeText(phone.imei!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 2 }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}
        {row("Storage", phone.storage)}
        {row("Color", phone.color)}
        {row("Condition", condLabels[phone.condition])}
        {row("Cost Price", formatBirr(phone.cost_price))}
        {row("Asking Price", formatBirr(phone.asking_price), "var(--accent)")}
        {row("Profit Margin", formatBirr(phone.asking_price - phone.cost_price), phone.asking_price > phone.cost_price ? "var(--green)" : "var(--error)")}
        {row("Added", formatDate(phone.created_at))}
        {phone.distributed_at && row("Distributed", formatDate(phone.distributed_at))}
        {phone.sold_at && row("Sold", formatDate(phone.sold_at))}
      </div>

      {phone.memo && (
        <div style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "var(--muted)" }}>
          {phone.memo}
        </div>
      )}

      {phone.status === "in_stock" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => pushView(
            <SellerPicker onPick={async (sid) => {
              await fetch(`/api/phones/${phone.id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "distribute", seller_id: sid }),
              });
              handleAction();
            }} />,
            "Give to Seller"
          )} style={{
            padding: 13, borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15,
            background: "var(--accent)", color: "var(--white)", cursor: "pointer",
          }}>
            Give to Seller
          </button>
          <button onClick={() => pushView(
            <QuickSellForm phone={phone} onDone={handleAction} />,
            "Quick Sell"
          )} style={{
            padding: 13, borderRadius: 10, border: "1px solid var(--surface-border)",
            fontWeight: 700, fontSize: 15, background: "transparent", color: "var(--white)", cursor: "pointer",
          }}>
            Quick Sell
          </button>
          <button onClick={async () => {
            if (!confirm("Delete this phone?")) return;
            await fetch(`/api/phones/${phone.id}`, { method: "DELETE" });
            handleAction();
          }} style={{
            padding: 10, borderRadius: 10, border: "1px solid var(--surface-border)",
            fontWeight: 600, fontSize: 13, background: "transparent", color: "var(--error)", cursor: "pointer",
          }}>
            Delete
          </button>
        </div>
      )}

      {phone.status === "with_seller" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => pushView(
            <CollectForm phone={phone} onDone={handleAction} />,
            "Collect Payment"
          )} style={{
            padding: 13, borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15,
            background: "var(--green)", color: "var(--white)", cursor: "pointer",
          }}>
            Collect Payment
          </button>
          <button onClick={async () => {
            await fetch(`/api/phones/${phone.id}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "return" }),
            });
            handleAction();
          }} style={{
            padding: 13, borderRadius: 10, border: "1px solid var(--surface-border)",
            fontWeight: 700, fontSize: 15, background: "transparent", color: "var(--white)", cursor: "pointer",
          }}>
            Return to Stock
          </button>
          {phone.seller_id && (
            <a href={`tel:${sellerName}`} style={{
              padding: 10, borderRadius: 10, border: "1px solid var(--surface-border)",
              fontWeight: 600, fontSize: 13, background: "transparent", color: "var(--accent)",
              cursor: "pointer", textAlign: "center", textDecoration: "none", display: "block",
            }}>
              <PhoneIcon size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />Call Seller
            </a>
          )}
        </div>
      )}
    </div>
  );
}
