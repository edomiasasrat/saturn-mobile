"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Search } from "lucide-react";
import ModalDrilldown from "@/components/ModalDrilldown";
import SortDropdown from "@/components/SortDropdown";
import PhoneDetail from "@/components/PhoneDetail";
import BottomSheet from "@/components/BottomSheet";
import FAB from "@/components/FAB";
import { formatBirr } from "@/lib/format";
import { useData } from "@/lib/DataProvider";
import type { Phone } from "@/lib/types";

type Condition = "new" | "used_good" | "used_fair";
type StatusFilter = "all" | "in_stock" | "with_seller" | "sold";

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "used_good", label: "Used - Good" },
  { value: "used_fair", label: "Used - Fair" },
];

const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  used_good: "Used - Good",
  used_fair: "Used - Fair",
};

const STATUS_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  in_stock: { label: "In Stock", color: "var(--green)", bg: "var(--green-dim)" },
  with_seller: { label: "With Seller", color: "var(--amber)", bg: "color-mix(in srgb, var(--amber) 15%, transparent)" },
  sold: { label: "Sold", color: "var(--muted)", bg: "color-mix(in srgb, var(--muted) 15%, transparent)" },
};

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_stock", label: "In Stock" },
  { key: "with_seller", label: "With Sellers" },
  { key: "sold", label: "Sold" },
];

function sortPhones(arr: Phone[], key: string): Phone[] {
  const sorted = [...arr];
  switch (key) {
    case "newest":
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case "brand":
      return sorted.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
    case "price":
      return sorted.sort((a, b) => b.asking_price - a.asking_price);
    case "aging":
      return sorted.sort((a, b) => {
        const aTime = a.distributed_at ? new Date(a.distributed_at).getTime() : Infinity;
        const bTime = b.distributed_at ? new Date(b.distributed_at).getTime() : Infinity;
        return aTime - bTime;
      });
    default:
      return sorted;
  }
}

export default function StockPage() {
  const { phones, addPhone, loading, refresh } = useData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState("newest");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

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

  // Autocomplete suggestions from existing phones
  const uniqueBrands = useMemo(() => [...new Set(phones.map((p) => p.brand))].sort(), [phones]);
  const modelsForBrand = useMemo(() => {
    if (!brand.trim()) return [...new Set(phones.map((p) => p.model))].sort();
    return [...new Set(phones.filter((p) => p.brand.toLowerCase() === brand.toLowerCase()).map((p) => p.model))].sort();
  }, [phones, brand]);
  const uniqueStorages = useMemo(() => [...new Set(phones.map((p) => p.storage).filter(Boolean))].sort(), [phones]);
  const uniqueColors = useMemo(() => [...new Set(phones.map((p) => p.color).filter(Boolean))].sort(), [phones]);

  // Computed list: filter -> search -> sort
  const displayList = useMemo(() => {
    let list = phones;

    // Status filter
    if (filter !== "all") {
      list = list.filter((p) => p.status === filter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.brand.toLowerCase().includes(q) ||
          p.model.toLowerCase().includes(q) ||
          (p.imei && p.imei.toLowerCase().includes(q))
      );
    }

    // Sort
    return sortPhones(list, sortKey);
  }, [phones, filter, search, sortKey]);

  // Sort options - show Aging only when With Sellers filter is active
  const sortOptions = useMemo(() => {
    const base = [
      { key: "newest", label: "Newest" },
      { key: "brand", label: "Brand" },
      { key: "price", label: "Price" },
    ];
    if (filter === "with_seller") {
      base.push({ key: "aging", label: "Aging" });
    }
    return base;
  }, [filter]);

  // Reset sort if switching away from with_seller while aging is selected
  useEffect(() => {
    if (filter !== "with_seller" && sortKey === "aging") {
      setSortKey("newest");
    }
  }, [filter, sortKey]);

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
      await addPhone({
        brand: brand.trim(),
        model: model.trim(),
        imei: imei.trim() || null,
        storage: storage.trim() || null,
        color: color.trim() || null,
        condition,
        cost_price: cost,
        asking_price: asking,
        memo: memo.trim() || null,
      });
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h1 style={{
            margin: 0, fontSize: 24, fontWeight: 800,
            color: "var(--white)", letterSpacing: "-0.5px",
          }}>
            Stock
          </h1>
          <SortDropdown options={sortOptions} value={sortKey} onChange={setSortKey} />
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "none",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                whiteSpace: "nowrap",
                background: filter === tab.key ? "var(--accent)" : "var(--bg)",
                color: filter === tab.key ? "var(--white)" : "var(--muted)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
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
        ) : displayList.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "64px 0", fontSize: 15 }}>
            {search ? "No phones match your search." : "No phones found. Tap + to add one."}
          </p>
        ) : displayList.map((phone, idx) => {
          const badge = STATUS_BADGES[phone.status] || STATUS_BADGES.in_stock;
          const aging = phone.status === "with_seller" && phone.distributed_at
            ? Math.floor((Date.now() - new Date(phone.distributed_at).getTime()) / 86400000)
            : null;

          return (
            <div
              key={phone.id}
              onClick={() => { setModalIndex(idx); setModalOpen(true); }}
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
                <span style={{ fontWeight: 700, fontSize: 15, color: "var(--white)" }}>
                  {formatBirr(phone.asking_price)}
                </span>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: "2px 8px", borderRadius: 999,
                    background: badge.bg, color: badge.color,
                  }}>
                    {badge.label}
                  </span>
                  {aging !== null && (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      padding: "2px 6px", borderRadius: 999,
                      background: "var(--amber-dim, var(--error-dim))",
                      color: "var(--amber, var(--error))",
                    }}>
                      {aging}d
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FAB onClick={() => { resetForm(); setSheetOpen(true); }} />

      {/* Modal Drilldown */}
      <ModalDrilldown
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        items={displayList}
        currentIndex={modalIndex}
        onChangeIndex={setModalIndex}
        renderContent={(item, pushView) => (
          <PhoneDetail phoneId={item.id} pushView={pushView} onAction={() => { refresh(); setModalOpen(false); }} />
        )}
      />

      {/* Add Phone Sheet */}
      <BottomSheet open={sheetOpen} onClose={() => { setSheetOpen(false); resetForm(); }} title="Add Phone">
        <form onSubmit={handleSubmit} noValidate>

          {/* Brand */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="ph-brand">Brand *</label>
            <input id="ph-brand" type="text" list="brand-suggestions" placeholder="Samsung, Apple..."
              value={brand} onChange={(e) => setBrand(e.target.value)} style={inp} required autoComplete="off" />
            <datalist id="brand-suggestions">
              {uniqueBrands.map((b) => <option key={b} value={b} />)}
            </datalist>
          </div>

          {/* Model */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="ph-model">Model *</label>
            <input id="ph-model" type="text" list="model-suggestions" placeholder="Galaxy A54, iPhone 13..."
              value={model} onChange={(e) => setModel(e.target.value)}
              style={inp} required autoComplete="off" />
            <datalist id="model-suggestions">
              {modelsForBrand.map((m) => <option key={m} value={m} />)}
            </datalist>
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
              <input id="ph-storage" type="text" list="storage-suggestions" placeholder="128GB"
                value={storage} onChange={(e) => setStorage(e.target.value)} style={inp} autoComplete="off" />
              <datalist id="storage-suggestions">
                {uniqueStorages.map((s) => <option key={s} value={s!} />)}
              </datalist>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl} htmlFor="ph-color">Color</label>
              <input id="ph-color" type="text" list="color-suggestions" placeholder="Black"
                value={color} onChange={(e) => setColor(e.target.value)} style={inp} autoComplete="off" />
              <datalist id="color-suggestions">
                {uniqueColors.map((c) => <option key={c} value={c!} />)}
              </datalist>
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
