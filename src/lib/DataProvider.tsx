"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import type { Phone, Seller, Transaction, BankAccount, BankLog, DashboardStats, SellerWithStats, PhoneActivity, Loan, LoanPayment } from "./types";

const STORAGE_KEY = "saturn_data_v2";

interface DataStore {
  phones: Phone[];
  sellers: Seller[];
  transactions: Transaction[];
  bankAccounts: BankAccount[];
  bankLog: BankLog[];
  loans: Loan[];
  lastSync: number;
}

interface DataContextType {
  // Data
  phones: Phone[];
  sellers: Seller[];
  transactions: Transaction[];
  bankAccounts: BankAccount[];
  bankLog: BankLog[];
  loans: Loan[];
  loading: boolean;

  // Computed
  getPhone: (id: number) => Phone | undefined;
  getSeller: (id: number) => Seller | undefined;
  getSellerStats: (id: number) => SellerWithStats | undefined;
  getDashboardStats: (period: string) => DashboardStats;
  getTotalLiquid: () => number;
  getTopSellers: (limit?: number) => SellerWithStats[];
  getTimelineEvents: () => TimelineEvent[];
  getPhoneActivity: (period: string) => PhoneActivity;
  getProfitLoss: (period: string) => { income: number; expenses: number; profit: number };
  getNetWorth: () => number;

  // Mutations (instant local + async server)
  addPhone: (data: Omit<Phone, "id" | "status" | "seller_id" | "created_at" | "distributed_at" | "sold_at">) => Promise<void>;
  deletePhone: (id: number) => Promise<void>;
  distributePhone: (phoneId: number, sellerId: number) => Promise<void>;
  returnPhone: (phoneId: number) => Promise<void>;
  quickSellPhone: (phoneId: number, price: number, paymentMethod: string) => Promise<void>;
  collectPerPhone: (sellerId: number, phoneIds: number[], paymentMethod: string, priceOverride?: number) => Promise<void>;
  collectLumpSum: (sellerId: number, amount: number, paymentMethod: string, memo: string | null) => Promise<void>;
  addSeller: (data: { name: string; phone_number: string | null; location: string | null; memo: string | null }) => Promise<void>;
  updateSeller: (id: number, data: { name: string; phone_number: string | null; location: string | null; memo: string | null }) => Promise<void>;
  deleteSeller: (id: number) => Promise<void>;
  updatePhone: (id: number, data: { brand: string; model: string; imei: string | null; storage: string | null; color: string | null; condition: string; cost_price: number; asking_price: number; memo: string | null }) => Promise<void>;
  addExpense: (data: { amount: number; description: string; memo: string | null; category: string; payment_method?: string }) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  addBankAccount: (data: { name: string; currency: string; balance: number; exchange_rate?: number }) => Promise<void>;
  updateBankBalance: (accountId: number, newBalance: number, memo: string | null) => Promise<void>;
  updateBankRate: (accountId: number, exchangeRate: number) => Promise<void>;
  deleteBankAccount: (accountId: number) => Promise<void>;

  // Loans
  addLoan: (data: { person_name: string; phone_number: string | null; original_amount: number; loan_type: "given" | "taken"; memo: string | null }) => Promise<void>;
  updateLoan: (id: number, data: { person_name: string; phone_number: string | null; memo: string | null }) => Promise<void>;
  deleteLoan: (id: number) => Promise<void>;
  addLoanPayment: (loanId: number, amount: number, memo: string | null) => Promise<void>;
  adjustLoanAmount: (loanId: number, newRemaining: number) => Promise<void>;

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

// Server calls — awaited so sequential operations don't race
async function serverPost(url: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch { return null; /* offline */ }
}

async function serverPatch(url: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch { return null; /* offline */ }
}

async function serverDelete(url: string): Promise<void> {
  try { await fetch(url, { method: "DELETE" }); } catch { /* offline */ }
}

export default function DataProvider({ children }: { children: ReactNode }) {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankLog, setBankLog] = useState<BankLog[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const nextId = useRef(Date.now()); // local temp IDs until server assigns real ones
  const syncTimer = useRef<NodeJS.Timeout | null>(null);
  const deletedPhoneIds = useRef<Set<number>>(new Set());
  const deletedSellerIds = useRef<Set<number>>(new Set());
  const deletedTransactionIds = useRef<Set<number>>(new Set());
  const deletedLoanIds = useRef<Set<number>>(new Set());

  // Debounced sync — waits 800ms after last mutation to avoid overlapping syncs
  function debouncedSync() {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => syncFromServer(), 800);
  }

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
      setBankAccounts(stored.bankAccounts || []);
      setBankLog(stored.bankLog || []);
      setLoans(stored.loans || []);
      setLoading(false);
    }
    // Always sync with server (updates localStorage too)
    syncFromServer().then(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist to localStorage on every change ──

  useEffect(() => {
    if (loading) return;
    saveToStorage({ phones, sellers, transactions, bankAccounts, bankLog, loans, lastSync: Date.now() });
  }, [phones, sellers, transactions, bankAccounts, bankLog, loans, loading]);

  // ── Server sync ──

  async function syncFromServer() {
    try {
      const [pRes, sRes, tRes, bRes, lRes] = await Promise.all([
        fetch("/api/phones"),
        fetch("/api/sellers"),
        fetch("/api/transactions"),
        fetch("/api/bank"),
        fetch("/api/loans"),
      ]);
      const [p, s, t, b, l] = await Promise.all([
        pRes.json(),
        sRes.json(),
        tRes.json(),
        bRes.json(),
        lRes.json(),
      ]);
      // Filter out items that were deleted locally but may still be in server response
      const phonesArr = Array.isArray(p) ? p : [];
      const sellersArr = Array.isArray(s) ? s : [];
      const txArr = Array.isArray(t) ? t : [];
      const accountsArr = Array.isArray(b.accounts) ? b.accounts : [];
      const logArr = Array.isArray(b.log) ? b.log : [];
      const loansArr = Array.isArray(l) ? l : [];

      setPhones(phonesArr.filter((ph: Phone) => !deletedPhoneIds.current.has(ph.id)));
      setSellers(sellersArr.filter((sl: Seller) => !deletedSellerIds.current.has(sl.id)));
      setTransactions(txArr.filter((tx: Transaction) => !deletedTransactionIds.current.has(tx.id)));
      setBankAccounts(accountsArr);
      setBankLog(logArr);
      setLoans(loansArr.filter((ln: Loan) => !deletedLoanIds.current.has(ln.id)));

      // Clear deleted IDs only for items that are confirmed gone from server
      const serverPhoneIds = new Set(phonesArr.map((p: Phone) => p.id));
      const serverSellerIds = new Set(sellersArr.map((s: Seller) => s.id));
      const serverTxIds = new Set(txArr.map((t: Transaction) => t.id));
      const serverLoanIds = new Set(loansArr.map((l: Loan) => l.id));

      for (const id of deletedPhoneIds.current) { if (!serverPhoneIds.has(id)) deletedPhoneIds.current.delete(id); }
      for (const id of deletedSellerIds.current) { if (!serverSellerIds.has(id)) deletedSellerIds.current.delete(id); }
      for (const id of deletedTransactionIds.current) { if (!serverTxIds.has(id)) deletedTransactionIds.current.delete(id); }
      for (const id of deletedLoanIds.current) { if (!serverLoanIds.has(id)) deletedLoanIds.current.delete(id); }
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

  const getTotalLiquid = useCallback((): number => {
    return bankAccounts.reduce((sum, a) => sum + a.balance * a.exchange_rate, 0);
  }, [bankAccounts]);

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
    const allExpenses = periodTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    // Operating expenses exclude phone purchases (capital conversion, not a loss)
    const operatingExpenses = periodTx.filter((t) => t.type === "expense" && t.category !== "purchase").reduce((s, t) => s + t.amount, 0);

    return {
      phones_in_stock: inStock.length,
      phones_with_sellers: withSellers.length,
      money_out_there: withSellers.reduce((s, p) => s + p.asking_price, 0),
      stock_value: inStock.reduce((s, p) => s + p.cost_price, 0),
      total_collections: collections,
      total_expenses: allExpenses,
      total_operating_expenses: operatingExpenses,
      net_profit: collections - operatingExpenses,
    };
  }, [phones, transactions]);

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

    return events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [phones, sellers, transactions]);

  const getPhoneActivity = useCallback((period: string): PhoneActivity => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    function inPeriod(dateStr: string | null): boolean {
      if (!dateStr) return false;
      if (period === "all") return true;
      const d = new Date(dateStr);
      if (period === "today") return dateStr.startsWith(today);
      if (period === "week") return now.getTime() - d.getTime() < 7 * 86400000;
      if (period === "month") return now.getTime() - d.getTime() < 30 * 86400000;
      return true;
    }

    const bought = phones.filter((p) => inPeriod(p.created_at)).length;
    const sold = phones.filter((p) => p.status === "sold" && inPeriod(p.sold_at)).length;
    const soldByMe = transactions.filter((t) => t.category === "direct_sale" && inPeriod(t.created_at)).length;
    const soldBySellers = transactions.filter((t) => t.category === "collection" && t.phone_id != null && inPeriod(t.created_at)).length;

    return { bought, sold, sold_by_me: soldByMe, sold_by_sellers: soldBySellers };
  }, [phones, transactions]);

  const getProfitLoss = useCallback((period: string): { income: number; expenses: number; profit: number } => {
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

    const periodTx = transactions.filter((t) => inPeriod(t.created_at));
    const income = periodTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    // Operating expenses only — phone purchases are capital conversion, not losses
    const expenses = periodTx.filter((t) => t.type === "expense" && t.category !== "purchase").reduce((s, t) => s + t.amount, 0);

    return { income, expenses, profit: income - expenses };
  }, [transactions]);

  const getNetWorth = useCallback((): number => {
    const inventoryValue = phones
      .filter((p) => p.status === "in_stock" || p.status === "with_seller")
      .reduce((s, p) => s + p.cost_price, 0);
    const liquidETB = bankAccounts.reduce((s, a) => s + a.balance * a.exchange_rate, 0);
    const loansGiven = loans.filter((l) => (l.loan_type || "given") === "given").reduce((s, l) => s + l.remaining_amount, 0);
    const loansTaken = loans.filter((l) => l.loan_type === "taken").reduce((s, l) => s + l.remaining_amount, 0);
    return inventoryValue + liquidETB + loansGiven - loansTaken;
  }, [phones, bankAccounts, loans]);

  // ── Mutations ──

  const addPhone = useCallback(async (data: Omit<Phone, "id" | "status" | "seller_id" | "created_at" | "distributed_at" | "sold_at">) => {
    const phoneId = tempId();
    const localPhone: Phone = {
      ...data, id: phoneId, status: "in_stock", seller_id: null,
      created_at: new Date().toISOString(), distributed_at: null, sold_at: null,
    };
    setPhones((prev) => [localPhone, ...prev]);

    // Auto-create purchase expense so capital tracks money spent
    const purchaseTx: Transaction = {
      id: tempId(), type: "expense", amount: data.cost_price,
      description: `Purchased: ${data.brand} ${data.model}`,
      memo: null, phone_id: phoneId, seller_id: null,
      category: "purchase", payment_method: "cash",
      created_at: new Date().toISOString(),
    };
    setTransactions((prev) => [purchaseTx, ...prev]);

    // Server — response has real ID, sync will fix it
    serverPost("/api/phones", data);
    // Quick re-sync to get real ID
    debouncedSync();
  }, []);

  const updatePhone = useCallback(async (id: number, data: { brand: string; model: string; imei: string | null; storage: string | null; color: string | null; condition: string; cost_price: number; asking_price: number; memo: string | null }) => {
    setPhones((prev) => prev.map((p) => p.id === id ? { ...p, ...data, condition: data.condition as Phone["condition"] } : p));
    serverPatch(`/api/phones/${id}`, { action: "update", ...data });
    debouncedSync();
  }, []);

  const deletePhone = useCallback(async (id: number) => {
    deletedPhoneIds.current.add(id);
    setPhones((prev) => prev.filter((p) => p.id !== id));
    await serverDelete(`/api/phones/${id}`);
    debouncedSync();
  }, []);

  const distributePhone = useCallback(async (phoneId: number, sellerId: number) => {
    setPhones((prev) => prev.map((p) =>
      p.id === phoneId ? { ...p, status: "with_seller" as const, seller_id: sellerId, distributed_at: new Date().toISOString() } : p
    ));
    await serverPatch(`/api/phones/${phoneId}`, { action: "distribute", seller_id: sellerId });
    debouncedSync();
  }, []);

  const returnPhone = useCallback(async (phoneId: number) => {
    setPhones((prev) => prev.map((p) =>
      p.id === phoneId ? { ...p, status: "in_stock" as const, seller_id: null, distributed_at: null } : p
    ));
    await serverPatch(`/api/phones/${phoneId}`, { action: "return" });
    debouncedSync();
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

    serverPatch(`/api/phones/${phoneId}`, { action: "quick_sell", price, payment_method: paymentMethod });
    debouncedSync();
  }, [phones]);

  const collectPerPhone = useCallback(async (sellerId: number, phoneIds: number[], paymentMethod: string, priceOverride?: number) => {
    const seller = sellers.find((s) => s.id === sellerId);
    let totalAmount = 0;
    const isSingleWithOverride = phoneIds.length === 1 && priceOverride != null;

    setPhones((prev) => prev.map((p) => {
      if (phoneIds.includes(p.id) && p.seller_id === sellerId && p.status === "with_seller") {
        totalAmount += isSingleWithOverride ? priceOverride : p.asking_price;
        return { ...p, status: "sold" as const, sold_at: new Date().toISOString() };
      }
      return p;
    }));

    const newTxs = phoneIds.map((pid) => {
      const phone = phones.find((p) => p.id === pid);
      const amount = isSingleWithOverride ? priceOverride : (phone?.asking_price || 0);
      return {
        id: tempId(), type: "income" as const, amount,
        description: `Collection: ${phone?.brand} ${phone?.model}`,
        memo: null, phone_id: pid, seller_id: sellerId,
        category: "collection" as const, payment_method: paymentMethod as "cash" | "bank",
        created_at: new Date().toISOString(),
      };
    });
    setTransactions((prev) => [...newTxs, ...prev]);

    serverPost(`/api/sellers/${sellerId}/collect`, { mode: "per_phone", phone_ids: phoneIds, payment_method: paymentMethod, price_override: priceOverride });
    debouncedSync();
  }, [phones, sellers]);

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

    serverPost(`/api/sellers/${sellerId}/collect`, { mode: "lump_sum", amount, payment_method: paymentMethod, memo });
    debouncedSync();
  }, [sellers]);

  const addSeller = useCallback(async (data: { name: string; phone_number: string | null; location: string | null; memo: string | null }) => {
    const local: Seller = { id: tempId(), ...data, created_at: new Date().toISOString() };
    setSellers((prev) => [...prev, local]);
    serverPost("/api/sellers", data);
    debouncedSync();
  }, []);

  const updateSeller = useCallback(async (id: number, data: { name: string; phone_number: string | null; location: string | null; memo: string | null }) => {
    setSellers((prev) => prev.map((s) => s.id === id ? { ...s, ...data } : s));
    serverPatch(`/api/sellers/${id}`, data);
    debouncedSync();
  }, []);

  const deleteSeller = useCallback(async (id: number) => {
    deletedSellerIds.current.add(id);
    setSellers((prev) => prev.filter((s) => s.id !== id));
    await serverDelete(`/api/sellers/${id}`);
    debouncedSync();
  }, []);

  const addExpense = useCallback(async (data: { amount: number; description: string; memo: string | null; category: string; payment_method?: string }) => {
    const pm = (data.payment_method || "cash") as "cash" | "bank";
    const tx: Transaction = {
      id: tempId(), type: "expense", amount: data.amount,
      description: data.description, memo: data.memo,
      phone_id: null, seller_id: null,
      category: data.category as Transaction["category"],
      payment_method: pm, created_at: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);

    serverPost("/api/transactions", { ...data, type: "expense", payment_method: pm });
    debouncedSync();
  }, []);

  const deleteTransaction = useCallback(async (id: number) => {
    deletedTransactionIds.current.add(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    await serverDelete(`/api/transactions/${id}`);
    debouncedSync();
  }, []);

  const addBankAccount = useCallback(async (data: { name: string; currency: string; balance: number; exchange_rate?: number }) => {
    const local: BankAccount = {
      id: tempId(), name: data.name,
      currency: data.currency as BankAccount["currency"],
      balance: data.balance,
      exchange_rate: data.exchange_rate ?? 1,
      memo: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setBankAccounts((prev) => [...prev, local]);
    const logEntry: BankLog = {
      id: tempId(), account_id: local.id,
      balance_before: 0, balance_after: data.balance,
      memo: "Opening balance", created_at: new Date().toISOString(),
    };
    setBankLog((prev) => [logEntry, ...prev]);
    serverPost("/api/bank", data);
    debouncedSync();
  }, []);

  const updateBankBalance = useCallback(async (accountId: number, newBalance: number, memo: string | null) => {
    const account = bankAccounts.find((a) => a.id === accountId);
    const oldBalance = account?.balance ?? 0;
    setBankAccounts((prev) => prev.map((a) =>
      a.id === accountId ? { ...a, balance: newBalance, memo, updated_at: new Date().toISOString() } : a
    ));
    const logEntry: BankLog = {
      id: tempId(), account_id: accountId,
      balance_before: oldBalance, balance_after: newBalance,
      memo, created_at: new Date().toISOString(),
    };
    setBankLog((prev) => [logEntry, ...prev]);
    serverPatch("/api/bank", { action: "update_balance", account_id: accountId, balance: newBalance, memo });
    debouncedSync();
  }, [bankAccounts]);

  const updateBankRate = useCallback(async (accountId: number, exchangeRate: number) => {
    setBankAccounts((prev) => prev.map((a) =>
      a.id === accountId ? { ...a, exchange_rate: exchangeRate, updated_at: new Date().toISOString() } : a
    ));
    serverPatch("/api/bank", { action: "update_rate", account_id: accountId, exchange_rate: exchangeRate });
    debouncedSync();
  }, []);

  const deleteBankAccount = useCallback(async (accountId: number) => {
    setBankAccounts((prev) => prev.filter((a) => a.id !== accountId));
    setBankLog((prev) => prev.filter((l) => l.account_id !== accountId));
    await serverDelete(`/api/bank?id=${accountId}`);
    debouncedSync();
  }, []);

  // ── Loan Mutations ──

  const addLoan = useCallback(async (data: { person_name: string; phone_number: string | null; original_amount: number; loan_type: "given" | "taken"; memo: string | null }) => {
    const local: Loan = {
      id: tempId(), ...data, remaining_amount: data.original_amount,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setLoans((prev) => [local, ...prev]);
    serverPost("/api/loans", data);
    debouncedSync();
  }, []);

  const updateLoan = useCallback(async (id: number, data: { person_name: string; phone_number: string | null; memo: string | null }) => {
    setLoans((prev) => prev.map((l) => l.id === id ? { ...l, ...data, updated_at: new Date().toISOString() } : l));
    serverPatch(`/api/loans/${id}`, data);
    debouncedSync();
  }, []);

  const deleteLoan = useCallback(async (id: number) => {
    deletedLoanIds.current.add(id);
    setLoans((prev) => prev.filter((l) => l.id !== id));
    await serverDelete(`/api/loans/${id}`);
    debouncedSync();
  }, []);

  const addLoanPayment = useCallback(async (loanId: number, amount: number, memo: string | null) => {
    setLoans((prev) => prev.map((l) => l.id === loanId ? { ...l, remaining_amount: l.remaining_amount - amount, updated_at: new Date().toISOString() } : l));
    serverPatch(`/api/loans/${loanId}`, { action: "payment", amount, memo });
    debouncedSync();
  }, []);

  const adjustLoanAmount = useCallback(async (loanId: number, newRemaining: number) => {
    setLoans((prev) => prev.map((l) => l.id === loanId ? { ...l, remaining_amount: newRemaining, updated_at: new Date().toISOString() } : l));
    serverPatch(`/api/loans/${loanId}`, { action: "adjust", remaining_amount: newRemaining });
    debouncedSync();
  }, []);

  return (
    <DataContext.Provider value={{
      phones, sellers, transactions, bankAccounts, bankLog, loans, loading,
      getPhone, getSeller, getSellerStats, getDashboardStats, getTotalLiquid, getTopSellers, getTimelineEvents, getPhoneActivity, getProfitLoss, getNetWorth,
      addPhone, updatePhone, deletePhone, distributePhone, returnPhone, quickSellPhone,
      collectPerPhone, collectLumpSum,
      addSeller, updateSeller, deleteSeller,
      addExpense, deleteTransaction,
      addBankAccount, updateBankBalance, updateBankRate, deleteBankAccount,
      addLoan, updateLoan, deleteLoan, addLoanPayment, adjustLoanAmount,
      refresh,
    }}>
      {children}
    </DataContext.Provider>
  );
}
