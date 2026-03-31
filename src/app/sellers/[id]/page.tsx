"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone as PhoneIcon } from "lucide-react";
import BottomSheet from "@/components/BottomSheet";
import { formatBirr, formatDate } from "@/lib/format";
import type { SellerWithStats, Phone, Transaction } from "@/lib/types";

export default function SellerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [seller, setSeller] = useState<SellerWithStats | null>(null);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Collect Payment sheet
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectTab, setCollectTab] = useState<"per_phone" | "lump_sum">("per_phone");
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<number[]>([]);
  const [collectMethod, setCollectMethod] = useState<"cash" | "bank">("cash");
  const [lumpAmount, setLumpAmount] = useState("");
  const [lumpMemo, setLumpMemo] = useState("");
  const [lumpMethod, setLumpMethod] = useState<"cash" | "bank">("cash");
  const [collectSubmitting, setCollectSubmitting] = useState(false);

  // Give Phone sheet
  const [giveOpen, setGiveOpen] = useState(false);
  const [stockPhones, setStockPhones] = useState<Phone[]>([]);
  const [giveLoading, setGiveLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sellers/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSeller(data.seller);
      setPhones(data.phones);
      setTransactions(data.transactions);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const withSellerPhones = phones.filter((p) => p.status === "with_seller");
  const totalOwed = withSellerPhones.reduce((sum, p) => sum + p.asking_price, 0);

  // Days since distributed
  const daysSince = (date: string | null) => {
    if (!date) return 0;
    const diff = Date.now() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // Return phone
  const handleReturn = async (phoneId: number) => {
    try {
      const res = await fetch(`/api/phones/${phoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "return" }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      alert("Failed to return phone.");
    }
  };

  // Collect payment
  const handleCollect = async () => {
    setCollectSubmitting(true);
    try {
      const body =
        collectTab === "per_phone"
          ? { mode: "per_phone", phone_ids: selectedPhoneIds, payment_method: collectMethod }
          : {
              mode: "lump_sum",
              amount: parseFloat(lumpAmount),
              payment_method: lumpMethod,
              memo: lumpMemo.trim() || null,
            };
      const res = await fetch(`/api/sellers/${id}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setCollectOpen(false);
      setSelectedPhoneIds([]);
      setLumpAmount("");
      setLumpMemo("");
      await load();
    } catch {
      alert("Failed to collect payment.");
    } finally {
      setCollectSubmitting(false);
    }
  };

  // Give phone
  const openGiveSheet = async () => {
    setGiveOpen(true);
    setGiveLoading(true);
    try {
      const res = await fetch("/api/phones?status=in_stock");
      if (!res.ok) throw new Error();
      const data: Phone[] = await res.json();
      setStockPhones(data);
    } catch {
      setStockPhones([]);
    } finally {
      setGiveLoading(false);
    }
  };

  const handleGivePhone = async (phoneId: number) => {
    try {
      const res = await fetch(`/api/phones/${phoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "distribute", seller_id: Number(id) }),
      });
      if (!res.ok) throw new Error();
      setGiveOpen(false);
      await load();
    } catch {
      alert("Failed to give phone.");
    }
  };

  // Delete seller
  const handleDelete = async () => {
    if (!confirm(`Delete ${seller?.name}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/sellers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/sellers");
    } catch {
      alert("Failed to delete seller.");
    }
  };

  // Toggle phone selection for collect
  const togglePhoneSelect = (phoneId: number) => {
    setSelectedPhoneIds((prev) =>
      prev.includes(phoneId)
        ? prev.filter((pid) => pid !== phoneId)
        : [...prev, phoneId]
    );
  };

  const selectedTotal = withSellerPhones
    .filter((p) => selectedPhoneIds.includes(p.id))
    .reduce((sum, p) => sum + p.asking_price, 0);

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

  if (loading && !seller) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: 15 }}>Loading...</p>
      </div>
    );
  }

  if (!seller) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: 15 }}>Seller not found.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", paddingBottom: 96 }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        padding: "16px 20px", background: "var(--surface)",
        borderBottom: "1px solid var(--surface-border)",
      }}>
        <button
          onClick={() => router.push("/sellers")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--muted)", fontSize: 14, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 4,
            padding: 0, marginBottom: 8,
          }}
        >
          <ArrowLeft size={18} /> Sellers
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--white)", margin: 0 }}>
          {seller.name}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          {seller.location && (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{seller.location}</span>
          )}
          {seller.phone_number && (
            <a
              href={`tel:${seller.phone_number}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 13, color: "var(--accent)", textDecoration: "none",
              }}
            >
              <PhoneIcon size={13} /> {seller.phone_number}
            </a>
          )}
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        {/* Balance Card */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--surface-border)",
          borderRadius: 12, padding: "16px 18px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
            Total Owed
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent)", marginBottom: 12 }}>
            {formatBirr(totalOwed)}
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Phones held</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
                {withSellerPhones.length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Total collected</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>
                {formatBirr(seller.total_collected)}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, overflowX: "auto" }}>
          <button
            onClick={() => {
              setCollectTab("per_phone");
              setSelectedPhoneIds([]);
              setLumpAmount("");
              setLumpMemo("");
              setCollectOpen(true);
            }}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 10,
              border: "none", cursor: "pointer",
              background: "var(--accent)", color: "var(--white)",
              fontSize: 14, fontWeight: 700, whiteSpace: "nowrap",
            }}
          >
            Collect Payment
          </button>
          <button
            onClick={openGiveSheet}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 10,
              border: "1px solid var(--surface-border)", cursor: "pointer",
              background: "var(--surface)", color: "var(--white)",
              fontSize: 14, fontWeight: 700, whiteSpace: "nowrap",
            }}
          >
            Give Phone
          </button>
        </div>

        {/* Phones Section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 10,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--white)", margin: 0 }}>
              Phones with {seller.name}
            </h2>
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
              {withSellerPhones.length}
            </span>
          </div>

          {withSellerPhones.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14, padding: "20px 0", textAlign: "center" }}>
              No phones with this seller
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {withSellerPhones.map((phone) => (
                <div
                  key={phone.id}
                  style={{
                    background: "var(--surface)", border: "1px solid var(--surface-border)",
                    borderRadius: 10, padding: "12px 14px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--white)" }}>
                      {phone.brand} {phone.model}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {formatBirr(phone.asking_price)} · {daysSince(phone.distributed_at)} days
                    </div>
                  </div>
                  <button
                    onClick={() => handleReturn(phone.id)}
                    style={{
                      padding: "6px 14px", borderRadius: 8,
                      border: "1px solid var(--surface-border)",
                      background: "transparent", color: "var(--muted)",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Return
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment History */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--white)", margin: "0 0 10px" }}>
            Payment History
          </h2>
          {transactions.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14, padding: "20px 0", textAlign: "center" }}>
              No payments yet
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...transactions]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((tx) => (
                  <div
                    key={tx.id}
                    style={{
                      background: "var(--surface)", border: "1px solid var(--surface-border)",
                      borderRadius: 10, padding: "12px 14px",
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {tx.description}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {formatDate(tx.created_at)}
                        {tx.payment_method && (
                          <span style={{
                            marginLeft: 8, padding: "1px 6px",
                            borderRadius: 4, fontSize: 11, fontWeight: 600,
                            background: "var(--surface-border)", color: "var(--muted)",
                          }}>
                            {tx.payment_method.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--green)", flexShrink: 0 }}>
                      +{formatBirr(tx.amount)}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Delete Seller */}
        <button
          onClick={handleDelete}
          disabled={withSellerPhones.length > 0}
          style={{
            width: "100%", padding: "13px 0", borderRadius: 10,
            border: "1px solid var(--error)",
            background: "transparent", color: "var(--error)",
            fontSize: 15, fontWeight: 700,
            cursor: withSellerPhones.length > 0 ? "not-allowed" : "pointer",
            opacity: withSellerPhones.length > 0 ? 0.4 : 1,
          }}
        >
          Delete Seller
        </button>
        {withSellerPhones.length > 0 && (
          <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 6 }}>
            Return all phones before deleting
          </p>
        )}
      </div>

      {/* Collect Payment Sheet */}
      <BottomSheet open={collectOpen} onClose={() => setCollectOpen(false)} title="Collect Payment">
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 16, borderRadius: 8, overflow: "hidden", border: "1px solid var(--surface-border)" }}>
          <button
            onClick={() => setCollectTab("per_phone")}
            style={{
              flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              background: collectTab === "per_phone" ? "var(--accent)" : "var(--bg)",
              color: collectTab === "per_phone" ? "var(--white)" : "var(--muted)",
            }}
          >
            Per Phone
          </button>
          <button
            onClick={() => setCollectTab("lump_sum")}
            style={{
              flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              background: collectTab === "lump_sum" ? "var(--accent)" : "var(--bg)",
              color: collectTab === "lump_sum" ? "var(--white)" : "var(--muted)",
            }}
          >
            Lump Sum
          </button>
        </div>

        {collectTab === "per_phone" ? (
          <div>
            {withSellerPhones.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14, textAlign: "center", padding: "16px 0" }}>
                No phones to collect for
              </p>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {withSellerPhones.map((phone) => {
                    const checked = selectedPhoneIds.includes(phone.id);
                    return (
                      <div
                        key={phone.id}
                        onClick={() => togglePhoneSelect(phone.id)}
                        style={{
                          background: checked ? "var(--green-dim)" : "var(--bg)",
                          border: `1px solid ${checked ? "var(--green)" : "var(--surface-border)"}`,
                          borderRadius: 8, padding: "10px 12px",
                          display: "flex", alignItems: "center", gap: 10,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{
                          width: 20, height: 20, borderRadius: 4,
                          border: `2px solid ${checked ? "var(--green)" : "var(--surface-border)"}`,
                          background: checked ? "var(--green)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, fontSize: 13, color: "var(--white)", fontWeight: 700,
                        }}>
                          {checked ? "\u2713" : ""}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>
                            {phone.brand} {phone.model}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
                          {formatBirr(phone.asking_price)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{
                  background: "var(--bg)", border: "1px solid var(--surface-border)",
                  borderRadius: 8, padding: "10px 14px", marginBottom: 14,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "var(--green)" }}>
                    {formatBirr(selectedTotal)}
                  </span>
                </div>

                {/* Payment method */}
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Payment Method</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["cash", "bank"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCollectMethod(m)}
                        style={{
                          flex: 1, padding: "10px 0", borderRadius: 8, cursor: "pointer",
                          fontSize: 14, fontWeight: 600,
                          border: collectMethod === m ? "none" : "1px solid var(--surface-border)",
                          background: collectMethod === m ? "var(--accent)" : "var(--bg)",
                          color: collectMethod === m ? "var(--white)" : "var(--muted)",
                        }}
                      >
                        {m === "cash" ? "Cash" : "Bank"}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCollect}
                  disabled={selectedPhoneIds.length === 0 || collectSubmitting}
                  style={{
                    width: "100%", padding: "13px 0", border: "none", borderRadius: 8,
                    fontSize: 16, fontWeight: 700,
                    cursor: selectedPhoneIds.length === 0 || collectSubmitting ? "not-allowed" : "pointer",
                    opacity: selectedPhoneIds.length === 0 || collectSubmitting ? 0.5 : 1,
                    color: "var(--white)", background: "var(--accent)",
                  }}
                >
                  {collectSubmitting ? "Collecting..." : "Collect Payment"}
                </button>
              </>
            )}
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl} htmlFor="lump-amount">Amount (ETB) *</label>
              <input
                id="lump-amount" type="number" inputMode="decimal"
                min="0.01" step="any" placeholder="0.00"
                value={lumpAmount} onChange={(e) => setLumpAmount(e.target.value)}
                style={inp}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl} htmlFor="lump-memo">Memo</label>
              <textarea
                id="lump-memo" placeholder="Optional note..."
                value={lumpMemo} onChange={(e) => setLumpMemo(e.target.value)}
                rows={2}
                style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Payment Method</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["cash", "bank"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setLumpMethod(m)}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 8, cursor: "pointer",
                      fontSize: 14, fontWeight: 600,
                      border: lumpMethod === m ? "none" : "1px solid var(--surface-border)",
                      background: lumpMethod === m ? "var(--accent)" : "var(--bg)",
                      color: lumpMethod === m ? "var(--white)" : "var(--muted)",
                    }}
                  >
                    {m === "cash" ? "Cash" : "Bank"}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleCollect}
              disabled={!lumpAmount || parseFloat(lumpAmount) <= 0 || collectSubmitting}
              style={{
                width: "100%", padding: "13px 0", border: "none", borderRadius: 8,
                fontSize: 16, fontWeight: 700,
                cursor: !lumpAmount || collectSubmitting ? "not-allowed" : "pointer",
                opacity: !lumpAmount || parseFloat(lumpAmount) <= 0 || collectSubmitting ? 0.5 : 1,
                color: "var(--white)", background: "var(--accent)",
              }}
            >
              {collectSubmitting ? "Collecting..." : "Collect Payment"}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Give Phone Sheet */}
      <BottomSheet open={giveOpen} onClose={() => setGiveOpen(false)} title="Give Phone">
        {giveLoading ? (
          <p style={{ color: "var(--muted)", fontSize: 14, textAlign: "center", padding: "16px 0" }}>
            Loading stock...
          </p>
        ) : stockPhones.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14, textAlign: "center", padding: "16px 0" }}>
            No phones in stock
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stockPhones.map((phone) => (
              <div
                key={phone.id}
                onClick={() => handleGivePhone(phone.id)}
                style={{
                  background: "var(--bg)", border: "1px solid var(--surface-border)",
                  borderRadius: 10, padding: "12px 14px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--white)" }}>
                    {phone.brand} {phone.model}
                  </div>
                  {phone.storage && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {phone.storage} · {phone.condition.replace("_", " ")}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
                  {formatBirr(phone.asking_price)}
                </div>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
