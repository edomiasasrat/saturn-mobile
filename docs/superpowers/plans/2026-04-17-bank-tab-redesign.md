# Bank Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the transactional bank ledger with a simple manual balance tracker — new schema, new API, new UI, decoupled from sales/expenses.

**Architecture:** Two new tables (`saturn_bank_accounts`, `saturn_bank_log`) replace `saturn_bank_entries`. All auto bank-entry side-effects removed from transaction flows. DataProvider state changes from `bankEntries: BankEntry[]` to `bankAccounts: BankAccount[]` + `bankLog: BankLog[]`. Net worth becomes a single ETB number using exchange rates stored per account.

**Tech Stack:** Next.js 16, TypeScript, libSQL/Turso, React (client components), inline styles (existing pattern)

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/types.ts` | Replace `BankEntry` with `BankAccount` + `BankLog` types |
| Modify | `src/lib/db.ts` | New schema, migration, new bank functions, remove old bank side-effects |
| Modify | `src/app/api/bank/route.ts` | New GET/POST/PATCH/DELETE handlers for accounts |
| Modify | `src/lib/DataProvider.tsx` | Replace bank state/mutations/computed, update `getNetWorth`, remove side-effects |
| Modify | `src/app/bank/page.tsx` | Complete rewrite — account cards, activity log, rate editing |
| Modify | `src/app/page.tsx` | Update dashboard bank stat + modal, update net worth display |
| Modify | `src/app/timeline/page.tsx` | Remove bank_deposit/bank_withdrawal event types |

---

### Task 1: Update Types

**Files:**
- Modify: `src/lib/types.ts:41-50`

- [ ] **Step 1: Replace BankEntry with BankAccount and BankLog types**

Replace the `BankEntry` interface (lines 41-50) with:

```typescript
export interface BankAccount {
  id: number;
  name: string;
  currency: "birr" | "usd" | "usdt";
  balance: number;
  exchange_rate: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankLog {
  id: number;
  account_id: number;
  balance_before: number;
  balance_after: number;
  memo: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Update DashboardStats to remove bank_balance_birr**

In `DashboardStats` (line 96), remove `bank_balance_birr: number;`. The dashboard will read bank balance directly from accounts, not from stats.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "refactor: replace BankEntry type with BankAccount + BankLog"
```

---

### Task 2: Update Database Layer

**Files:**
- Modify: `src/lib/db.ts:1-2` (imports)
- Modify: `src/lib/db.ts:88-98` (schema)
- Modify: `src/lib/db.ts:104-111` (alter statements)
- Modify: `src/lib/db.ts:248-270` (quickSellPhone — remove bank side-effect)
- Modify: `src/lib/db.ts:300-330` (collectPerPhone — remove bank side-effect)
- Modify: `src/lib/db.ts:332-348` (collectLumpSum — remove bank side-effect)
- Modify: `src/lib/db.ts:364-381` (addTransaction — remove bank side-effect)
- Modify: `src/lib/db.ts:388-449` (replace all bank functions)
- Modify: `src/lib/db.ts:464-506` (getDashboardStats — remove bank_balance_birr)

- [ ] **Step 1: Update import**

In the import on line 1-2, replace `BankEntry` with `BankAccount, BankLog`:

```typescript
import type { Phone, Transaction, BankAccount, BankLog, Seller, SellerWithStats, DashboardStats, PhoneActivity, Loan, LoanPayment } from "./types";
```

- [ ] **Step 2: Update schema — replace bank_entries table with new tables**

Replace the `saturn_bank_entries` CREATE TABLE block (lines 88-98) with:

```sql
-- Bank accounts (one row per account)
`CREATE TABLE IF NOT EXISTS saturn_bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  currency TEXT NOT NULL CHECK(currency IN ('birr', 'usd', 'usdt')),
  balance INTEGER NOT NULL DEFAULT 0,
  exchange_rate REAL NOT NULL DEFAULT 1,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,

-- Bank activity log
`CREATE TABLE IF NOT EXISTS saturn_bank_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES saturn_bank_accounts(id) ON DELETE CASCADE,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
```

- [ ] **Step 3: Add migration from old table**

After the `initDb` function's ALTER statements block (after line 111), add migration logic. This runs once — if the old table exists and the new one is empty, migrate data:

```typescript
// Migrate from saturn_bank_entries to saturn_bank_accounts (one-time)
try {
  const oldExists = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='saturn_bank_entries'",
    args: [],
  });
  if (oldExists.rows.length > 0) {
    const newCount = await client.execute({ sql: "SELECT COUNT(*) as cnt FROM saturn_bank_accounts", args: [] });
    if (Number((newCount.rows[0] as unknown as { cnt: number }).cnt) === 0) {
      // Get latest balance per bank_name + currency from old entries
      const latest = await client.execute({
        sql: `SELECT COALESCE(bank_name, 'Cash') as name, currency, balance_after as balance
              FROM saturn_bank_entries
              WHERE id IN (
                SELECT MAX(id) FROM saturn_bank_entries
                GROUP BY COALESCE(bank_name, 'Cash'), currency
              )`,
        args: [],
      });
      for (const row of latest.rows) {
        const r = row as unknown as { name: string; currency: string; balance: number };
        await client.execute({
          sql: "INSERT INTO saturn_bank_accounts (name, currency, balance, exchange_rate) VALUES (?, ?, ?, 1)",
          args: [r.name, r.currency, r.balance],
        });
      }
    }
    // Drop old table after successful migration
    await client.execute("DROP TABLE IF EXISTS saturn_bank_entries");
  }
} catch { /* migration already done or old table doesn't exist */ }
```

- [ ] **Step 4: Remove old ALTER statements for bank_entries**

Remove these two lines from the `alterStatements` array (lines 105-106):

```typescript
"ALTER TABLE saturn_bank_entries ADD COLUMN bank_name TEXT",
"ALTER TABLE saturn_bank_entries ADD COLUMN currency TEXT NOT NULL DEFAULT 'birr'",
```

- [ ] **Step 5: Remove bank side-effect from quickSellPhone**

In `quickSellPhone()` (around lines 264-266), remove the bank entry creation:

```typescript
// DELETE these lines:
  if (paymentMethod === "bank") {
    await addBankEntry({ type: "deposit", amount: actualPrice, memo: `Direct sale: ${phone.brand} ${phone.model}` });
  }
```

- [ ] **Step 6: Remove bank side-effect from collectPerPhone**

In `collectPerPhone()` (around lines 323-328), remove:

```typescript
// DELETE these lines:
  const totalAmount = transactions.reduce((s, t) => s + t.amount, 0);
  if (paymentMethod === "bank" && totalAmount > 0) {
    const seller = await getSeller(sellerId);
    await addBankEntry({ type: "deposit", amount: totalAmount, memo: `Collection from ${seller?.name}` });
  }
```

- [ ] **Step 7: Remove bank side-effect from collectLumpSum**

In `collectLumpSum()` (around lines 344-347), remove:

```typescript
// DELETE these lines:
  if (paymentMethod === "bank") {
    await addBankEntry({ type: "deposit", amount, memo: `Lump sum from ${seller.name}` });
  }
```

- [ ] **Step 8: Remove bank side-effect from addTransaction**

In `addTransaction()` (around lines 375-378), remove:

```typescript
// DELETE these lines:
  // If expense paid from bank, create a bank withdrawal
  if (data.type === "expense" && pm === "bank") {
    await addBankEntry({ type: "withdrawal", amount: data.amount, memo: data.description });
  }
```

- [ ] **Step 9: Replace all old bank functions with new ones**

Delete the entire `// ── Bank ──` section (lines 388-449: `getBankEntries`, `getBankBalance`, `getAllBankBalances`, `addBankEntry`). Replace with:

```typescript
// ── Bank Accounts ────────────────────────────────────────────────────────────

export async function getBankAccounts(): Promise<BankAccount[]> {
  await ensureInit();
  const result = await client.execute({ sql: "SELECT * FROM saturn_bank_accounts ORDER BY name ASC", args: [] });
  return result.rows.map((r) => rowTo<BankAccount>(r));
}

export async function getBankLog(limit: number = 50): Promise<BankLog[]> {
  await ensureInit();
  const result = await client.execute({
    sql: "SELECT * FROM saturn_bank_log ORDER BY created_at DESC LIMIT ?",
    args: [limit],
  });
  return result.rows.map((r) => rowTo<BankLog>(r));
}

export async function addBankAccount(data: { name: string; currency: string; balance: number; exchange_rate?: number }): Promise<BankAccount> {
  await ensureInit();
  const rate = data.exchange_rate ?? (data.currency === "birr" ? 1 : 1);
  const result = await client.execute({
    sql: "INSERT INTO saturn_bank_accounts (name, currency, balance, exchange_rate) VALUES (?, ?, ?, ?) RETURNING *",
    args: [data.name, data.currency, data.balance, rate],
  });
  const account = rowTo<BankAccount>(result.rows[0]);

  // Log the initial balance
  await client.execute({
    sql: "INSERT INTO saturn_bank_log (account_id, balance_before, balance_after, memo) VALUES (?, 0, ?, ?)",
    args: [account.id, data.balance, "Opening balance"],
  });

  return account;
}

export async function updateBankBalance(accountId: number, newBalance: number, memo: string | null): Promise<BankAccount> {
  await ensureInit();
  const current = await client.execute({ sql: "SELECT * FROM saturn_bank_accounts WHERE id = ?", args: [accountId] });
  if (current.rows.length === 0) throw new Error("Account not found");
  const oldBalance = Number((current.rows[0] as unknown as { balance: number }).balance);

  await client.execute({
    sql: "UPDATE saturn_bank_accounts SET balance = ?, memo = ?, updated_at = datetime('now') WHERE id = ?",
    args: [newBalance, memo, accountId],
  });

  // Log the change
  await client.execute({
    sql: "INSERT INTO saturn_bank_log (account_id, balance_before, balance_after, memo) VALUES (?, ?, ?, ?)",
    args: [accountId, oldBalance, newBalance, memo],
  });

  const updated = await client.execute({ sql: "SELECT * FROM saturn_bank_accounts WHERE id = ?", args: [accountId] });
  return rowTo<BankAccount>(updated.rows[0]);
}

export async function updateBankRate(accountId: number, exchangeRate: number): Promise<BankAccount> {
  await ensureInit();
  await client.execute({
    sql: "UPDATE saturn_bank_accounts SET exchange_rate = ?, updated_at = datetime('now') WHERE id = ?",
    args: [exchangeRate, accountId],
  });
  const result = await client.execute({ sql: "SELECT * FROM saturn_bank_accounts WHERE id = ?", args: [accountId] });
  return rowTo<BankAccount>(result.rows[0]);
}

export async function deleteBankAccount(accountId: number): Promise<void> {
  await ensureInit();
  await client.execute({ sql: "DELETE FROM saturn_bank_log WHERE account_id = ?", args: [accountId] });
  await client.execute({ sql: "DELETE FROM saturn_bank_accounts WHERE id = ?", args: [accountId] });
}
```

- [ ] **Step 10: Update getDashboardStats — remove bank_balance_birr**

In `getDashboardStats()` (around lines 494-506), remove the `birrBalance` variable and `bank_balance_birr` from the return. Delete:

```typescript
// DELETE:
  const birrBalance = await getBankBalance("birr");
```

And remove `bank_balance_birr: birrBalance,` from the return object.

- [ ] **Step 11: Commit**

```bash
git add src/lib/db.ts
git commit -m "refactor: new bank accounts schema, migration, remove auto bank side-effects"
```

---

### Task 3: Update API Route

**Files:**
- Modify: `src/app/api/bank/route.ts` (complete rewrite)

- [ ] **Step 1: Rewrite the bank API route**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getBankAccounts, getBankLog, addBankAccount, updateBankBalance, updateBankRate, deleteBankAccount } from "@/lib/db";

export async function GET() {
  const [accounts, log] = await Promise.all([getBankAccounts(), getBankLog()]);
  return NextResponse.json({ accounts, log });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.name || !body.currency) {
    return NextResponse.json({ error: "name and currency are required" }, { status: 400 });
  }

  const account = await addBankAccount({
    name: body.name,
    currency: body.currency,
    balance: Number(body.balance ?? 0),
    exchange_rate: body.exchange_rate != null ? Number(body.exchange_rate) : undefined,
  });

  return NextResponse.json(account, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();

  if (!body.action || !body.account_id) {
    return NextResponse.json({ error: "action and account_id are required" }, { status: 400 });
  }

  if (body.action === "update_balance") {
    if (body.balance == null) {
      return NextResponse.json({ error: "balance is required" }, { status: 400 });
    }
    const account = await updateBankBalance(body.account_id, Number(body.balance), body.memo ?? null);
    return NextResponse.json(account);
  }

  if (body.action === "update_rate") {
    if (body.exchange_rate == null) {
      return NextResponse.json({ error: "exchange_rate is required" }, { status: 400 });
    }
    const account = await updateBankRate(body.account_id, Number(body.exchange_rate));
    return NextResponse.json(account);
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await deleteBankAccount(Number(id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/bank/route.ts
git commit -m "refactor: bank API — accounts CRUD with balance/rate updates"
```

---

### Task 4: Update DataProvider

**Files:**
- Modify: `src/lib/DataProvider.tsx`

This is the largest change. Update imports, state, computed functions, mutations, and remove all bank side-effects from transaction mutations.

- [ ] **Step 1: Update imports**

Line 4 — replace `BankEntry` with `BankAccount, BankLog`:

```typescript
import type { Phone, Seller, Transaction, BankAccount, BankLog, DashboardStats, SellerWithStats, PhoneActivity, Loan, LoanPayment } from "./types";
```

- [ ] **Step 2: Update DataStore interface**

Replace `bankEntries: BankEntry[];` (line 12) with:

```typescript
  bankAccounts: BankAccount[];
  bankLog: BankLog[];
```

- [ ] **Step 3: Update DataContextType interface**

Replace all bank-related entries in the interface (lines 22, 30-31, 37, 53):

Data — replace `bankEntries: BankEntry[];` with:
```typescript
  bankAccounts: BankAccount[];
  bankLog: BankLog[];
```

Computed — replace `getBankBalance` and `getAllBankBalances` with:
```typescript
  getTotalLiquid: () => number;
```

Remove `getNetWorth` return type change — update to:
```typescript
  getNetWorth: () => number;
```

Mutations — replace `addBankEntry` with:
```typescript
  addBankAccount: (data: { name: string; currency: string; balance: number; exchange_rate?: number }) => Promise<void>;
  updateBankBalance: (accountId: number, newBalance: number, memo: string | null) => Promise<void>;
  updateBankRate: (accountId: number, exchangeRate: number) => Promise<void>;
  deleteBankAccount: (accountId: number) => Promise<void>;
```

- [ ] **Step 4: Update state variables**

Replace `bankEntries` state (line 129) with:

```typescript
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankLog, setBankLog] = useState<BankLog[]>([]);
```

- [ ] **Step 5: Update localStorage hydration**

In the `useEffect` that loads from storage (around line 152-163), replace `setBankEntries(stored.bankEntries);` with:

```typescript
      setBankAccounts(stored.bankAccounts || []);
      setBankLog(stored.bankLog || []);
```

- [ ] **Step 6: Update localStorage save**

In the save `useEffect` (around line 167-170), replace `bankEntries` with `bankAccounts, bankLog`:

```typescript
    saveToStorage({ phones, sellers, transactions, bankAccounts, bankLog, loans, lastSync: Date.now() });
  }, [phones, sellers, transactions, bankAccounts, bankLog, loans, loading]);
```

- [ ] **Step 7: Update syncFromServer**

In `syncFromServer()` (around lines 174-217), update the bank fetch and state setting:

Replace the bank fetch line in the Promise.all with `fetch("/api/bank")` (already correct).

Replace the bank parsing (around line 195):
```typescript
      const accountsArr = Array.isArray(b.accounts) ? b.accounts : [];
      const logArr = Array.isArray(b.log) ? b.log : [];
```

Replace the bank state setting (around line 201):
```typescript
      setBankAccounts(accountsArr);
      setBankLog(logArr);
```

Remove the old `setBankEntries(entriesArr);` line.

- [ ] **Step 8: Replace getBankBalance and getAllBankBalances with getTotalLiquid**

Delete the `getBankBalance` callback (lines 247-263) and `getAllBankBalances` callback (lines 265-271). Replace with:

```typescript
  // Total liquid cash in ETB (all accounts converted via exchange rate)
  const getTotalLiquid = useCallback((): number => {
    return bankAccounts.reduce((sum, a) => sum + a.balance * a.exchange_rate, 0);
  }, [bankAccounts]);
```

- [ ] **Step 9: Update getDashboardStats**

In `getDashboardStats` (around line 273), remove `getBankBalance` from the dependency array. Remove the `birrBalance` line and `bank_balance_birr` from the return. Update the return to not include `bank_balance_birr`.

Replace `const birrBalance = getBankBalance("birr");` with nothing.

Remove `bank_balance_birr: birrBalance,` from the return object.

Update dependency array — remove `getBankBalance`.

- [ ] **Step 10: Update getNetWorth**

Replace the entire `getNetWorth` callback (around lines 410-427) with:

```typescript
  const getNetWorth = useCallback((): number => {
    // Inventory at cost price (unsold phones)
    const inventoryValue = phones
      .filter((p) => p.status === "in_stock" || p.status === "with_seller")
      .reduce((s, p) => s + p.cost_price, 0);
    // All bank accounts converted to ETB
    const liquidETB = bankAccounts.reduce((s, a) => s + a.balance * a.exchange_rate, 0);
    // Loans
    const loansGiven = loans.filter((l) => (l.loan_type || "given") === "given").reduce((s, l) => s + l.remaining_amount, 0);
    const loansTaken = loans.filter((l) => l.loan_type === "taken").reduce((s, l) => s + l.remaining_amount, 0);

    return inventoryValue + liquidETB + loansGiven - loansTaken;
  }, [phones, bankAccounts, loans]);
```

- [ ] **Step 11: Update getTimelineEvents — remove bank events**

In `getTimelineEvents` (around lines 354-363), delete the entire `for (const b of bankEntries)` loop that creates bank_deposit/bank_withdrawal events.

Update the dependency array — remove `bankEntries`.

- [ ] **Step 12: Remove bank side-effects from quickSellPhone**

In `quickSellPhone` (around lines 500-513), delete the bank entry creation block:

```typescript
// DELETE this entire block:
    if (paymentMethod === "bank") {
      const bal = getBankBalance();
      const entry: BankEntry = {
        id: tempId(), type: "deposit", amount: price,
        memo: `Direct sale: ${phone.brand} ${phone.model}`,
        bank_name: null, currency: "birr",
        balance_after: bal + price, created_at: new Date().toISOString(),
      };
      setBankEntries((prev) => [entry, ...prev]);
    }
```

Remove `getBankBalance` from the dependency array.

- [ ] **Step 13: Remove bank side-effects from collectPerPhone**

In `collectPerPhone` (around lines 541-554), delete:

```typescript
// DELETE this entire block:
    if (paymentMethod === "bank" && totalAmount > 0) {
      const bal = getBankBalance();
      const entry: BankEntry = {
        id: tempId(), type: "deposit", amount: totalAmount,
        memo: `Collection from ${seller?.name}`,
        bank_name: null, currency: "birr",
        balance_after: bal + totalAmount, created_at: new Date().toISOString(),
      };
      setBankEntries((prev) => [entry, ...prev]);
    }
```

Remove `getBankBalance` from the dependency array.

- [ ] **Step 14: Remove bank side-effects from collectLumpSum**

In `collectLumpSum` (around lines 566-576), delete:

```typescript
// DELETE this entire block:
    if (paymentMethod === "bank") {
      const bal = getBankBalance();
      const entry: BankEntry = {
        id: tempId(), type: "deposit", amount,
        memo: `Lump sum from ${seller?.name}`,
        bank_name: null, currency: "birr",
        balance_after: bal + amount, created_at: new Date().toISOString(),
      };
      setBankEntries((prev) => [entry, ...prev]);
    }
```

Remove `getBankBalance` from the dependency array.

- [ ] **Step 15: Remove bank side-effects from addExpense**

In `addExpense` (around lines 612-626), delete:

```typescript
// DELETE this entire block:
    // If paid from bank, create a withdrawal entry
    if (pm === "bank") {
      const bal = getBankBalance();
      const entry: BankEntry = {
        id: tempId(), type: "withdrawal", amount: data.amount,
        memo: data.description,
        bank_name: null, currency: "birr",
        balance_after: bal - data.amount, created_at: new Date().toISOString(),
      };
      setBankEntries((prev) => [entry, ...prev]);
    }
```

Remove `getBankBalance` from the dependency array.

- [ ] **Step 16: Replace addBankEntry mutation with new bank mutations**

Delete the old `addBankEntry` callback (around lines 637-652). Replace with:

```typescript
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
```

- [ ] **Step 17: Update the Provider return value**

In the `DataContext.Provider value` (around line 692), replace all bank-related entries:

Replace `bankEntries` with `bankAccounts, bankLog`.

Replace `getBankBalance, getAllBankBalances` with `getTotalLiquid`.

Replace `addBankEntry` with `addBankAccount, updateBankBalance, updateBankRate, deleteBankAccount`.

- [ ] **Step 18: Commit**

```bash
git add src/lib/DataProvider.tsx
git commit -m "refactor: DataProvider — new bank account state, remove auto side-effects, single ETB net worth"
```

---

### Task 5: Rewrite Bank Tab UI

**Files:**
- Modify: `src/app/bank/page.tsx` (complete rewrite)

- [ ] **Step 1: Write the new bank page**

Replace the entire file with the new simplified bank page:

```tsx
"use client";

import { useState } from "react";
import { Edit3, Wallet, TrendingUp, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import BottomSheet from "@/components/BottomSheet";
import FAB from "@/components/FAB";
import { useData } from "@/lib/DataProvider";
import type { BankAccount, BankLog } from "@/lib/types";

type Currency = "birr" | "usd" | "usdt";
const currencyLabels: Record<Currency, string> = { birr: "ETB", usd: "USD", usdt: "USDT" };

export default function BankPage() {
  const { bankAccounts, bankLog, getTotalLiquid, addBankAccount, updateBankBalance, updateBankRate, deleteBankAccount, loading } = useData();

  const [editOpen, setEditOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit balance form
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMemo, setEditMemo] = useState("");

  // Edit rate form
  const [rateAccount, setRateAccount] = useState<BankAccount | null>(null);
  const [rateValue, setRateValue] = useState("");

  // Add form
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState<Currency>("birr");
  const [newAmount, setNewAmount] = useState("");
  const [newRate, setNewRate] = useState("");

  const openEditBalance = (account: BankAccount) => {
    setEditAccount(account);
    setEditAmount(String(account.balance));
    setEditMemo("");
    setError(null);
    setEditOpen(true);
  };

  const openEditRate = (account: BankAccount) => {
    setRateAccount(account);
    setRateValue(String(account.exchange_rate));
    setError(null);
    setRateOpen(true);
  };

  const handleUpdateBalance = async () => {
    if (!editAccount) return;
    const parsed = parseFloat(editAmount);
    if (editAmount === "" || isNaN(parsed)) { setError("Enter a valid amount."); return; }
    if (parsed === editAccount.balance && !editMemo.trim()) { setEditOpen(false); return; }
    setSubmitting(true);
    try {
      await updateBankBalance(editAccount.id, parsed, editMemo.trim() || null);
      setEditOpen(false);
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const handleUpdateRate = async () => {
    if (!rateAccount) return;
    const parsed = parseFloat(rateValue);
    if (rateValue === "" || isNaN(parsed) || parsed <= 0) { setError("Enter a valid rate."); return; }
    setSubmitting(true);
    try {
      await updateBankRate(rateAccount.id, parsed);
      setRateOpen(false);
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const handleAddBank = async () => {
    if (!newName.trim()) { setError("Bank name is required."); return; }
    const parsed = parseFloat(newAmount);
    if (newAmount === "" || isNaN(parsed) || parsed < 0) { setError("Enter a valid starting balance."); return; }
    const rate = newCurrency !== "birr" ? parseFloat(newRate) : 1;
    if (newCurrency !== "birr" && (newRate === "" || isNaN(rate) || rate <= 0)) { setError("Enter a valid exchange rate."); return; }
    setSubmitting(true);
    try {
      await addBankAccount({ name: newName.trim(), currency: newCurrency, balance: parsed, exchange_rate: rate });
      setAddOpen(false);
      setNewName(""); setNewAmount(""); setNewRate(""); setNewCurrency("birr");
    } catch { setError("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    setSubmitting(true);
    try {
      await deleteBankAccount(id);
      setDeleteConfirm(null);
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "var(--bg)", border: "1px solid var(--surface-border)",
    borderRadius: 8, padding: "10px 12px",
    color: "var(--white)", fontSize: 16, outline: "none",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 13, fontWeight: 600,
    color: "var(--muted)", marginBottom: 6,
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  const totalLiquid = loading ? 0 : getTotalLiquid();

  // Build a map of account names for the log
  const accountMap = new Map<number, BankAccount>();
  for (const a of bankAccounts) accountMap.set(a.id, a);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", paddingBottom: 96 }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--surface)",
        borderBottom: "1px solid var(--surface-border)",
        padding: "20px 20px 16px",
      }}>
        <h1 style={{ color: "var(--white)", fontSize: 22, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
          Bank
        </h1>
        <div style={{
          background: "var(--bg)", border: "1px solid var(--surface-border)",
          borderRadius: 12, padding: "12px 16px", textAlign: "center",
        }}>
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
            Total Liquid
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: loading ? "var(--muted)" : "var(--white)", letterSpacing: "-0.02em" }}>
            {loading ? "\u2014" : `ETB ${totalLiquid.toLocaleString()}`}
          </div>
        </div>
      </div>

      {/* Account cards */}
      <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "48px 0", fontSize: 15 }}>Loading...</div>
        ) : bankAccounts.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "64px 20px", fontSize: 15 }}>
            <Wallet size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div>No banks yet. Tap + to add one.</div>
          </div>
        ) : (
          bankAccounts.map((account) => (
            <div key={account.id} style={{
              background: "var(--surface)", border: "1px solid var(--surface-border)",
              borderRadius: 12, padding: 14,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: "var(--white)" }}>{account.name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                    background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--surface-border)",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {currencyLabels[account.currency]}
                  </span>
                </div>
                <button
                  onClick={() => setDeleteConfirm(account.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Balance row */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 12px", background: "var(--bg)", borderRadius: 8,
              }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "var(--white)" }}>
                  {account.balance.toLocaleString()}
                </span>
                <button
                  onClick={() => openEditBalance(account)}
                  style={{
                    background: "none", border: "1px solid var(--surface-border)",
                    borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                    color: "var(--accent)", fontSize: 12, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Edit3 size={12} /> Update
                </button>
              </div>

              {/* Exchange rate (non-birr only) */}
              {account.currency !== "birr" && (
                <button
                  onClick={() => openEditRate(account)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, marginTop: 8,
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--muted)", fontSize: 12, fontWeight: 600, padding: 0,
                  }}
                >
                  <TrendingUp size={12} />
                  1 {currencyLabels[account.currency]} = {account.exchange_rate.toLocaleString()} ETB
                  <Edit3 size={10} style={{ opacity: 0.5 }} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Activity Log */}
      {!loading && bankLog.length > 0 && (
        <div style={{ padding: "20px 16px 0" }}>
          <h2 style={{
            fontSize: 11, fontWeight: 700, color: "var(--muted)",
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
          }}>
            Recent Activity
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {bankLog.slice(0, 20).map((log) => {
              const account = accountMap.get(log.account_id);
              const delta = log.balance_after - log.balance_before;
              const isPositive = delta >= 0;
              const currency = account?.currency || "birr";
              return (
                <div key={log.id} style={{
                  padding: "10px 12px", background: "var(--surface)",
                  border: "1px solid var(--surface-border)", borderRadius: 8,
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>
                      {account?.name || "Unknown"}
                    </div>
                    {log.memo && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{log.memo}</div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                      {formatDate(log.created_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isPositive ? "var(--green)" : "var(--error)" }}>
                      {isPositive ? "+" : ""}{delta.toLocaleString()} {currencyLabels[currency as Currency]}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {log.balance_before.toLocaleString()} → {log.balance_after.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <FAB onClick={() => { setNewName(""); setNewAmount(""); setNewRate(""); setNewCurrency("birr"); setError(null); setAddOpen(true); }} />

      {/* Update Balance Sheet */}
      <BottomSheet open={editOpen} onClose={() => !submitting && setEditOpen(false)} title="Update Balance">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            padding: "10px 14px", background: "var(--bg)", borderRadius: 10,
            fontSize: 14, color: "var(--muted)", textAlign: "center",
          }}>
            <span style={{ color: "var(--white)", fontWeight: 700 }}>{editAccount?.name}</span>
            {" \u00b7 "}
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{editAccount ? currencyLabels[editAccount.currency] : ""}</span>
          </div>
          <div>
            <label style={lbl}>Current Balance</label>
            <input
              type="number" inputMode="decimal" placeholder="0"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              style={{ ...inp, fontSize: 20, fontWeight: 700, textAlign: "center", padding: "14px 12px" }}
            />
          </div>
          <div>
            <label style={lbl}>Note (optional)</label>
            <textarea
              placeholder="Why is this changing?"
              value={editMemo}
              onChange={(e) => setEditMemo(e.target.value)}
              rows={2}
              style={{ ...inp, resize: "none", fontFamily: "inherit" }}
            />
          </div>
          {error && (
            <div style={{
              color: "var(--error)", fontSize: 13, padding: "8px 12px", borderRadius: 8,
              background: "color-mix(in srgb, var(--error) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
            }}>{error}</div>
          )}
          <button onClick={handleUpdateBalance} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--accent)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </BottomSheet>

      {/* Update Rate Sheet */}
      <BottomSheet open={rateOpen} onClose={() => !submitting && setRateOpen(false)} title="Exchange Rate">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            padding: "10px 14px", background: "var(--bg)", borderRadius: 10,
            fontSize: 14, color: "var(--muted)", textAlign: "center",
          }}>
            1 {rateAccount ? currencyLabels[rateAccount.currency] : ""} = ___ ETB
          </div>
          <input
            type="number" inputMode="decimal" placeholder="0"
            value={rateValue}
            onChange={(e) => setRateValue(e.target.value)}
            style={{ ...inp, fontSize: 20, fontWeight: 700, textAlign: "center", padding: "14px 12px" }}
          />
          {error && (
            <div style={{
              color: "var(--error)", fontSize: 13, padding: "8px 12px", borderRadius: 8,
              background: "color-mix(in srgb, var(--error) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
            }}>{error}</div>
          )}
          <button onClick={handleUpdateRate} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--accent)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </BottomSheet>

      {/* Add Bank Sheet */}
      <BottomSheet open={addOpen} onClose={() => !submitting && setAddOpen(false)} title="Add Bank">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lbl}>Bank Name</label>
            <input type="text" placeholder="e.g. CBE, Awash, Telebirr..." value={newName} onChange={(e) => setNewName(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Currency</label>
            <div style={{ display: "flex", border: "1px solid var(--surface-border)", borderRadius: 10, overflow: "hidden" }}>
              {(["birr", "usd", "usdt"] as Currency[]).map((c) => (
                <button key={c} onClick={() => setNewCurrency(c)} style={{
                  flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, textTransform: "uppercase",
                  background: newCurrency === c ? "var(--accent)" : "var(--surface)",
                  color: newCurrency === c ? "var(--white)" : "var(--muted)",
                  transition: "all 0.15s",
                }}>
                  {currencyLabels[c]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Starting Balance</label>
            <input type="number" inputMode="decimal" placeholder="0" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} style={inp} />
          </div>
          {newCurrency !== "birr" && (
            <div>
              <label style={lbl}>Exchange Rate (1 {currencyLabels[newCurrency]} = ? ETB)</label>
              <input type="number" inputMode="decimal" placeholder="e.g. 130" value={newRate} onChange={(e) => setNewRate(e.target.value)} style={inp} />
            </div>
          )}
          {error && (
            <div style={{
              color: "var(--error)", fontSize: 13, padding: "8px 12px", borderRadius: 8,
              background: "color-mix(in srgb, var(--error) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 20%, transparent)",
            }}>{error}</div>
          )}
          <button onClick={handleAddBank} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--accent)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Saving..." : "Add Bank"}
          </button>
        </div>
      </BottomSheet>

      {/* Delete Confirmation Sheet */}
      <BottomSheet open={deleteConfirm !== null} onClose={() => !submitting && setDeleteConfirm(null)} title="Delete Bank">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            padding: "12px 14px", background: "var(--bg)", borderRadius: 10,
            fontSize: 14, color: "var(--muted)", textAlign: "center",
          }}>
            Are you sure you want to delete <span style={{ color: "var(--white)", fontWeight: 700 }}>
              {deleteConfirm !== null ? accountMap.get(deleteConfirm)?.name : ""}
            </span>? This will remove the account and all its activity history.
          </div>
          <button onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)} disabled={submitting} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            cursor: submitting ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700,
            color: "var(--white)", background: submitting ? "var(--surface)" : "var(--error)",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/bank/page.tsx
git commit -m "feat: new bank tab UI — account cards, activity log, rate editing"
```

---

### Task 6: Update Dashboard

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update imports**

Line 12 — remove `BankEntry` from the import:

```typescript
import type { Phone, Transaction, SellerWithStats } from "@/lib/types";
```

- [ ] **Step 2: Update useData destructure**

Line 36 — replace `bankEntries` with `bankAccounts` and `getNetWorth` (already there). Remove `getBankBalance` if present. Add `getTotalLiquid`:

```typescript
  const { getDashboardStats, getTopSellers, getPhoneActivity, getProfitLoss, getNetWorth, phones, transactions, bankAccounts, loading, refresh, addExpense, getTotalLiquid } = useData();
```

- [ ] **Step 3: Remove ModalType "bank" and update ModalItem**

Line 33 — remove `"bank"` from ModalType:
```typescript
type ModalType = "phone" | "transaction" | "seller" | null;
```

Line 41 — remove BankEntry from ModalItem:
```typescript
  type ModalItem = Phone | Transaction;
```

- [ ] **Step 4: Delete openBankModal function**

Delete the entire `openBankModal` function (lines 95-101).

- [ ] **Step 5: Remove bank modal rendering from renderContent**

Delete the `if (modalType === "bank")` block (lines 145-163).

- [ ] **Step 6: Update Net Worth display**

Replace the Net Worth section in the header (around lines 200-234). The `getNetWorth()` now returns a single number, not an object:

```tsx
        {(() => {
          const nw = getNetWorth();
          return (
            <div style={{
              marginTop: 12,
              background: "var(--bg)",
              border: "1px solid var(--surface-border)",
              borderRadius: "var(--radius)",
              padding: "12px 16px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Net Worth
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: loading ? "var(--muted)" : nw >= 0 ? "var(--green)" : "var(--error)" }}>
                  {loading ? "\u2014" : formatBirr(nw)}
                </span>
              </div>
            </div>
          );
        })()}
```

- [ ] **Step 7: Update Bank stat card**

Replace the Bank stat card (around line 279-281). Instead of `openBankModal()`, make it non-clickable or show the total liquid from accounts:

```tsx
            <StatCard label="Bank (ETB)" value={formatBirr(getTotalLiquid())} />
```

Remove the wrapping `<div onClick={() => openBankModal()} style={{ cursor: "pointer" }}>` — just use a plain div:

```tsx
            <div>
              <StatCard label="Bank (ETB)" value={formatBirr(getTotalLiquid())} />
            </div>
```

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "refactor: dashboard — single ETB net worth, bank stat from accounts"
```

---

### Task 7: Update Timeline

**Files:**
- Modify: `src/app/timeline/page.tsx`

- [ ] **Step 1: Remove bank event types**

Remove `"bank_deposit"` and `"bank_withdrawal"` from the `EventType` union (lines 18-19):

```typescript
type EventType =
  | "phone_added"
  | "distributed"
  | "collected"
  | "returned"
  | "direct_sale"
  | "expense";
```

- [ ] **Step 2: Remove bank entries from TYPE_CONFIG**

Delete these two lines from `TYPE_CONFIG` (lines 31-32):

```typescript
  bank_deposit:    { Icon: Landmark,      color: "var(--green)" },
  bank_withdrawal: { Icon: Landmark,      color: "var(--error)" },
```

Also remove the `Landmark` import from line 4 if it's no longer used:

```typescript
import { Package, ArrowUpRight, ArrowDownLeft, RotateCcw, ShoppingBag } from "lucide-react";
```

- [ ] **Step 3: Delete BankDetailCard component**

Delete the entire `BankDetailCard` function (lines 166-181).

- [ ] **Step 4: Remove bank event handling from renderContent**

Delete the bank events block in `renderContent` (lines 251-254):

```typescript
// DELETE:
    // Bank events
    if (event.type === "bank_deposit" || event.type === "bank_withdrawal") {
      return <BankDetailCard event={event} />;
    }
```

- [ ] **Step 5: Commit**

```bash
git add src/app/timeline/page.tsx
git commit -m "refactor: timeline — remove bank deposit/withdrawal events"
```

---

### Task 8: Build and Verify

- [ ] **Step 1: Run the build**

```bash
cd /home/dizzy/saturn-mobile && npm run build
```

Expected: Build succeeds with no TypeScript errors. If there are errors, they will point to remaining references to `BankEntry`, `bankEntries`, `getBankBalance`, `getAllBankBalances`, `addBankEntry`, or `bank_balance_birr` that need updating.

- [ ] **Step 2: Fix any build errors**

If the build fails, the errors will be type mismatches from missed references. Fix each one — the error messages will be specific about which file and line.

- [ ] **Step 3: Start the dev server and test**

```bash
cd /home/dizzy/saturn-mobile && npm run dev
```

Test checklist:
1. Bank tab loads with no errors
2. "Total Liquid" header shows correct ETB sum
3. Can add a new ETB bank with starting balance
4. Can add a USD bank with starting balance + exchange rate
5. Can update a balance — activity log shows the change
6. Can update an exchange rate — total liquid recalculates
7. Can delete a bank account
8. Dashboard net worth shows single ETB number
9. Dashboard Bank (ETB) stat shows correct total
10. Selling a phone with "Bank" payment does NOT change bank balance
11. Adding an expense with "Bank" payment does NOT change bank balance
12. Timeline has no bank deposit/withdrawal events

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors from bank redesign"
```
