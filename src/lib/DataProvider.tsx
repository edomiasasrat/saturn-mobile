"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import type { Phone, Seller, Transaction, BankEntry, DashboardStats, SellerWithStats } from "./types";

const STORAGE_KEY = "saturn_data_v2";

interface DataStore {
  phones: Phone[];
  sellers: Seller[];
  transactions: Transaction[];
  bankEntries: BankEntry[];
  lastSync: number;
}

interface DataContextType {
  // Data
  phones: Phone[];
  sellers: Seller[];
  transactions: Transaction[];
  bankEntries: BankEntry[];
  loading: boolean;

  // Computed
  getPhone: (id: number) => Phone | undefined;
  getSeller: (id: number) => Seller | undefined;
  getSellerStats: (id: number) => SellerWithStats | undefined;
  getDashboardStats: (period: string) => DashboardStats;
  getBankBalance: () => number;
  getTopSellers: (limit?: number) => SellerWithStats[];
  getTimelineEvents: () => TimelineEvent[];

  // Mutations (instant local + async server)
  addPhone: (data: Omit<Phone, "id" | "status" | "seller_id" | "created_at" | "distributed_at" | "sold_at">) => Promise<void>;
  deletePhone: (id: number) => Promise<void>;
  distributePhone: (phoneId: number, sellerId: number) => Promise<void>;
  returnPhone: (phoneId: number) => Promise<void>;
  quickSellPhone: (phoneId: number, price: number, paymentMethod: string) => Promise<void>;
  collectPerPhone: (sellerId: number, phoneIds: number[], paymentMethod: string) => Promise<void>;
  collectLumpSum: (sellerId: number, amount: number, paymentMethod: string, memo: string | null) => Promise<void>;
  addSeller: (data: { name: string; phone_number: string | null; location: string | null; memo: string | null }) => Promise<void>;
  deleteSeller: (id: number) => Promise<void>;
  addExpense: (data: { amount: number; description: string; memo: string | null; category: string }) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  addBankEntry: (data: { type: string; amount: number; memo: string | null }) => Promise<void>;

  // Sync
  refresh: () => Promise<void>;
}

export interface TimelineEvent {
  id: string;
  type: "phone_added" | "distributed" | "collected" | "returned" | "direct_sale" | "expense" | "bank_deposit" | "bank_withdrawal";
  title: string;
  subtitle: string | null;
  amount: number | null;
  amountType: "income" | "expense" | "neutral" | null;
  created_at: string;
}

const DataContext = createContext<DataContextType | null>(null);

export function useData(): DataContextType {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

function loadFromStorage(): DataStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveToStorage(store: DataStore) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* storage full — silently fail */ }
}

// Fire-and-forget server POST — don't await in the UI
function serverPost(url: string, body: unknown): void {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => { /* offline — ok */ });
}

function serverPatch(url: string, body: unknown): void {
  fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => { /* offline — ok */ });
}

function serverDelete(url: string): void {
  fetch(url, { method: "DELETE" }).catch(() => { /* offline — ok */ });
}

export default function DataProvider({ children }: { children: ReactNode }) {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankEntries, setBankEntries] = useState<BankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const nextId = useRef(Date.now()); // local temp IDs until server assigns real ones

  function tempId(): number {
    return nextId.current++;
  }

  // ── Hydrate from localStorage, then sync ──

  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      setPhones(stored.phones);
      setSellers(stored.sellers);
      setTransactions(stored.transactions);
      setBankEntries(stored.bankEntries);
      setLoading(false);
    }
    // Always sync with server (updates localStorage too)
    syncFromServer().then(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist to localStorage on every change ──

  useEffect(() => {
    if (loading) return;
    saveToStorage({ phones, sellers, transactions, bankEntries, lastSync: Date.now() });
  }, [phones, sellers, transactions, bankEntries, loading]);

  // ── Server sync ──

  async function syncFromServer() {
    try {
      const [pRes, sRes, tRes, bRes] = await Promise.all([
        fetch("/api/phones"),
        fetch("/api/sellers"),
        fetch("/api/transactions"),
        fetch("/api/bank"),
      ]);
      const [p, s, t, b] = await Promise.all([
        pRes.json(),
        sRes.json(),
        tRes.json(),
        bRes.json(),
      ]);
      setPhones(Array.isArray(p) ? p : []);
      setSellers(Array.isArray(s) ? s : []);
      setTransactions(Array.isArray(t) ? t : []);
      const entries = b.entries || b;
      setBankEntries(Array.isArray(entries) ? entries : []);
    } catch {
      // Offline — keep localStorage data
    }
  }

  const refresh = useCallback(async () => {
    await syncFromServer();
  }, []);

  // ── Computed ──

  const getPhone = useCallback((id: number) => phones.find((p) => p.id === id), [phones]);
  const getSeller = useCallback((id: number) => sellers.find((s) => s.id === id), [sellers]);

  const getSellerStats = useCallback((id: number): SellerWithStats | undefined => {
    const seller = sellers.find((s) => s.id === id);
    if (!seller) return undefined;
    const sellerPhones = phones.filter((p) => p.seller_id === id);
    const heldPhones = sellerPhones.filter((p) => p.status === "with_seller");
    const totalOwed = heldPhones.reduce((s, p) => s + p.asking_price, 0);
    const totalCollected = transactions
      .filter((t) => t.seller_id === id && t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    return {
      ...seller,
      phones_held: heldPhones.length,
      total_owed: totalOwed,
      total_collected: totalCollected,
      total_given: sellerPhones.length,
    };
  }, [sellers, phones, transactions]);

  const getBankBalance = useCallback((): number => {
    if (bankEntries.length === 0) return 0;
    const sorted = [...bankEntries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted[0].balance_after;
  }, [bankEntries]);

  const getDashboardStats = useCallback((period: string): DashboardStats => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    function inPeriod(dateStr: string): boolean {
      if (period === "all") return true;
      const d = new Date(dateStr);
      if (period === "today") return dateStr.startsWith(today);
      if (period === "week") return now.getTime() - d.getTime() < 7 * 86400000;
      if (period === "month") return now.getTime() - d.getTime() < 30 * 86400000;
      return true;
    }

    const inStock = phones.filter((p) => p.status === "in_stock");
    const withSellers = phones.filter((p) => p.status === "with_seller");
    const periodTx = transactions.filter((t) => inPeriod(t.created_at));
    const collections = periodTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = periodTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const balance = getBankBalance();
    const allIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const allExpenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const cashOnHand = allIncome - allExpenses;

    return {
      phones_in_stock: inStock.length,
      phones_with_sellers: withSellers.length,
      money_out_there: withSellers.reduce((s, p) => s + p.asking_price, 0),
      stock_value: inStock.reduce((s, p) => s + p.cost_price, 0),
      total_collections: collections,
      total_expenses: expenses,
      net_profit: collections - expenses,
      bank_balance: balance,
      total_capital: inStock.reduce((s, p) => s + p.cost_price, 0) + withSellers.reduce((s, p) => s + p.asking_price, 0) + balance + cashOnHand,
    };
  }, [phones, transactions, getBankBalance]);

  const getTopSellers = useCallback((limit = 5): SellerWithStats[] => {
    return sellers
      .map((s) => getSellerStats(s.id)!)
      .filter(Boolean)
      .sort((a, b) => b.total_owed - a.total_owed)
      .slice(0, limit);
  }, [sellers, getSellerStats]);

  const getTimelineEvents = useCallback((): TimelineEvent[] => {
    const sellerMap: Record<number, string> = {};
    for (const s of sellers) sellerMap[s.id] = s.name;

    const events: TimelineEvent[] = [];

    for (const p of phones) {
      events.push({
        id: `phone-add-${p.id}`, type: "phone_added",
        title: `Added ${p.brand} ${p.model} to stock`,
        subtitle: `Cost: ETB ${p.cost_price.toLocaleString()}`,
        amount: p.cost_price, amountType: "neutral", created_at: p.created_at,
      });
      if (p.distributed_at && p.seller_id) {
        events.push({
          id: `phone-dist-${p.id}`, type: "distributed",
          title: `Gave ${p.brand} ${p.model} to ${sellerMap[p.seller_id] || "Unknown"}`,
          subtitle: `Asking: ETB ${p.asking_price.toLocaleString()}`,
          amount: p.asking_price, amountType: "neutral", created_at: p.distributed_at,
        });
      }
    }

    for (const t of transactions) {
      const sellerName = t.seller_id ? sellerMap[t.seller_id] : null;
      let type: TimelineEvent["type"];
      if (t.category === "collection") type = "collected";
      else if (t.category === "direct_sale") type = "direct_sale";
      else type = "expense";
      events.push({
        id: `tx-${t.id}`, type,
        title: t.description,
        subtitle: [sellerName, t.memo].filter(Boolean).join(" · ") || null,
        amount: t.amount, amountType: t.type === "income" ? "income" : "expense",
        created_at: t.created_at,
      });
    }

    for (const b of bankEntries) {
      events.push({
        id: `bank-${b.id}`, type: b.type === "deposit" ? "bank_deposit" : "bank_withdrawal",
        title: `Bank ${b.type}`, subtitle: b.memo,
        amount: b.amount, amountType: b.type === "deposit" ? "income" : "expense",
        created_at: b.created_at,
      });
    }

    return events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [phones, sellers, transactions, bankEntries]);

  // ── Mutations ──

  const addPhone = useCallback(async (data: Omit<Phone, "id" | "status" | "seller_id" | "created_at" | "distributed_at" | "sold_at">) => {
    const localPhone: Phone = {
      ...data, id: tempId(), status: "in_stock", seller_id: null,
      created_at: new Date().toISOString(), distributed_at: null, sold_at: null,
    };
    setPhones((prev) => [localPhone, ...prev]);
    // Server — response has real ID, sync will fix it
    serverPost("/api/phones", data);
    // Quick re-sync to get real ID
    setTimeout(() => syncFromServer(), 500);
  }, []);

  const deletePhone = useCallback(async (id: number) => {
    setPhones((prev) => prev.filter((p) => p.id !== id));
    serverDelete(`/api/phones/${id}`);
  }, []);

  const distributePhone = useCallback(async (phoneId: number, sellerId: number) => {
    setPhones((prev) => prev.map((p) =>
      p.id === phoneId ? { ...p, status: "with_seller" as const, seller_id: sellerId, distributed_at: new Date().toISOString() } : p
    ));
    serverPatch(`/api/phones/${phoneId}`, { action: "distribute", seller_id: sellerId });
  }, []);

  const returnPhone = useCallback(async (phoneId: number) => {
    setPhones((prev) => prev.map((p) =>
      p.id === phoneId ? { ...p, status: "in_stock" as const, seller_id: null, distributed_at: null } : p
    ));
    serverPatch(`/api/phones/${phoneId}`, { action: "return" });
  }, []);

  const quickSellPhone = useCallback(async (phoneId: number, price: number, paymentMethod: string) => {
    const phone = phones.find((p) => p.id === phoneId);
    if (!phone) return;

    setPhones((prev) => prev.map((p) =>
      p.id === phoneId ? { ...p, status: "sold" as const, sold_at: new Date().toISOString() } : p
    ));

    const tx: Transaction = {
      id: tempId(), type: "income", amount: price,
      description: `Direct sale: ${phone.brand} ${phone.model}`,
      memo: null, phone_id: phoneId, seller_id: null,
      category: "direct_sale", payment_method: paymentMethod as "cash" | "bank",
      created_at: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);

    if (paymentMethod === "bank") {
      const bal = getBankBalance();
      const entry: BankEntry = {
        id: tempId(), type: "deposit", amount: price,
        memo: `Direct sale: ${phone.brand} ${phone.model}`,
        balance_after: bal + price, created_at: new Date().toISOString(),
      };
      setBankEntries((prev) => [entry, ...prev]);
    }

    serverPatch(`/api/phones/${phoneId}`, { action: "quick_sell", price, payment_method: paymentMethod });
    setTimeout(() => syncFromServer(), 500);
  }, [phones, getBankBalance]);

  const collectPerPhone = useCallback(async (sellerId: number, phoneIds: number[], paymentMethod: string) => {
    const seller = sellers.find((s) => s.id === sellerId);
    let totalAmount = 0;

    setPhones((prev) => prev.map((p) => {
      if (phoneIds.includes(p.id) && p.seller_id === sellerId && p.status === "with_seller") {
        totalAmount += p.asking_price;
        return { ...p, status: "sold" as const, sold_at: new Date().toISOString() };
      }
      return p;
    }));

    const newTxs = phoneIds.map((pid) => {
      const phone = phones.find((p) => p.id === pid);
      return {
        id: tempId(), type: "income" as const, amount: phone?.asking_price || 0,
        description: `Collection: ${phone?.brand} ${phone?.model}`,
        memo: null, phone_id: pid, seller_id: sellerId,
        category: "collection" as const, payment_method: paymentMethod as "cash" | "bank",
        created_at: new Date().toISOString(),
      };
    });
    setTransactions((prev) => [...newTxs, ...prev]);

    if (paymentMethod === "bank" && totalAmount > 0) {
      const bal = getBankBalance();
      const entry: BankEntry = {
        id: tempId(), type: "deposit", amount: totalAmount,
        memo: `Collection from ${seller?.name}`,
        balance_after: bal + totalAmount, created_at: new Date().toISOString(),
      };
      setBankEntries((prev) => [entry, ...prev]);
    }

    serverPost(`/api/sellers/${sellerId}/collect`, { mode: "per_phone", phone_ids: phoneIds, payment_method: paymentMethod });
    setTimeout(() => syncFromServer(), 500);
  }, [phones, sellers, getBankBalance]);

  const collectLumpSum = useCallback(async (sellerId: number, amount: number, paymentMethod: string, memo: string | null) => {
    const seller = sellers.find((s) => s.id === sellerId);
    const tx: Transaction = {
      id: tempId(), type: "income", amount,
      description: `Lump sum from ${seller?.name}`,
      memo, phone_id: null, seller_id: sellerId,
      category: "collection", payment_method: paymentMethod as "cash" | "bank",
      created_at: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);

    if (paymentMethod === "bank") {
      const bal = getBankBalance();
      const entry: BankEntry = {
        id: tempId(), type: "deposit", amount,
        memo: `Lump sum from ${seller?.name}`,
        balance_after: bal + amount, created_at: new Date().toISOString(),
      };
      setBankEntries((prev) => [entry, ...prev]);
    }

    serverPost(`/api/sellers/${sellerId}/collect`, { mode: "lump_sum", amount, payment_method: paymentMethod, memo });
    setTimeout(() => syncFromServer(), 500);
  }, [sellers, getBankBalance]);

  const addSeller = useCallback(async (data: { name: string; phone_number: string | null; location: string | null; memo: string | null }) => {
    const local: Seller = { id: tempId(), ...data, created_at: new Date().toISOString() };
    setSellers((prev) => [...prev, local]);
    serverPost("/api/sellers", data);
    setTimeout(() => syncFromServer(), 500);
  }, []);

  const deleteSeller = useCallback(async (id: number) => {
    setSellers((prev) => prev.filter((s) => s.id !== id));
    serverDelete(`/api/sellers/${id}`);
  }, []);

  const addExpense = useCallback(async (data: { amount: number; description: string; memo: string | null; category: string }) => {
    const tx: Transaction = {
      id: tempId(), type: "expense", amount: data.amount,
      description: data.description, memo: data.memo,
      phone_id: null, seller_id: null,
      category: data.category as Transaction["category"],
      payment_method: null, created_at: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);
    serverPost("/api/transactions", { ...data, type: "expense" });
    setTimeout(() => syncFromServer(), 500);
  }, []);

  const deleteTransaction = useCallback(async (id: number) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    serverDelete(`/api/transactions/${id}`);
  }, []);

  const addBankEntry = useCallback(async (data: { type: string; amount: number; memo: string | null }) => {
    const bal = getBankBalance();
    const newBal = data.type === "deposit" ? bal + data.amount : bal - data.amount;
    const entry: BankEntry = {
      id: tempId(), type: data.type as "deposit" | "withdrawal",
      amount: data.amount, memo: data.memo, balance_after: newBal,
      created_at: new Date().toISOString(),
    };
    setBankEntries((prev) => [entry, ...prev]);
    serverPost("/api/bank", data);
    setTimeout(() => syncFromServer(), 500);
  }, [getBankBalance]);

  return (
    <DataContext.Provider value={{
      phones, sellers, transactions, bankEntries, loading,
      getPhone, getSeller, getSellerStats, getDashboardStats, getBankBalance, getTopSellers, getTimelineEvents,
      addPhone, deletePhone, distributePhone, returnPhone, quickSellPhone,
      collectPerPhone, collectLumpSum,
      addSeller, deleteSeller,
      addExpense, deleteTransaction,
      addBankEntry,
      refresh,
    }}>
      {children}
    </DataContext.Provider>
  );
}
