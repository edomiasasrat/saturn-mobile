"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import BottomSheet from "@/components/BottomSheet";
import FAB from "@/components/FAB";
import { formatBirr } from "@/lib/format";
import type { Seller, Phone } from "@/lib/types";

const SEEDS: { name: string; phone_number: string; location: string }[] = [
  { name: "Abebe Store", phone_number: "", location: "Merkato" },
  { name: "Sara Electronics", phone_number: "", location: "Piazza" },
  { name: "Daniel Phones", phone_number: "", location: "Bole" },
];

export default function SellersPage() {
  const router = useRouter();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const seededRef = useRef(false);

  // Form state
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [location, setLocation] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (skipSeed = false) => {
    setLoading(true);
    try {
      const [sellersRes, phonesRes] = await Promise.all([
        fetch("/api/sellers"),
        fetch("/api/phones?status=with_seller"),
      ]);
      const sellersData: Seller[] = await sellersRes.json();
      const phonesData: Phone[] = await phonesRes.json();

      if (!skipSeed && !seededRef.current && sellersData.length === 0) {
        seededRef.current = true;
        await Promise.all(
          SEEDS.map((s) =>
            fetch("/api/sellers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(s),
            })
          )
        );
        await load(true);
        return;
      }

      setSellers(sellersData);
      setPhones(phonesData);
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group phones by seller_id
  const sellerStats = sellers.map((seller) => {
    const sellerPhones = phones.filter((p) => p.seller_id === seller.id);
    const phoneCount = sellerPhones.length;
    const totalOwed = sellerPhones.reduce((sum, p) => sum + p.asking_price, 0);
    return { ...seller, phoneCount, totalOwed };
  });

  const filtered = sellerStats.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setName("");
    setPhoneNumber("");
    setLocation("");
    setMemo("");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) return setFormError("Name is required.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone_number: phoneNumber.trim() || null,
          location: location.trim() || null,
          memo: memo.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to save");
      }
      setSheetOpen(false);
      resetForm();
      await load(true);
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
    display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)",
    marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em",
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
          Sellers
        </h1>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--bg)", border: "1px solid var(--surface-border)",
          borderRadius: 10, padding: "8px 12px",
        }}>
          <Search size={18} color="var(--muted)" />
          <input
            type="text"
            placeholder="Search sellers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, border: "none", background: "transparent",
              color: "var(--white)", fontSize: 15, outline: "none",
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "48px 0", fontSize: 15 }}>
            Loading...
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "64px 0", fontSize: 15 }}>
            {search ? "No sellers match your search." : "No sellers yet. Tap + to add one."}
          </p>
        ) : (
          filtered.map((seller) => (
            <div
              key={seller.id}
              onClick={() => router.push(`/sellers/${seller.id}`)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--surface-border)",
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--white)" }}>
                  {seller.name}
                </div>
                {seller.location && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {seller.location}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)" }}>
                  {formatBirr(seller.totalOwed)}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {seller.phoneCount} phone{seller.phoneCount !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <FAB onClick={() => { resetForm(); setSheetOpen(true); }} />

      {/* Add Seller Sheet */}
      <BottomSheet open={sheetOpen} onClose={() => { setSheetOpen(false); resetForm(); }} title="Add Seller">
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="seller-name">Name *</label>
            <input
              id="seller-name" type="text" placeholder="Seller name"
              value={name} onChange={(e) => setName(e.target.value)}
              style={inp} required
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="seller-phone">Phone Number</label>
            <input
              id="seller-phone" type="tel" placeholder="09..."
              value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
              style={inp}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="seller-location">Location</label>
            <input
              id="seller-location" type="text" placeholder="e.g. Merkato"
              value={location} onChange={(e) => setLocation(e.target.value)}
              style={inp}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={lbl} htmlFor="seller-memo">Memo</label>
            <textarea
              id="seller-memo" placeholder="Optional note..."
              value={memo} onChange={(e) => setMemo(e.target.value)}
              rows={2}
              style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
            />
          </div>

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

          <button
            type="submit" disabled={submitting}
            style={{
              width: "100%", padding: "13px 0", border: "none",
              borderRadius: 8, fontSize: 16, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.65 : 1,
              color: "var(--white)", background: "var(--accent)",
            }}
          >
            {submitting ? "Saving..." : "Add Seller"}
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}
