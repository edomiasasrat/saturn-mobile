import { createClient } from "@libsql/client";
import type { Phone, Transaction, BankEntry, Seller, SellerWithStats, DashboardStats } from "./types";

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
      // Drop old tables
      "DROP TABLE IF EXISTS saturn_debt_payments",
      "DROP TABLE IF EXISTS saturn_debts",
      "DROP TABLE IF EXISTS saturn_transactions",
      "DROP TABLE IF EXISTS saturn_phones",

      // Sellers
      `CREATE TABLE IF NOT EXISTS saturn_sellers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone_number TEXT,
        location TEXT,
        memo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,

      // Phones (v2)
      `CREATE TABLE IF NOT EXISTS saturn_phones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        imei TEXT UNIQUE,
        storage TEXT,
        color TEXT,
        condition TEXT NOT NULL CHECK(condition IN ('new', 'used_good', 'used_fair')),
        cost_price INTEGER NOT NULL,
        asking_price INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_stock' CHECK(status IN ('in_stock', 'with_seller', 'sold', 'returned')),
        seller_id INTEGER REFERENCES saturn_sellers(id),
        memo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        distributed_at TEXT,
        sold_at TEXT
      )`,

      // Transactions (v2)
      `CREATE TABLE IF NOT EXISTS saturn_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount INTEGER NOT NULL,
        description TEXT NOT NULL,
        memo TEXT,
        phone_id INTEGER REFERENCES saturn_phones(id),
        seller_id INTEGER REFERENCES saturn_sellers(id),
        category TEXT NOT NULL CHECK(category IN ('collection', 'direct_sale', 'purchase', 'rent', 'utilities', 'transport', 'other')),
        payment_method TEXT CHECK(payment_method IN ('cash', 'bank')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,

      // Bank entries (unchanged)
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

// ── Sellers ──────────────────────────────────────────────────────────────────

export async function getSellers(): Promise<Seller[]> {
  await ensureInit();
  const result = await client.execute({ sql: "SELECT * FROM saturn_sellers ORDER BY name ASC", args: [] });
  return result.rows.map((r) => rowTo<Seller>(r));
}

export async function getSeller(id: number): Promise<Seller | null> {
  await ensureInit();
  const result = await client.execute({ sql: "SELECT * FROM saturn_sellers WHERE id = ?", args: [id] });
  return result.rows.length ? rowTo<Seller>(result.rows[0]) : null;
}

export async function getSellerWithStats(id: number): Promise<SellerWithStats | null> {
  await ensureInit();
  const seller = await getSeller(id);
  if (!seller) return null;

  const phonesRes = await client.execute({
    sql: "SELECT COUNT(*) as held, COALESCE(SUM(asking_price), 0) as owed FROM saturn_phones WHERE seller_id = ? AND status = 'with_seller'",
    args: [id],
  });
  const held = Number((phonesRes.rows[0] as unknown as { held: number }).held);
  const owed = Number((phonesRes.rows[0] as unknown as { owed: number }).owed);

  const collectedRes = await client.execute({
    sql: "SELECT COALESCE(SUM(amount), 0) as total FROM saturn_transactions WHERE seller_id = ? AND type = 'income'",
    args: [id],
  });
  const collected = Number((collectedRes.rows[0] as unknown as { total: number }).total);

  const givenRes = await client.execute({
    sql: "SELECT COUNT(*) as total FROM saturn_phones WHERE seller_id = ?",
    args: [id],
  });
  const given = Number((givenRes.rows[0] as unknown as { total: number }).total);

  return { ...seller, phones_held: held, total_owed: owed, total_collected: collected, total_given: given };
}

export async function addSeller(data: { name: string; phone_number: string | null; location: string | null; memo: string | null }): Promise<Seller> {
  await ensureInit();
  const result = await client.execute({
    sql: "INSERT INTO saturn_sellers (name, phone_number, location, memo) VALUES (?, ?, ?, ?) RETURNING *",
    args: [data.name, data.phone_number, data.location, data.memo],
  });
  return rowTo<Seller>(result.rows[0]);
}

export async function deleteSeller(id: number): Promise<void> {
  await ensureInit();
  await client.execute({ sql: "DELETE FROM saturn_sellers WHERE id = ?", args: [id] });
}

// ── Phones ───────────────────────────────────────────────────────────────────

export async function getPhones(filters?: { status?: string; seller_id?: number }): Promise<Phone[]> {
  await ensureInit();
  let sql = "SELECT * FROM saturn_phones WHERE 1=1";
  const args: (string | number)[] = [];
  if (filters?.status) { sql += " AND status = ?"; args.push(filters.status); }
  if (filters?.seller_id) { sql += " AND seller_id = ?"; args.push(filters.seller_id); }
  sql += " ORDER BY created_at DESC";
  const result = await client.execute({ sql, args });
  return result.rows.map((r) => rowTo<Phone>(r));
}

export async function getPhone(id: number): Promise<Phone | null> {
  await ensureInit();
  const result = await client.execute({ sql: "SELECT * FROM saturn_phones WHERE id = ?", args: [id] });
  return result.rows.length ? rowTo<Phone>(result.rows[0]) : null;
}

export async function addPhone(data: {
  brand: string; model: string; imei: string | null; storage: string | null;
  color: string | null; condition: string; cost_price: number; asking_price: number; memo: string | null;
}): Promise<Phone> {
  await ensureInit();
  const result = await client.execute({
    sql: `INSERT INTO saturn_phones (brand, model, imei, storage, color, condition, cost_price, asking_price, memo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [data.brand, data.model, data.imei, data.storage, data.color, data.condition, data.cost_price, data.asking_price, data.memo],
  });
  return rowTo<Phone>(result.rows[0]);
}

export async function distributePhone(phoneId: number, sellerId: number): Promise<Phone> {
  await ensureInit();
  await client.execute({
    sql: "UPDATE saturn_phones SET status = 'with_seller', seller_id = ?, distributed_at = datetime('now') WHERE id = ? AND status = 'in_stock'",
    args: [sellerId, phoneId],
  });
  const result = await client.execute({ sql: "SELECT * FROM saturn_phones WHERE id = ?", args: [phoneId] });
  return rowTo<Phone>(result.rows[0]);
}

export async function returnPhone(phoneId: number): Promise<Phone> {
  await ensureInit();
  await client.execute({
    sql: "UPDATE saturn_phones SET status = 'in_stock', seller_id = NULL, distributed_at = NULL WHERE id = ? AND status = 'with_seller'",
    args: [phoneId],
  });
  const result = await client.execute({ sql: "SELECT * FROM saturn_phones WHERE id = ?", args: [phoneId] });
  return rowTo<Phone>(result.rows[0]);
}

export async function quickSellPhone(phoneId: number, actualPrice: number, paymentMethod: string): Promise<{ phone: Phone; transaction: Transaction }> {
  await ensureInit();
  const phone = await getPhone(phoneId);
  if (!phone || phone.status !== "in_stock") throw new Error("Phone not available for sale");

  await client.execute({
    sql: "UPDATE saturn_phones SET status = 'sold', sold_at = datetime('now') WHERE id = ?",
    args: [phoneId],
  });

  const txRes = await client.execute({
    sql: `INSERT INTO saturn_transactions (type, amount, description, memo, phone_id, category, payment_method)
          VALUES ('income', ?, ?, ?, ?, 'direct_sale', ?) RETURNING *`,
    args: [actualPrice, `Direct sale: ${phone.brand} ${phone.model}`, phone.memo, phoneId, paymentMethod],
  });

  if (paymentMethod === "bank") {
    await addBankEntry({ type: "deposit", amount: actualPrice, memo: `Direct sale: ${phone.brand} ${phone.model}` });
  }

  const updated = await getPhone(phoneId);
  return { phone: updated!, transaction: rowTo<Transaction>(txRes.rows[0]) };
}

export async function deletePhone(id: number): Promise<void> {
  await ensureInit();
  await client.execute({ sql: "DELETE FROM saturn_phones WHERE id = ?", args: [id] });
}

// ── Collections ──────────────────────────────────────────────────────────────

export async function collectPerPhone(sellerId: number, phoneIds: number[], paymentMethod: string): Promise<Transaction[]> {
  await ensureInit();
  const transactions: Transaction[] = [];

  for (const pid of phoneIds) {
    const phone = await getPhone(pid);
    if (!phone || phone.seller_id !== sellerId || phone.status !== "with_seller") continue;

    await client.execute({
      sql: "UPDATE saturn_phones SET status = 'sold', sold_at = datetime('now') WHERE id = ?",
      args: [pid],
    });

    const txRes = await client.execute({
      sql: `INSERT INTO saturn_transactions (type, amount, description, memo, phone_id, seller_id, category, payment_method)
            VALUES ('income', ?, ?, NULL, ?, ?, 'collection', ?) RETURNING *`,
      args: [phone.asking_price, `Collection: ${phone.brand} ${phone.model}`, pid, sellerId, paymentMethod],
    });
    transactions.push(rowTo<Transaction>(txRes.rows[0]));
  }

  const totalAmount = transactions.reduce((s, t) => s + t.amount, 0);
  if (paymentMethod === "bank" && totalAmount > 0) {
    const seller = await getSeller(sellerId);
    await addBankEntry({ type: "deposit", amount: totalAmount, memo: `Collection from ${seller?.name}` });
  }

  return transactions;
}

export async function collectLumpSum(sellerId: number, amount: number, paymentMethod: string, memo: string | null): Promise<Transaction> {
  await ensureInit();
  const seller = await getSeller(sellerId);
  if (!seller) throw new Error("Seller not found");

  const txRes = await client.execute({
    sql: `INSERT INTO saturn_transactions (type, amount, description, memo, seller_id, category, payment_method)
          VALUES ('income', ?, ?, ?, ?, 'collection', ?) RETURNING *`,
    args: [amount, `Lump sum from ${seller.name}`, memo, sellerId, paymentMethod],
  });

  if (paymentMethod === "bank") {
    await addBankEntry({ type: "deposit", amount, memo: `Lump sum from ${seller.name}` });
  }

  return rowTo<Transaction>(txRes.rows[0]);
}

// ── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(filters?: { type?: string; category?: string; seller_id?: number }): Promise<Transaction[]> {
  await ensureInit();
  let sql = "SELECT * FROM saturn_transactions WHERE 1=1";
  const args: (string | number)[] = [];
  if (filters?.type) { sql += " AND type = ?"; args.push(filters.type); }
  if (filters?.category) { sql += " AND category = ?"; args.push(filters.category); }
  if (filters?.seller_id) { sql += " AND seller_id = ?"; args.push(filters.seller_id); }
  sql += " ORDER BY created_at DESC";
  const result = await client.execute({ sql, args });
  return result.rows.map((r) => rowTo<Transaction>(r));
}

export async function addTransaction(data: {
  type: string; amount: number; description: string; memo: string | null; category: string;
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

// ── Bank ─────────────────────────────────────────────────────────────────────

export async function getBankEntries(): Promise<BankEntry[]> {
  await ensureInit();
  const result = await client.execute({ sql: "SELECT * FROM saturn_bank_entries ORDER BY created_at DESC", args: [] });
  return result.rows.map((r) => rowTo<BankEntry>(r));
}

export async function getBankBalance(): Promise<number> {
  await ensureInit();
  const result = await client.execute({
    sql: "SELECT balance_after FROM saturn_bank_entries ORDER BY created_at DESC LIMIT 1", args: [],
  });
  return result.rows.length ? Number((result.rows[0] as unknown as { balance_after: number }).balance_after) : 0;
}

export async function addBankEntry(data: { type: string; amount: number; memo: string | null }): Promise<BankEntry> {
  await ensureInit();
  const currentBalance = await getBankBalance();
  const newBalance = data.type === "deposit" ? currentBalance + data.amount : currentBalance - data.amount;
  const result = await client.execute({
    sql: "INSERT INTO saturn_bank_entries (type, amount, memo, balance_after) VALUES (?, ?, ?, ?) RETURNING *",
    args: [data.type, data.amount, data.memo, newBalance],
  });
  return rowTo<BankEntry>(result.rows[0]);
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(period?: string): Promise<DashboardStats> {
  await ensureInit();

  let dateFilter = "";
  const today = new Date().toISOString().split("T")[0];
  if (period === "today") dateFilter = ` AND date(created_at) = '${today}'`;
  else if (period === "week") dateFilter = ` AND created_at >= datetime('now', '-7 days')`;
  else if (period === "month") dateFilter = ` AND created_at >= datetime('now', '-30 days')`;

  const stockRes = await client.execute({
    sql: "SELECT COUNT(*) as cnt, COALESCE(SUM(cost_price), 0) as val FROM saturn_phones WHERE status = 'in_stock'", args: [],
  });
  const stock = stockRes.rows[0] as unknown as { cnt: number; val: number };

  const withSellersRes = await client.execute({
    sql: "SELECT COUNT(*) as cnt, COALESCE(SUM(asking_price), 0) as val FROM saturn_phones WHERE status = 'with_seller'", args: [],
  });
  const withSellers = withSellersRes.rows[0] as unknown as { cnt: number; val: number };

  const collectionsRes = await client.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) as total FROM saturn_transactions WHERE type = 'income'${dateFilter}`, args: [],
  });
  const collections = Number((collectionsRes.rows[0] as unknown as { total: number }).total);

  const expensesRes = await client.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) as total FROM saturn_transactions WHERE type = 'expense'${dateFilter}`, args: [],
  });
  const expenses = Number((expensesRes.rows[0] as unknown as { total: number }).total);

  const bankBalance = await getBankBalance();

  const allIncomeRes = await client.execute({
    sql: "SELECT COALESCE(SUM(amount), 0) as total FROM saturn_transactions WHERE type = 'income'", args: [],
  });
  const allIncome = Number((allIncomeRes.rows[0] as unknown as { total: number }).total);
  const allExpensesRes = await client.execute({
    sql: "SELECT COALESCE(SUM(amount), 0) as total FROM saturn_transactions WHERE type = 'expense'", args: [],
  });
  const allExpenses = Number((allExpensesRes.rows[0] as unknown as { total: number }).total);

  const cashOnHand = allIncome - allExpenses;
  const totalCapital = Number(stock.val) + Number(withSellers.val) + bankBalance + cashOnHand;

  return {
    phones_in_stock: Number(stock.cnt),
    phones_with_sellers: Number(withSellers.cnt),
    money_out_there: Number(withSellers.val),
    stock_value: Number(stock.val),
    total_collections: collections,
    total_expenses: expenses,
    net_profit: collections - expenses,
    bank_balance: bankBalance,
    total_capital: totalCapital,
  };
}

// ── Top Sellers ──────────────────────────────────────────────────────────────

export async function getTopSellers(limit: number = 5): Promise<SellerWithStats[]> {
  await ensureInit();
  const sellers = await getSellers();
  const withStats: SellerWithStats[] = [];
  for (const s of sellers) {
    const ws = await getSellerWithStats(s.id);
    if (ws) withStats.push(ws);
  }
  return withStats.sort((a, b) => b.total_owed - a.total_owed).slice(0, limit);
}
