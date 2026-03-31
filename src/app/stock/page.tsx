"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import BottomSheet from "@/components/BottomSheet";
import FAB from "@/components/FAB";
import { formatBirr } from "@/lib/format";
import type { Phone } from "@/lib/types";

type Condition = "new" | "used_good" | "used_fair";

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "used_good", label: "Used - Good" },
  { value: "used_fair", label: "Used - Fair" },
];

const SEEDS = [
  { brand: "Samsung", model: "Galaxy A54", imei: "354123098765432", storage: "128GB", color: "Black", condition: "used_good", cost_price: 12000, asking_price: 15000, memo: "Minor scratch on back" },
  { brand: "Apple", model: "iPhone 13", imei: "356789012345678", storage: "128GB", color: "White", condition: "used_good", cost_price: 28000, asking_price: 34000, memo: "Battery health 89%" },
  { brand: "Tecno", model: "Spark 10 Pro", imei: "352468013579024", storage: "256GB", color: "Blue", condition: "new", cost_price: 8000, asking_price: 10500, memo: null },
  { brand: "Samsung", model: "Galaxy S23", imei: "359876543210987", storage: "256GB", color: "Green", condition: "new", cost_price: 42000, asking_price: 50000, memo: "Sealed box" },
  { brand: "Xiaomi", model: "Redmi Note 12", imei: "351234567890123", storage: "128GB", color: "Black", condition: "used_fair", cost_price: 6500, asking_price: 8500, memo: "Screen replaced" },
] as const;

const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  used_good: "Used - Good",
  used_fair: "Used - Fair",
};

export default function StockPage() {
  const router = useRouter();
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const seededRef = useRef(false);

  // Form state
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [imei, setImei] = useState("");
  const [storage, setStorage] = useState("");
  const [color, setColor] = useState("");
  const [condition, setCondition] = useState<Condition>("new");
  const [costPrice, setCostPrice] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchPhones = useCallback(async (skipSeed = false) => {
    setLoading(true);
    try {
      const res = await fetch("/api/phones?status=in_stock");
      if (!res.ok) throw new Error();
      const data: Phone[] = await res.json();

      if (!skipSeed && !seededRef.current && data.length === 0) {
        seededRef.current = true;
        await Promise.all(
          SEEDS.map((p) =>
            fetch("/api/phones", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(p),
            })
          )
        );
        await fetchPhones(true);
        return;
      }
      setPhones(data);
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPhones(); }, [fetchPhones]);

  const filtered = phones.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.brand.toLowerCase().includes(q) ||
      p.model.toLowerCase().includes(q) ||
      (p.imei && p.imei.toLowerCase().includes(q))
    );
  });

  const resetForm = () => {
    setBrand(""); setModel(""); setImei(""); setStorage("");
    setColor(""); setCondition("new"); setCostPrice("");
    setAskingPrice(""); setMemo(""); setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!brand.trim()) return setFormError("Brand is required.");
    if (!model.trim()) return setFormError("Model is required.");
    if (!condition) return setFormError("Condition is required.");
    const cost = parseFloat(costPrice);
    const asking = parseFloat(askingPrice);
    if (!costPrice || isNaN(cost) || cost < 0) return setFormError("Enter a valid cost price.");
    if (!askingPrice || isNaN(asking) || asking < 0) return setFormError("Enter a valid asking price.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/phones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: brand.trim(),
          model: model.trim(),
          imei: imei.trim() || null,
          storage: storage.trim() || null,
          color: color.trim() || null,
          condition,
          cost_price: cost,
          asking_price: asking,
          memo: memo.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to save");
      }
      const newPhone: Phone = await res.json();
      setPhones((prev) => [newPhone, ...prev]);
      setSheetOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 12px",
    border: "1px solid var(--surface-border)", borderRadius: 8,
    fontSize: 15, background: "var(--bg)", color: "var(--white)",
    boxSizing: "border-box", outline: "none",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600,
    color: "var(--muted)", marginBottom: 6,
    textTransform: "uppercase", letterSpacing: "0.04em",
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
        <h1 style={{
          margin: "0 0 12px", fontSize: 24, fontWeight: 800,
          color: "var(--white)", letterSpacing: "-0.5px",
        }}>
          Stock
        </h1>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--bg)",
          border: "1px solid var(--surface-border)",
          borderRadius: 10, padding: "0 12px",
        }}>
          <Search size={16} color="var(--muted)" />
          <input
            type="text"
            placeholder="Search brand, model, IMEI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, padding: "10px 0", border: "none",
              background: "transparent", color: "var(--white)",
              fontSize: 15, outline: "none",
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "48px 0", fontSize: 15 }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "64px 0", fontSize: 15 }}>
            {search ? "No phones match your search." : "No phones in stock. Tap + to add one."}
          </p>
        ) : filtered.map((phone) => (
          <div
            key={phone.id}
            onClick={() => router.push(`/stock/${phone.id}`)}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-border)",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--white)" }}>
                {phone.brand} {phone.model}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                {[phone.storage, phone.color, CONDITION_LABELS[phone.condition]].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)" }}>
                {formatBirr(phone.asking_price)}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                padding: "2px 8px", borderRadius: 999,
                background: "var(--green-dim)", color: "var(--green)",
              }}>
                In Stock
              </span>
            </div>
          </div>
        ))}
      </div>

      <FAB onClick={() => { resetForm(); setSheetOpen(true); }} />

      {/* Add Phone Sheet */}
      <BottomSheet open={sheetOpen} onClose={() => { setSheetOpen(false); resetForm(); }} title="Add Phone">
        <form onSubmit={handleSubmit} noValidate>

          {/* Brand */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="ph-brand">Brand *</label>
            <input id="ph-brand" type="text" placeholder="Samsung, Apple..." value={brand} onChange={(e) => setBrand(e.target.value)} style={inp} required />
          </div>

          {/* Model */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="ph-model">Model *</label>
            <input id="ph-model" type="text" placeholder="Galaxy A54, iPhone 13..." value={model} onChange={(e) => setModel(e.target.value)} style={inp} required />
          </div>

          {/* IMEI */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="ph-imei">IMEI</label>
            <input id="ph-imei" type="text" placeholder="Optional" value={imei} onChange={(e) => setImei(e.target.value)} style={inp} />
          </div>

          {/* Storage & Color side by side */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl} htmlFor="ph-storage">Storage</label>
              <input id="ph-storage" type="text" placeholder="128GB" value={storage} onChange={(e) => setStorage(e.target.value)} style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl} htmlFor="ph-color">Color</label>
              <input id="ph-color" type="text" placeholder="Black" value={color} onChange={(e) => setColor(e.target.value)} style={inp} />
            </div>
          </div>

          {/* Condition */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="ph-condition">Condition *</label>
            <select id="ph-condition" value={condition} onChange={(e) => setCondition(e.target.value as Condition)} style={inp}>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Cost & Asking side by side */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl} htmlFor="ph-cost">Cost Price *</label>
              <input id="ph-cost" type="number" inputMode="numeric" min="0" placeholder="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} style={inp} required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl} htmlFor="ph-asking">Asking Price *</label>
              <input id="ph-asking" type="number" inputMode="numeric" min="0" placeholder="0" value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} style={inp} required />
            </div>
          </div>

          {/* Memo */}
          <div style={{ marginBottom: 18 }}>
            <label style={lbl} htmlFor="ph-memo">Memo</label>
            <textarea id="ph-memo" placeholder="Optional note..." value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
          </div>

          {/* Error */}
          {formError && (
            <div style={{
              marginBottom: 14, padding: "10px 14px",
              background: "color-mix(in srgb, var(--error) 15%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 30%, transparent)",
              borderRadius: 8, color: "var(--error)", fontSize: 14,
            }}>
              {formError}
            </div>
          )}

          <button type="submit" disabled={submitting} style={{
            width: "100%", padding: "13px 0", border: "none",
            borderRadius: 8, fontSize: 16, fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.65 : 1,
            color: "var(--white)", background: "var(--accent)",
          }}>
            {submitting ? "Saving..." : "Add Phone"}
          </button>

        </form>
      </BottomSheet>
    </div>
  );
}
