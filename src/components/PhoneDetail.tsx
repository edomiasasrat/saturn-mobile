"use client";

import { useState, ReactNode } from "react";
import { Phone as PhoneIcon, Copy, Check } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { formatBirr, formatDate } from "@/lib/format";

interface PhoneDetailProps {
  phoneId: number;
  pushView: (content: ReactNode, title: string) => void;
  onAction: () => void;
}

const condLabels: Record<string, string> = { new: "New", used_good: "Used - Good", used_fair: "Used - Fair" };
const statusLabels: Record<string, string> = { in_stock: "In Stock", with_seller: "With Seller", sold: "Sold" };
const statusColors: Record<string, string> = { in_stock: "var(--green)", with_seller: "var(--amber)", sold: "var(--muted)" };

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
  const data = useData();
  const [search, setSearch] = useState("");

  const filtered = data.sellers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

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

function QuickSellForm({ phoneId, askingPrice, onDone }: { phoneId: number; askingPrice: number; onDone: () => void }) {
  const data = useData();
  const [price, setPrice] = useState(String(askingPrice));
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!confirm(`Sell for ETB ${Number(price).toLocaleString()} via ${method}?`)) return;
    setSaving(true);
    await data.quickSellPhone(phoneId, Number(price), method);
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

function CollectForm({ phoneId, sellerId, askingPrice, onDone }: { phoneId: number; sellerId: number; askingPrice: number; onDone: () => void }) {
  const data = useData();
  const [price, setPrice] = useState(String(askingPrice));
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [saving, setSaving] = useState(false);

  const actualPrice = Number(price) || 0;
  const diff = actualPrice - askingPrice;

  async function handleSubmit() {
    if (!actualPrice || actualPrice <= 0) return;
    if (!confirm(`Collect ${formatBirr(actualPrice)} via ${method}?`)) return;
    setSaving(true);
    await data.collectPerPhone(sellerId, [phoneId], method, actualPrice !== askingPrice ? actualPrice : undefined);
    onDone();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Actual Sale Price (ETB)</label>
        <input type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--surface-border)", background: "var(--bg)", color: "var(--white)", fontSize: 16, outline: "none", boxSizing: "border-box" }} />
        {diff !== 0 && (
          <div style={{ fontSize: 12, marginTop: 6, color: diff > 0 ? "var(--green)" : "var(--error)", fontWeight: 600 }}>
            {diff > 0 ? "+" : ""}{formatBirr(diff)} vs asking price
          </div>
        )}
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
        {saving ? "Collecting..." : `Collect ${formatBirr(actualPrice)}`}
      </button>
    </div>
  );
}

function EditPhoneForm({ phoneId, onDone }: { phoneId: number; onDone: () => void }) {
  const data = useData();
  const phone = data.getPhone(phoneId);
  const [brand, setBrand] = useState(phone?.brand || "");
  const [model, setModel] = useState(phone?.model || "");
  const [imei, setImei] = useState(phone?.imei || "");
  const [storage, setStorage] = useState(phone?.storage || "");
  const [color, setColor] = useState(phone?.color || "");
  const [condition, setCondition] = useState<"new" | "used_good" | "used_fair">(phone?.condition || "new");
  const [costPrice, setCostPrice] = useState(String(phone?.cost_price || 0));
  const [askingPrice, setAskingPrice] = useState(String(phone?.asking_price || 0));
  const [memo, setMemo] = useState(phone?.memo || "");
  const [saving, setSaving] = useState(false);

  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid var(--surface-border)", background: "var(--bg)",
    color: "var(--white)", fontSize: 15, outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)",
    marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em",
  };

  async function handleSave() {
    if (!brand.trim() || !model.trim()) return;
    setSaving(true);
    await data.updatePhone(phoneId, {
      brand: brand.trim(), model: model.trim(),
      imei: imei.trim() || null, storage: storage.trim() || null,
      color: color.trim() || null, condition,
      cost_price: Number(costPrice) || 0, asking_price: Number(askingPrice) || 0,
      memo: memo.trim() || null,
    });
    onDone();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div><label style={lbl}>Brand *</label><input value={brand} onChange={(e) => setBrand(e.target.value)} style={inp} /></div>
      <div><label style={lbl}>Model *</label><input value={model} onChange={(e) => setModel(e.target.value)} style={inp} /></div>
      <div><label style={lbl}>IMEI</label><input value={imei} onChange={(e) => setImei(e.target.value)} style={inp} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Storage</label><input value={storage} onChange={(e) => setStorage(e.target.value)} style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Color</label><input value={color} onChange={(e) => setColor(e.target.value)} style={inp} /></div>
      </div>
      <div>
        <label style={lbl}>Condition</label>
        <select value={condition} onChange={(e) => setCondition(e.target.value as "new" | "used_good" | "used_fair")} style={inp}>
          <option value="new">New</option>
          <option value="used_good">Used - Good</option>
          <option value="used_fair">Used - Fair</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Cost Price</label><input type="number" inputMode="numeric" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Asking Price</label><input type="number" inputMode="numeric" value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} style={inp} /></div>
      </div>
      <div><label style={lbl}>Memo</label><textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} style={{ ...inp, resize: "none", fontFamily: "inherit" }} /></div>
      <button onClick={handleSave} disabled={saving} style={{
        padding: 13, borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15,
        background: "var(--accent)", color: "var(--white)", cursor: saving ? "not-allowed" : "pointer",
        opacity: saving ? 0.6 : 1,
      }}>
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}

export default function PhoneDetail({ phoneId, pushView, onAction }: PhoneDetailProps) {
  const data = useData();
  const [copied, setCopied] = useState(false);

  const phone = data.getPhone(phoneId);
  const sellerName = phone?.seller_id ? data.getSeller(phone.seller_id)?.name ?? null : null;

  if (!phone) return <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Phone not found</div>;

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
        {row("Asking Price", formatBirr(phone.asking_price), "var(--white)")}
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

      {/* Edit button — available for non-sold items */}
      {phone.status !== "sold" && (
        <div style={{ marginBottom: 8 }}>
          <button onClick={() => pushView(
            <EditPhoneForm phoneId={phone.id} onDone={onAction} />,
            "Edit Phone"
          )} style={{
            width: "100%", padding: 13, borderRadius: 10, border: "1px solid var(--surface-border)",
            fontWeight: 700, fontSize: 15, background: "transparent", color: "var(--accent)", cursor: "pointer",
          }}>
            Edit Details
          </button>
        </div>
      )}

      {/* Delete sold items */}
      {phone.status === "sold" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={async () => {
            if (!confirm(`Delete sold item ${phone.brand} ${phone.model}?`)) return;
            await data.deletePhone(phone.id);
            onAction();
          }} style={{
            padding: 10, borderRadius: 10, border: "1px solid var(--surface-border)",
            fontWeight: 600, fontSize: 13, background: "transparent", color: "var(--error)", cursor: "pointer",
          }}>
            Delete
          </button>
        </div>
      )}

      {phone.status === "in_stock" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => pushView(
            <SellerPicker onPick={async (sid) => {
              const seller = data.getSeller(sid);
              if (!confirm(`Give ${phone.brand} ${phone.model} to ${seller?.name || "this seller"}?`)) return;
              await data.distributePhone(phone.id, sid);
              onAction();
            }} />,
            "Give to Seller"
          )} style={{
            padding: 13, borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15,
            background: "var(--accent)", color: "var(--white)", cursor: "pointer",
          }}>
            Give to Seller
          </button>
          <button onClick={() => pushView(
            <QuickSellForm phoneId={phone.id} askingPrice={phone.asking_price} onDone={onAction} />,
            "Quick Sell"
          )} style={{
            padding: 13, borderRadius: 10, border: "1px solid var(--surface-border)",
            fontWeight: 700, fontSize: 15, background: "transparent", color: "var(--white)", cursor: "pointer",
          }}>
            Quick Sell
          </button>
          <button onClick={async () => {
            if (!confirm("Delete this phone?")) return;
            await data.deletePhone(phone.id);
            onAction();
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
            <CollectForm phoneId={phone.id} sellerId={phone.seller_id!} askingPrice={phone.asking_price} onDone={onAction} />,
            "Collect Payment"
          )} style={{
            padding: 13, borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15,
            background: "var(--green)", color: "var(--white)", cursor: "pointer",
          }}>
            Collect Payment
          </button>
          <button onClick={async () => {
            if (!confirm(`Return ${phone.brand} ${phone.model} to stock?`)) return;
            await data.returnPhone(phone.id);
            onAction();
          }} style={{
            padding: 13, borderRadius: 10, border: "1px solid var(--surface-border)",
            fontWeight: 700, fontSize: 15, background: "transparent", color: "var(--white)", cursor: "pointer",
          }}>
            Return to Stock
          </button>
          {phone.seller_id && data.getSeller(phone.seller_id)?.phone_number && (
            <a href={`tel:${data.getSeller(phone.seller_id)?.phone_number}`} style={{
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
