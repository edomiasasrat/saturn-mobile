"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Check, Trash2 } from "lucide-react";
import BottomSheet from "@/components/BottomSheet";
import { formatBirr, formatDate } from "@/lib/format";
import type { Phone, Seller } from "@/lib/types";

type Condition = "new" | "used_good" | "used_fair";

const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  used_good: "Used - Good",
  used_fair: "Used - Fair",
};

const STATUS_LABELS: Record<string, string> = {
  in_stock: "In Stock",
  with_seller: "With Seller",
  sold: "Sold",
  returned: "Returned",
};

export default function StockDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [phone, setPhone] = useState<Phone | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Give to Seller
  const [sellerSheetOpen, setSellerSheetOpen] = useState(false);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellersLoading, setSellersLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);

  // Quick Sell
  const [sellSheetOpen, setSellSheetOpen] = useState(false);
  const [sellPrice, setSellPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [selling, setSelling] = useState(false);

  // Seller name for with_seller status
  const [sellerName, setSellerName] = useState<string | null>(null);

  const fetchPhone = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/phones/${id}`);
      if (!res.ok) throw new Error();
      const data: Phone = await res.json();
      setPhone(data);

      // If with a seller, fetch seller name
      if (data.status === "with_seller" && data.seller_id) {
        const sRes = await fetch(`/api/sellers/${data.seller_id}`);
        if (sRes.ok) {
          const seller = await sRes.json();
          setSellerName(seller.name);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPhone(); }, [fetchPhone]);

  const copyImei = async () => {
    if (!phone?.imei) return;
    try {
      await navigator.clipboard.writeText(phone.imei);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: ignore
    }
  };

  const openSellerSheet = async () => {
    setSellerSheetOpen(true);
    setSellersLoading(true);
    try {
      const res = await fetch("/api/sellers");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSellers(data);
    } catch {
      setSellers([]);
    } finally {
      setSellersLoading(false);
    }
  };

  const handleDistribute = async (sellerId: number) => {
    setDistributing(true);
    try {
      const res = await fetch(`/api/phones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "distribute", seller_id: sellerId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed");
      }
      router.push(`/sellers/${sellerId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to distribute.");
      setDistributing(false);
    }
  };

  const openSellSheet = () => {
    if (phone) setSellPrice(String(phone.asking_price));
    setPaymentMethod("cash");
    setSellSheetOpen(true);
  };

  const handleQuickSell = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(sellPrice);
    if (!sellPrice || isNaN(price) || price <= 0) return alert("Enter a valid price.");
    setSelling(true);
    try {
      const res = await fetch(`/api/phones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quick_sell", price, payment_method: paymentMethod }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed");
      }
      router.push("/stock");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to sell.");
      setSelling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this phone permanently?")) return;
    try {
      const res = await fetch(`/api/phones/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/stock");
    } catch {
      alert("Failed to delete.");
    }
  };

  const statusBadge = (status: string) => {
    const isStock = status === "in_stock";
    const isSold = status === "sold";
    return (
      <span style={{
        fontSize: 12, fontWeight: 600,
        padding: "3px 10px", borderRadius: 999,
        background: isStock ? "var(--green-dim)" : isSold ? "var(--success-dim)" : "var(--error-dim)",
        color: isStock ? "var(--green)" : isSold ? "var(--accent)" : "var(--error)",
      }}>
        {STATUS_LABELS[status] || status}
      </span>
    );
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

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: 15 }}>Loading...</p>
      </div>
    );
  }

  if (!phone) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <p style={{ color: "var(--muted)", fontSize: 15 }}>Phone not found.</p>
        <button onClick={() => router.push("/stock")} style={{
          padding: "10px 20px", borderRadius: 8, border: "none",
          background: "var(--accent)", color: "var(--white)",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>
          Back to Stock
        </button>
      </div>
    );
  }

  const profit = phone.asking_price - phone.cost_price;

  const DetailRow = ({ label, value, extra }: { label: string; value: string | React.ReactNode; extra?: React.ReactNode }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 0",
      borderBottom: "1px solid var(--surface-border)",
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 15, color: "var(--white)", fontWeight: 500 }}>{value}</span>
        {extra}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", paddingBottom: 96 }}>

      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        padding: "16px 20px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--surface-border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/stock")} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--muted)", display: "flex", alignItems: "center", gap: 4,
            fontSize: 14, fontWeight: 600, padding: 0,
          }}>
            <ArrowLeft size={18} />
            Stock
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--white)", margin: 0 }}>
            {phone.brand} {phone.model}
          </h1>
          {statusBadge(phone.status)}
        </div>
      </div>

      {/* Detail card */}
      <div style={{ padding: "16px 20px" }}>
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--surface-border)",
          borderRadius: 12, padding: "4px 16px",
        }}>
          {phone.imei && (
            <DetailRow
              label="IMEI"
              value={phone.imei}
              extra={
                <button onClick={copyImei} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: copied ? "var(--green)" : "var(--muted)",
                  display: "flex", padding: 2,
                }}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              }
            />
          )}
          {phone.storage && <DetailRow label="Storage" value={phone.storage} />}
          {phone.color && <DetailRow label="Color" value={phone.color} />}
          <DetailRow label="Condition" value={CONDITION_LABELS[phone.condition]} />
          <DetailRow label="Cost Price" value={formatBirr(phone.cost_price)} />
          <DetailRow label="Asking Price" value={
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{formatBirr(phone.asking_price)}</span>
          } />
          <DetailRow label="Profit Margin" value={
            <span style={{ color: profit >= 0 ? "var(--green)" : "var(--error)", fontWeight: 700 }}>
              {profit >= 0 ? "+" : ""}{formatBirr(profit)}
            </span>
          } />
          <DetailRow label="Date Added" value={formatDate(phone.created_at)} />
          {phone.memo && (
            <DetailRow label="Memo" value={phone.memo} />
          )}
        </div>

        {/* With Seller info */}
        {phone.status === "with_seller" && phone.seller_id && (
          <div style={{
            marginTop: 16, padding: "14px 16px",
            background: "var(--surface)", border: "1px solid var(--surface-border)",
            borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>With Seller</span>
              <div style={{ fontSize: 15, color: "var(--white)", fontWeight: 600, marginTop: 2 }}>
                {sellerName || `Seller #${phone.seller_id}`}
              </div>
            </div>
            <button
              onClick={() => router.push(`/sellers/${phone.seller_id}`)}
              style={{
                padding: "8px 16px", borderRadius: 8,
                background: "var(--accent)", color: "var(--white)",
                border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              View Seller
            </button>
          </div>
        )}

        {/* Action buttons for in_stock */}
        {phone.status === "in_stock" && (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={openSellerSheet} style={{
              width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              background: "var(--accent)", color: "var(--white)",
            }}>
              Give to Seller
            </button>
            <button onClick={openSellSheet} style={{
              width: "100%", padding: "13px 0", borderRadius: 10,
              border: "1px solid var(--green)", background: "var(--green-dim)",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              color: "var(--green)",
            }}>
              Quick Sell
            </button>
            <button onClick={handleDelete} style={{
              width: "100%", padding: "13px 0", borderRadius: 10,
              border: "1px solid var(--error)", background: "var(--error-dim)",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              color: "var(--error)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Trash2 size={16} />
              Delete Phone
            </button>
          </div>
        )}
      </div>

      {/* Give to Seller Sheet */}
      <BottomSheet open={sellerSheetOpen} onClose={() => setSellerSheetOpen(false)} title="Give to Seller">
        {sellersLoading ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0", fontSize: 15 }}>Loading sellers...</p>
        ) : sellers.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0", fontSize: 15 }}>No sellers found. Add a seller first.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sellers.map((seller) => (
              <button
                key={seller.id}
                onClick={() => handleDistribute(seller.id)}
                disabled={distributing}
                style={{
                  width: "100%", padding: "14px 16px", borderRadius: 10,
                  border: "1px solid var(--surface-border)",
                  background: "var(--bg)", color: "var(--white)",
                  fontSize: 15, fontWeight: 600, cursor: distributing ? "not-allowed" : "pointer",
                  textAlign: "left", opacity: distributing ? 0.6 : 1,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <div>
                  <div>{seller.name}</div>
                  {seller.location && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{seller.location}</div>
                  )}
                </div>
                <ArrowLeft size={16} style={{ transform: "rotate(180deg)", color: "var(--muted)" }} />
              </button>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* Quick Sell Sheet */}
      <BottomSheet open={sellSheetOpen} onClose={() => setSellSheetOpen(false)} title="Quick Sell">
        <form onSubmit={handleQuickSell} noValidate>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl} htmlFor="sell-price">Selling Price (ETB) *</label>
            <input
              id="sell-price" type="number" inputMode="numeric" min="0"
              value={sellPrice} onChange={(e) => setSellPrice(e.target.value)}
              style={inp} required
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Payment Method</label>
            <div style={{ display: "flex", gap: 10 }}>
              {(["cash", "bank"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8,
                    cursor: "pointer", fontSize: 15, fontWeight: 700,
                    border: paymentMethod === m ? "none" : "1px solid var(--surface-border)",
                    background: paymentMethod === m ? "var(--accent)" : "var(--surface)",
                    color: paymentMethod === m ? "var(--white)" : "var(--muted)",
                  }}
                >
                  {m === "cash" ? "Cash" : "Bank"}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={selling} style={{
            width: "100%", padding: "13px 0", border: "none",
            borderRadius: 8, fontSize: 16, fontWeight: 700,
            cursor: selling ? "not-allowed" : "pointer",
            opacity: selling ? 0.65 : 1,
            color: "var(--white)", background: "var(--accent)",
          }}>
            {selling ? "Processing..." : "Confirm Sale"}
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}
