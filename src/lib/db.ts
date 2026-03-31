import { createClient } from "@libsql/client";
import type { Phone, Transaction, Debt, DebtPayment, BankEntry, DashboardStats } from "./types";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

let initPromise: Promise<void> | null = null;

async function ensureInit() {
  if (!initPromise) initPromise = initDb();
  return initPromise;
}

async function initDb() {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS saturn_phones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        imei TEXT UNIQUE,
        storage TEXT,
        color TEXT,
        condition TEXT NOT NULL CHECK(condition IN ('new', 'used_good', 'used_fair')),
        cost_price INTEGER NOT NULL,
        selling_price INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_stock' CHECK(status IN ('in_stock', 'sold', 'returned')),
        memo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        sold_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS saturn_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount INTEGER NOT NULL,
        description TEXT NOT NULL,
        memo TEXT,
        phone_id INTEGER REFERENCES saturn_phones(id),
        category TEXT NOT NULL CHECK(category IN ('phone_sale', 'rent', 'utilities', 'transport', 'other')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS saturn_debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('owes_me', 'i_owe')),
        name TEXT NOT NULL,
        phone_number TEXT,
        original_amount INTEGER NOT NULL,
        remaining_amount INTEGER NOT NULL,
        memo TEXT,
        due_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS saturn_debt_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL REFERENCES saturn_debts(id),
        amount INTEGER NOT NULL,
        memo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS saturn_bank_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal')),
        amount INTEGER NOT NULL,
        memo TEXT,
        balance_after INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ],
    "write"
  );
}

function rowTo<T>(row: Record<string, unknown>): T {
  return row as unknown as T;
}

// ---- Phones ----

export async function getPhones(status?: string): Promise<Phone[]> {
  await ensureInit();
  const sql = status
    ? "SELECT * FROM saturn_phones WHERE status = ? ORDER BY created_at DESC"
    : "SELECT * FROM saturn_phones ORDER BY created_at DESC";
  const args = status ? [status] : [];
  const result = await client.execute({ sql, args });
  return result.rows.map((r) => rowTo<Phone>(r));
}

export async function addPhone(data: {
  brand: string;
  model: string;
  imei: string | null;
  storage: string | null;
  color: string | null;
  condition: string;
  cost_price: number;
  selling_price: number;
  memo: string | null;
}): Promise<Phone> {
  await ensureInit();
  const result = await client.execute({
    sql: `INSERT INTO saturn_phones (brand, model, imei, storage, color, condition, cost_price, selling_price, memo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [data.brand, data.model, data.imei, data.storage, data.color, data.condition, data.cost_price, data.selling_price, data.memo],
  });
  return rowTo<Phone>(result.rows[0]);
}

export async function sellPhone(id: number): Promise<{ phone: Phone; transaction: Transaction }> {
  await ensureInit();
  const phoneRes = await client.execute({
    sql: "SELECT * FROM saturn_phones WHERE id = ? AND status = 'in_stock'",
    args: [id],
  });
  if (phoneRes.rows.length === 0) throw new Error("Phone not found or already sold");
  const phone = rowTo<Phone>(phoneRes.rows[0]);

  await client.execute({
    sql: "UPDATE saturn_phones SET status = 'sold', sold_at = datetime('now') WHERE id = ?",
    args: [id],
  });

  const txRes = await client.execute({
    sql: `INSERT INTO saturn_transactions (type, amount, description, memo, phone_id, category)
          VALUES ('income', ?, ?, ?, ?, 'phone_sale') RETURNING *`,
    args: [phone.selling_price, `Sold ${phone.brand} ${phone.model}`, phone.memo, id],
  });

  const updatedPhoneRes = await client.execute({
    sql: "SELECT * FROM saturn_phones WHERE id = ?",
    args: [id],
  });

  return {
    phone: rowTo<Phone>(updatedPhoneRes.rows[0]),
    transaction: rowTo<Transaction>(txRes.rows[0]),
  };
}

export async function deletePhone(id: number): Promise<void> {
  await ensureInit();
  await client.execute({ sql: "DELETE FROM saturn_phones WHERE id = ?", args: [id] });
}

// ---- Transactions ----

export async function getTransactions(filters?: { type?: string; category?: string; date?: string }): Promise<Transaction[]> {
  await ensureInit();
  let sql = "SELECT * FROM saturn_transactions WHERE 1=1";
  const args: (string | number)[] = [];
  if (filters?.type) { sql += " AND type = ?"; args.push(filters.type); }
  if (filters?.category) { sql += " AND category = ?"; args.push(filters.category); }
  if (filters?.date) { sql += " AND date(created_at) = ?"; args.push(filters.date); }
  sql += " ORDER BY created_at DESC";
  const result = await client.execute({ sql, args });
  return result.rows.map((r) => rowTo<Transaction>(r));
}

export async function addTransaction(data: {
  type: string;
  amount: number;
  description: string;
  memo: string | null;
  category: string;
}): Promise<Transaction> {
  await ensureInit();
  const result = await client.execute({
    sql: `INSERT INTO saturn_transactions (type, amount, description, memo, category)
          VALUES (?, ?, ?, ?, ?) RETURNING *`,
    args: [data.type, data.amount, data.description, data.memo, data.category],
  });
  return rowTo<Transaction>(result.rows[0]);
}

export async function deleteTransaction(id: number): Promise<void> {
  await ensureInit();
  await client.execute({ sql: "DELETE FROM saturn_transactions WHERE id = ?", args: [id] });
}

// ---- Debts ----

export async function getDebts(): Promise<Debt[]> {
  await ensureInit();
  const result = await client.execute({
    sql: "SELECT * FROM saturn_debts ORDER BY created_at DESC",
    args: [],
  });
  return result.rows.map((r) => rowTo<Debt>(r));
}

export async function addDebt(data: {
  type: string;
  name: string;
  phone_number: string | null;
  original_amount: number;
  memo: string | null;
  due_date: string | null;
}): Promise<Debt> {
  await ensureInit();
  const result = await client.execute({
    sql: `INSERT INTO saturn_debts (type, name, phone_number, original_amount, remaining_amount, memo, due_date)
          VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [data.type, data.name, data.phone_number, data.original_amount, data.original_amount, data.memo, data.due_date],
  });
  return rowTo<Debt>(result.rows[0]);
}

export async function deleteDebt(id: number): Promise<void> {
  await ensureInit();
  await client.batch(
    [
      { sql: "DELETE FROM saturn_debt_payments WHERE debt_id = ?", args: [id] },
      { sql: "DELETE FROM saturn_debts WHERE id = ?", args: [id] },
    ],
    "write"
  );
}

export async function getDebtPayments(debtId: number): Promise<DebtPayment[]> {
  await ensureInit();
  const result = await client.execute({
    sql: "SELECT * FROM saturn_debt_payments WHERE debt_id = ? ORDER BY created_at DESC",
    args: [debtId],
  });
  return result.rows.map((r) => rowTo<DebtPayment>(r));
}

export async function addDebtPayment(debtId: number, amount: number, memo: string | null): Promise<{ payment: DebtPayment; debt: Debt }> {
  await ensureInit();
  const debtRes = await client.execute({
    sql: "SELECT * FROM saturn_debts WHERE id = ?",
    args: [debtId],
  });
  if (debtRes.rows.length === 0) throw new Error("Debt not found");
  const debt = rowTo<Debt>(debtRes.rows[0]);
  if (amount > debt.remaining_amount) throw new Error("Payment exceeds remaining amount");

  const newRemaining = debt.remaining_amount - amount;

  const paymentRes = await client.execute({
    sql: `INSERT INTO saturn_debt_payments (debt_id, amount, memo) VALUES (?, ?, ?) RETURNING *`,
    args: [debtId, amount, memo],
  });

  await client.execute({
    sql: "UPDATE saturn_debts SET remaining_amount = ? WHERE id = ?",
    args: [newRemaining, debtId],
  });

  const txType = debt.type === "owes_me" ? "income" : "expense";
  const txDesc = debt.type === "owes_me"
    ? `Payment from ${debt.name}`
    : `Payment to ${debt.name}`;
  await client.execute({
    sql: `INSERT INTO saturn_transactions (type, amount, description, memo, category)
          VALUES (?, ?, ?, ?, 'other')`,
    args: [txType, amount, txDesc, memo],
  });

  const updatedDebt = await client.execute({
    sql: "SELECT * FROM saturn_debts WHERE id = ?",
    args: [debtId],
  });

  return {
    payment: rowTo<DebtPayment>(paymentRes.rows[0]),
    debt: rowTo<Debt>(updatedDebt.rows[0]),
  };
}

// ---- Bank ----

export async function getBankEntries(): Promise<BankEntry[]> {
  await ensureInit();
  const result = await client.execute({
    sql: "SELECT * FROM saturn_bank_entries ORDER BY created_at DESC",
    args: [],
  });
  return result.rows.map((r) => rowTo<BankEntry>(r));
}

export async function getBankBalance(): Promise<number> {
  await ensureInit();
  const result = await client.execute({
    sql: "SELECT balance_after FROM saturn_bank_entries ORDER BY created_at DESC LIMIT 1",
    args: [],
  });
  if (result.rows.length === 0) return 0;
  return (result.rows[0] as unknown as { balance_after: number }).balance_after;
}

export async function addBankEntry(data: { type: string; amount: number; memo: string | null }): Promise<BankEntry> {
  await ensureInit();
  const currentBalance = await getBankBalance();
  const newBalance = data.type === "deposit"
    ? currentBalance + data.amount
    : currentBalance - data.amount;

  const result = await client.execute({
    sql: `INSERT INTO saturn_bank_entries (type, amount, memo, balance_after)
          VALUES (?, ?, ?, ?) RETURNING *`,
    args: [data.type, data.amount, data.memo, newBalance],
  });
  return rowTo<BankEntry>(result.rows[0]);
}

// ---- Dashboard ----

export async function getDashboardStats(period?: string): Promise<DashboardStats> {
  await ensureInit();

  let dateFilter = "";
  const today = new Date().toISOString().split("T")[0];

  if (period === "today") {
    dateFilter = ` AND date(created_at) = '${today}'`;
  } else if (period === "week") {
    dateFilter = ` AND created_at >= datetime('now', '-7 days')`;
  } else if (period === "month") {
    dateFilter = ` AND created_at >= datetime('now', '-30 days')`;
  }

  const phonesRes = await client.execute({
    sql: "SELECT COUNT(*) as count, COALESCE(SUM(cost_price), 0) as cost, COALESCE(SUM(selling_price), 0) as selling FROM saturn_phones WHERE status = 'in_stock'",
    args: [],
  });
  const phones = phonesRes.rows[0] as unknown as { count: number; cost: number; selling: number };

  const incomeRes = await client.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) as total FROM saturn_transactions WHERE type = 'income'${dateFilter}`,
    args: [],
  });
  const totalIncome = (incomeRes.rows[0] as unknown as { total: number }).total;

  const expenseRes = await client.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) as total FROM saturn_transactions WHERE type = 'expense'${dateFilter}`,
    args: [],
  });
  const totalExpenses = (expenseRes.rows[0] as unknown as { total: number }).total;

  const bankBalance = await getBankBalance();

  const owedRes = await client.execute({
    sql: "SELECT COALESCE(SUM(remaining_amount), 0) as total FROM saturn_debts WHERE type = 'owes_me' AND remaining_amount > 0",
    args: [],
  });
  const totalOwed = (owedRes.rows[0] as unknown as { total: number }).total;

  const oweRes = await client.execute({
    sql: "SELECT COALESCE(SUM(remaining_amount), 0) as total FROM saturn_debts WHERE type = 'i_owe' AND remaining_amount > 0",
    args: [],
  });
  const totalOwe = (oweRes.rows[0] as unknown as { total: number }).total;

  const allIncomeRes = await client.execute({
    sql: "SELECT COALESCE(SUM(amount), 0) as total FROM saturn_transactions WHERE type = 'income'",
    args: [],
  });
  const allIncome = (allIncomeRes.rows[0] as unknown as { total: number }).total;

  const allExpenseRes = await client.execute({
    sql: "SELECT COALESCE(SUM(amount), 0) as total FROM saturn_transactions WHERE type = 'expense'",
    args: [],
  });
  const allExpenses = (allExpenseRes.rows[0] as unknown as { total: number }).total;

  const cashCapital = allIncome - allExpenses;
  const totalCapital = Number(phones.cost) + bankBalance + cashCapital;

  return {
    phones_in_stock: Number(phones.count),
    inventory_value_cost: Number(phones.cost),
    inventory_value_selling: Number(phones.selling),
    total_income: Number(totalIncome),
    total_expenses: Number(totalExpenses),
    net_profit: Number(totalIncome) - Number(totalExpenses),
    bank_balance: bankBalance,
    total_owed_to_me: Number(totalOwed),
    total_i_owe: Number(totalOwe),
    total_capital: totalCapital,
    cash_capital: cashCapital,
  };
}
