# Bank Tab Redesign — Balance Tracker

**Date:** 2026-04-17
**Status:** Approved

## Summary

Redesign the bank tab from a transactional ledger (deposit/withdrawal entries) to a simple manual balance tracker. Each bank account is one row with one currency and one balance. Updates are logged for history. Bank balances are fully decoupled from sales/collections/expenses — the user updates balances manually to match their real bank apps.

## Data Model

### `saturn_bank_accounts`

One row per bank account.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | auto-increment |
| `name` | TEXT NOT NULL | "CBE", "Telebirr", "Cash", "Binance" |
| `currency` | TEXT NOT NULL | "birr", "usd", "usdt" |
| `balance` | INTEGER NOT NULL | current balance, overwritten on update |
| `exchange_rate` | REAL NOT NULL DEFAULT 1 | ETB per 1 unit. Birr accounts = 1. USD might be 130. |
| `memo` | TEXT | latest optional note |
| `created_at` | TEXT NOT NULL | when account was added |
| `updated_at` | TEXT NOT NULL | last balance or rate change |

### `saturn_bank_log`

Append-only activity history. One row per balance change.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | auto-increment |
| `account_id` | INTEGER NOT NULL | FK → saturn_bank_accounts |
| `balance_before` | INTEGER NOT NULL | previous balance |
| `balance_after` | INTEGER NOT NULL | new balance |
| `memo` | TEXT | optional note for this change |
| `created_at` | TEXT NOT NULL | when the change happened |

No `type` column, no `amount` column, no deposit/withdrawal language. The delta is implicit from `balance_before` and `balance_after`.

### Migration

1. Create `saturn_bank_accounts` and `saturn_bank_log` tables
2. Read current derived balances from `saturn_bank_entries` (latest `balance_after` per `bank_name` + `currency` combo)
3. Insert each as a row in `saturn_bank_accounts` with `exchange_rate = 1`
4. Drop `saturn_bank_entries`

## API

### `GET /api/bank`

Returns `{ accounts: BankAccount[], log: BankLog[] }`.

Log is the most recent 50 entries across all accounts, sorted newest first.

### `POST /api/bank` — Add account

Body: `{ action: "add_account", name, currency, balance, exchange_rate? }`

Creates account + initial log entry.

### `PATCH /api/bank` — Update balance or rate

Body: `{ action: "update_balance", account_id, balance, memo? }` — updates balance, creates log entry.

Body: `{ action: "update_rate", account_id, exchange_rate }` — updates exchange rate only, no log entry.

### `DELETE /api/bank?id=N` — Delete account

Deletes account and its log entries.

## UI — Bank Tab

### Header

Sticky top bar:
- Title: "Bank"
- One big number: total net worth in ETB (all account balances converted via exchange rates, does NOT include inventory or loans — that's the dashboard's job)
- This is just the total liquid cash across all banks

### Account Cards

List of cards, each showing:
- Bank name + currency badge (ETB / USD / USDT)
- Current balance (large font)
- For USD/USDT accounts: exchange rate display — "1 USD = 130 ETB" — tappable to edit
- "Update" button to change the balance

### Activity Log

Below the account cards, a "Recent Activity" section showing the last ~20 balance changes across all banks. Each row:
- Bank name
- Before → after with delta shown as +N (green) or -N (red)
- Optional memo
- Date

### Bottom Sheets

**Update Balance:**
- Shows bank name + currency
- One number input pre-filled with current balance (large, centered)
- Optional memo textarea
- Save button

**Update Rate (USD/USDT only):**
- "1 USD = ___ ETB" — one number input
- Save button

**Add Bank:**
- Bank name text input
- Currency picker (ETB / USD / USDT)
- Starting balance number input
- Exchange rate input (shown only if currency is USD or USDT)
- Save button

### FAB

Plus button opens Add Bank sheet.

## Net Worth Calculation

Updated formula for `getNetWorth()`:

```
net_worth = inventory_value (cost_price of in_stock + with_seller phones)
          + SUM(account.balance * account.exchange_rate) for all bank accounts
          + SUM(remaining_amount) for loans where loan_type = 'given'
          - SUM(remaining_amount) for loans where loan_type = 'taken'
```

Returns a single ETB number. No separate USD/USDT breakdown — everything is converted.

## Cleanup — What Gets Removed

### `db.ts`

- Remove `addBankEntry()` side-effect calls from: `quickSellPhone()`, `collectPerPhone()`, `collectLumpSum()`, `addTransaction()`
- Replace old functions (`getBankEntries`, `getBankBalance`, `getAllBankBalances`, `addBankEntry`) with new account-based functions (`getBankAccounts`, `getBankLog`, `addBankAccount`, `updateBankBalance`, `updateBankRate`, `deleteBankAccount`)

### `DataProvider.tsx`

- Remove auto `setBankEntries` / `addBankEntry` calls from: `quickSellPhone`, `collectPerPhone`, `collectLumpSum`, `addExpense`
- Replace `bankEntries: BankEntry[]` state with `bankAccounts: BankAccount[]` + `bankLog: BankLog[]`
- Replace `getBankBalance()` / `getAllBankBalances()` with reads from `bankAccounts`
- Update `getNetWorth()` to use new formula
- Update `getDashboardStats()` to read `bank_balance_birr` from accounts
- Remove `addBankEntry` mutation, add: `addBankAccount`, `updateBankBalance`, `updateBankRate`, `deleteBankAccount`

### `types.ts`

- Remove `BankEntry` type
- Add `BankAccount` type: `{ id, name, currency, balance, exchange_rate, memo, created_at, updated_at }`
- Add `BankLog` type: `{ id, account_id, balance_before, balance_after, memo, created_at }`

### Dashboard (`page.tsx`)

- `bank_balance_birr` stat reads from new accounts
- Bank detail modal shows account balances instead of entry list

### Timeline (`timeline/page.tsx`)

- Remove `bank_deposit` / `bank_withdrawal` event types — bank changes are no longer part of the global timeline. The bank tab has its own activity log.

### Transaction UI

- "Cash / Bank" payment method picker stays on sales, collections, and expenses — purely a tag for record-keeping, no side-effect on bank balances.

## Types Summary

```typescript
interface BankAccount {
  id: number;
  name: string;
  currency: "birr" | "usd" | "usdt";
  balance: number;
  exchange_rate: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

interface BankLog {
  id: number;
  account_id: number;
  balance_before: number;
  balance_after: number;
  memo: string | null;
  created_at: string;
}
```
