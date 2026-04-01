"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import ModalDrilldown from "@/components/ModalDrilldown";
import SortDropdown from "@/components/SortDropdown";
import SellerDetail from "@/components/SellerDetail";
import BottomSheet from "@/components/BottomSheet";
import FAB from "@/components/FAB";
import { formatBirr } from "@/lib/format";
import { useData } from "@/lib/DataProvider";

const SORT_OPTIONS = [
  { key: "name", label: "Name" },
  { key: "balance", label: "Balance" },
  { key: "phones", label: "Phones" },
  { key: "activity", label: "Activity" },
];

interface SellerRow {
  id: number;
  name: string;
  phone_number: string | null;
  location: string | null;
  memo: string | null;
  created_at: string;
  phoneCount: number;
  totalOwed: number;
  lastActivity: string | null;
}

export default function SellersPage() {
  const { sellers, phones, transactions, addSeller, loading, refresh } = useData();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  // Form state
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [location, setLocation] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Compute per-seller stats and build display list
  const displayList: SellerRow[] = useMemo(() => {
    const rows = sellers.map((seller) => {
      const sellerPhones = phones.filter((p) => p.seller_id === seller.id && p.status === "with_seller");
      const phoneCount = sellerPhones.length;
      const totalOwed = sellerPhones.reduce((sum, p) => sum + p.asking_price, 0);

      // Find last transaction for this seller
      const sellerTxs = transactions.filter((t) => t.seller_id === seller.id);
      const lastActivity = sellerTxs.length > 0
        ? sellerTxs.reduce((latest, t) => t.created_at > latest ? t.created_at : latest, sellerTxs[0].created_at)
        : null;

      return { ...seller, phoneCount, totalOwed, lastActivity };
    });

    // Search
    let filtered = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.location && s.location.toLowerCase().includes(q))
      );
    }

    // Sort
    const sorted = [...filtered];
    switch (sortKey) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "balance":
        sorted.sort((a, b) => b.totalOwed - a.totalOwed);
        break;
      case "phones":
        sorted.sort((a, b) => b.phoneCount - a.phoneCount);
        break;
      case "activity":
        sorted.sort((a, b) => {
          const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          return bTime - aTime;
        });
        break;
    }

    return sorted;
  }, [sellers, phones, transactions, search, sortKey]);

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
      await addSeller({
        name: name.trim(),
        phone_number: phoneNumber.trim() || null,
        location: location.trim() || null,
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h1 style={{
            margin: 0, fontSize: 24, fontWeight: 800,
            color: "var(--white)", letterSpacing: "-0.5px",
          }}>
            Sellers
          </h1>
          <SortDropdown options={SORT_OPTIONS} value={sortKey} onChange={setSortKey} />
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--bg)", border: "1px solid var(--surface-border)",
          borderRadius: 10, padding: "0 12px",
        }}>
          <Search size={16} color="var(--muted)" />
          <input
            type="text"
            placeholder="Search name, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, padding: "10px 0", border: "none", background: "transparent",
              color: "var(--white)", fontSize: 15, outline: "none",
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "48px 0", fontSize: 15 }}>
            Loading...
          </p>
        ) : displayList.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "64px 0", fontSize: 15 }}>
            {search ? "No sellers match your search." : "No sellers yet. Tap + to add one."}
          </p>
        ) : (
          displayList.map((seller, idx) => (
            <div
              key={seller.id}
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

      {/* Modal Drilldown */}
      <ModalDrilldown
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        items={displayList}
        currentIndex={modalIndex}
        onChangeIndex={setModalIndex}
        renderContent={(item, pushView) => (
          <SellerDetail sellerId={item.id} pushView={pushView} onAction={refresh} />
        )}
      />

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
