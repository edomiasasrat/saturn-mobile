import { createClient } from "@libsql/client";
import type { Phone, Transaction, BankEntry, Seller, SellerWithStats, DashboardStats, PhoneActivity, Loan, LoanPayment } from "./types";

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
      // Drop old v1 tables (safe — these don't exist in v2)
      "DROP TABLE IF EXISTS saturn_debt_payments",
      "DROP TABLE IF EXISTS saturn_debts",

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

      // Loans
      `CREATE TABLE IF NOT EXISTS saturn_loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_name TEXT NOT NULL,
        phone_number TEXT,
        original_amount INTEGER NOT NULL,
        remaining_amount INTEGER NOT NULL,
        loan_type TEXT NOT NULL DEFAULT 'given' CHECK(loan_type IN ('given', 'taken')),
        memo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,

      // Loan payments
      `CREATE TABLE IF NOT EXISTS saturn_loan_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id INTEGER NOT NULL REFERENCES saturn_loans(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        memo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,

      // Bank entries
      `CREATE TABLE IF NOT EXISTS saturn_bank_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal')),
        amount INTEGER NOT NULL,
        memo TEXT,
        bank_name TEXT,
        currency TEXT NOT NULL DEFAULT 'birr' CHECK(currency IN ('birr', 'usd', 'usdt')),
        balance_after INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ],
    "write"
  );

  // Safe column additions for existing databases
  const alterStatements = [
    "ALTER TABLE saturn_bank_entries ADD COLUMN bank_name TEXT",
    "ALTER TABLE saturn_bank_entries ADD COLUMN currency TEXT NOT NULL DEFAULT 'birr'",
    "ALTER TABLE saturn_loans ADD COLUMN loan_type TEXT NOT NULL DEFAULT 'given'",
  ];
  for (const sql of alterStatements) {
    try { await client.execute(sql); } catch { /* column already exists */ }
  }
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

export async function updateSeller(id: number, data: { name?: string; phone_number?: string | null; location?: string | null; memo?: string | null }): Promise<Seller> {
  await ensureInit();
  const seller = await getSeller(id);
  if (!seller) throw new Error("Seller not found");
  await client.execute({
    sql: "UPDATE saturn_sellers SET name = ?, phone_number = ?, location = ?, memo = ? WHERE id = ?",
    args: [data.name ?? seller.name, data.phone_number ?? seller.phone_number, data.location ?? seller.location, data.memo ?? seller.memo, id],
  });
  return (await getSeller(id))!;
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
  const phone = rowTo<Phone>(result.rows[0]);

  // Auto-create purchase expense so capital tracks money spent
  await client.execute({
    sql: `INSERT INTO saturn_transactions (type, amount, description, memo, phone_id, category, payment_method)
          VALUES ('expense', ?, ?, NULL, ?, 'purchase', 'cash')`,
    args: [data.cost_price, `Purchased: ${data.brand} ${data.model}`, phone.id],
  });

  return phone;
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

export async function updatePhone(id: number, data: {
  brand?: string; model?: string; imei?: string | null; storage?: string | null;
  color?: string | null; condition?: string; cost_price?: number; asking_price?: number; memo?: string | null;
}): Promise<Phone> {
  await ensureInit();
  const phone = await getPhone(id);
  if (!phone) throw new Error("Phone not found");
  await client.execute({
    sql: `UPDATE saturn_phones SET brand = ?, model = ?, imei = ?, storage = ?, color = ?, condition = ?, cost_price = ?, asking_price = ?, memo = ? WHERE id = ?`,
    args: [
      data.brand ?? phone.brand, data.model ?? phone.model, data.imei ?? phone.imei,
      data.storage ?? phone.storage, data.color ?? phone.color, data.condition ?? phone.condition,
      data.cost_price ?? phone.cost_price, data.asking_price ?? phone.asking_price,
      data.memo ?? phone.memo, id,
    ],
  });
  return (await getPhone(id))!;
}

export async function deletePhone(id: number): Promise<void> {
  await ensureInit();
  await client.execute({ sql: "DELETE FROM saturn_phones WHERE id = ?", args: [id] });
}

// ── Collections ──────────────────────────────────────────────────────────────

export async function collectPerPhone(sellerId: number, phoneIds: number[], paymentMethod: string, priceOverride?: number): Promise<Transaction[]> {
  await ensureInit();
  const transactions: Transaction[] = [];
  const isSingleWithOverride = phoneIds.length === 1 && priceOverride != null;

  for (const pid of phoneIds) {
    const phone = await getPhone(pid);
    if (!phone || phone.seller_id !== sellerId || phone.status !== "with_seller") continue;

    await client.execute({
      sql: "UPDATE saturn_phones SET status = 'sold', sold_at = datetime('now') WHERE id = ?",
      args: [pid],
    });

    const amount = isSingleWithOverride ? priceOverride : phone.asking_price;
    const txRes = await client.execute({
      sql: `INSERT INTO saturn_transactions (type, amount, description, memo, phone_id, seller_id, category, payment_method)
            VALUES ('income', ?, ?, NULL, ?, ?, 'collection', ?) RETURNING *`,
      args: [amount, `Collection: ${phone.brand} ${phone.model}`, pid, sellerId, paymentMethod],
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
  type: string; amount: number; description: string; memo: string | null; category: string; payment_method?: string;
}): Promise<Transaction> {
  await ensureInit();
  const pm = data.payment_method || null;
  const result = await client.execute({
    sql: `INSERT INTO saturn_transactions (type, amount, description, memo, category, payment_method)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [data.type, data.amount, data.description, data.memo, data.category, pm],
  });

  // If expense paid from bank, create a bank withdrawal
  if (data.type === "expense" && pm === "bank") {
    await addBankEntry({ type: "withdrawal", amount: data.amount, memo: data.description });
  }

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

export async function getBankBalance(currency: string = "birr"): Promise<number> {
  await ensureInit();
  // Sum latest balance_after per bank_name for this currency
  // Uses MAX(id) as tiebreaker for entries with identical timestamps
  const result = await client.execute({
    sql: `SELECT COALESCE(bank_name, '__cash__') as bname, balance_after
          FROM saturn_bank_entries
          WHERE currency = ?
          AND id IN (
            SELECT MAX(e2.id) FROM saturn_bank_entries e2
            WHERE e2.currency = ?
            GROUP BY COALESCE(e2.bank_name, '__cash__')
          )`,
    args: [currency, currency],
  });
  let total = 0;
  for (const row of result.rows) {
    total += Number((row as unknown as { balance_after: number }).balance_after);
  }
  return total;
}

export async function getAllBankBalances(): Promise<{ birr: number; usd: number; usdt: number }> {
  await ensureInit();
  const [birr, usd, usdt] = await Promise.all([
    getBankBalance("birr"),
    getBankBalance("usd"),
    getBankBalance("usdt"),
  ]);
  return { birr, usd, usdt };
}

export async function addBankEntry(data: { type: string; amount: number; memo: string | null; bank_name?: string | null; currency?: string }): Promise<BankEntry> {
  await ensureInit();
  const currency = data.currency || "birr";
  const currentBalance = await getBankBalance(currency);
  const newBalance = data.type === "deposit" ? currentBalance + data.amount : currentBalance - data.amount;
  const result = await client.execute({
    sql: "INSERT INTO saturn_bank_entries (type, amount, memo, bank_name, currency, balance_after) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
    args: [data.type, data.amount, data.memo, data.bank_name ?? null, currency, newBalance],
  });
  return rowTo<BankEntry>(result.rows[0]);
}

// ── Dashboard ────────────────────────────────────────────────────────────────

// Returns { sql, args } for parameterized date filtering
function periodFilter(period: string | undefined, column: string = "created_at"): { sql: string; args: (string | number)[] } {
  if (period === "today") {
    const today = new Date().toISOString().split("T")[0];
    return { sql: ` AND date(${column}) = ?`, args: [today] };
  }
  if (period === "week") return { sql: ` AND ${column} >= datetime('now', '-7 days')`, args: [] };
  if (period === "month") return { sql: ` AND ${column} >= datetime('now', '-30 days')`, args: [] };
  return { sql: "", args: [] };
}

export async function getDashboardStats(period?: string): Promise<DashboardStats> {
  await ensureInit();

  const pf = periodFilter(period);

  const stockRes = await client.execute({
    sql: "SELECT COUNT(*) as cnt, COALESCE(SUM(cost_price), 0) as val FROM saturn_phones WHERE status = 'in_stock'", args: [],
  });
  const stock = stockRes.rows[0] as unknown as { cnt: number; val: number };

  const withSellersRes = await client.execute({
    sql: "SELECT COUNT(*) as cnt, COALESCE(SUM(asking_price), 0) as val FROM saturn_phones WHERE status = 'with_seller'", args: [],
  });
  const withSellers = withSellersRes.rows[0] as unknown as { cnt: number; val: number };

  const collectionsRes = await client.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) as total FROM saturn_transactions WHERE type = 'income'${pf.sql}`, args: [...pf.args],
  });
  const collections = Number((collectionsRes.rows[0] as unknown as { total: number }).total);

  const expensesRes = await client.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) as total FROM saturn_transactions WHERE type = 'expense'${pf.sql}`, args: [...pf.args],
  });
  const allExpenses = Number((expensesRes.rows[0] as unknown as { total: number }).total);

  const operatingExpensesRes = await client.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) as total FROM saturn_transactions WHERE type = 'expense' AND category != 'purchase'${pf.sql}`, args: [...pf.args],
  });
  const operatingExpenses = Number((operatingExpensesRes.rows[0] as unknown as { total: number }).total);

  const birrBalance = await getBankBalance("birr");

  return {
    phones_in_stock: Number(stock.cnt),
    phones_with_sellers: Number(withSellers.cnt),
    money_out_there: Number(withSellers.val),
    stock_value: Number(stock.val),
    total_collections: collections,
    total_expenses: allExpenses,
    total_operating_expenses: operatingExpenses,
    net_profit: collections - operatingExpenses,
    bank_balance_birr: birrBalance,
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

// ── Phone Activity Stats ────────────────────────────────────────────────────

export async function getPhoneActivity(period?: string): Promise<PhoneActivity> {
  await ensureInit();

  const pf = periodFilter(period);
  const pfSold = periodFilter(period, "sold_at");
  const pfTx = periodFilter(period, "t.created_at");

  const boughtRes = await client.execute({
    sql: `SELECT COUNT(*) as cnt FROM saturn_phones WHERE 1=1${pf.sql}`, args: [...pf.args],
  });
  const bought = Number((boughtRes.rows[0] as unknown as { cnt: number }).cnt);

  const soldRes = await client.execute({
    sql: `SELECT COUNT(*) as cnt FROM saturn_phones WHERE status = 'sold' AND sold_at IS NOT NULL${pfSold.sql}`, args: [...pfSold.args],
  });
  const sold = Number((soldRes.rows[0] as unknown as { cnt: number }).cnt);

  const byMeRes = await client.execute({
    sql: `SELECT COUNT(*) as cnt FROM saturn_transactions t WHERE t.category = 'direct_sale'${pfTx.sql}`, args: [...pfTx.args],
  });
  const soldByMe = Number((byMeRes.rows[0] as unknown as { cnt: number }).cnt);

  const bySellersRes = await client.execute({
    sql: `SELECT COUNT(*) as cnt FROM saturn_transactions t WHERE t.category = 'collection' AND t.phone_id IS NOT NULL${pfTx.sql}`, args: [...pfTx.args],
  });
  const soldBySellers = Number((bySellersRes.rows[0] as unknown as { cnt: number }).cnt);

  return { bought, sold, sold_by_me: soldByMe, sold_by_sellers: soldBySellers };
}

// ── Loans ─────────────────────────────────────────────────────────────────────

export async function getLoans(): Promise<Loan[]> {
  await ensureInit();
  const result = await client.execute({ sql: "SELECT * FROM saturn_loans ORDER BY created_at DESC", args: [] });
  return result.rows.map((r) => rowTo<Loan>(r));
}

export async function getLoan(id: number): Promise<Loan | null> {
  await ensureInit();
  const result = await client.execute({ sql: "SELECT * FROM saturn_loans WHERE id = ?", args: [id] });
  return result.rows.length ? rowTo<Loan>(result.rows[0]) : null;
}

export async function addLoan(data: { person_name: string; phone_number: string | null; original_amount: number; loan_type?: string; memo: string | null }): Promise<Loan> {
  await ensureInit();
  const loanType = data.loan_type || "given";
  const result = await client.execute({
    sql: "INSERT INTO saturn_loans (person_name, phone_number, original_amount, remaining_amount, loan_type, memo) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
    args: [data.person_name, data.phone_number, data.original_amount, data.original_amount, loanType, data.memo],
  });
  return rowTo<Loan>(result.rows[0]);
}

export async function updateLoan(id: number, data: { person_name?: string; phone_number?: string | null; memo?: string | null }): Promise<Loan> {
  await ensureInit();
  const loan = await getLoan(id);
  if (!loan) throw new Error("Loan not found");
  await client.execute({
    sql: "UPDATE saturn_loans SET person_name = ?, phone_number = ?, memo = ?, updated_at = datetime('now') WHERE id = ?",
    args: [data.person_name ?? loan.person_name, data.phone_number ?? loan.phone_number, data.memo ?? loan.memo, id],
  });
  return (await getLoan(id))!;
}

export async function deleteLoan(id: number): Promise<void> {
  await ensureInit();
  await client.execute({ sql: "DELETE FROM saturn_loan_payments WHERE loan_id = ?", args: [id] });
  await client.execute({ sql: "DELETE FROM saturn_loans WHERE id = ?", args: [id] });
}

export async function addLoanPayment(loanId: number, amount: number, memo: string | null): Promise<LoanPayment> {
  await ensureInit();
  const loan = await getLoan(loanId);
  if (!loan) throw new Error("Loan not found");
  if (amount > loan.remaining_amount) throw new Error("Payment exceeds remaining amount");
  const newRemaining = loan.remaining_amount - amount;
  await client.execute({
    sql: "UPDATE saturn_loans SET remaining_amount = ?, updated_at = datetime('now') WHERE id = ?",
    args: [newRemaining, loanId],
  });
  const result = await client.execute({
    sql: "INSERT INTO saturn_loan_payments (loan_id, amount, memo) VALUES (?, ?, ?) RETURNING *",
    args: [loanId, amount, memo],
  });
  return rowTo<LoanPayment>(result.rows[0]);
}

export async function getLoanPayments(loanId: number): Promise<LoanPayment[]> {
  await ensureInit();
  const result = await client.execute({
    sql: "SELECT * FROM saturn_loan_payments WHERE loan_id = ? ORDER BY created_at DESC",
    args: [loanId],
  });
  return result.rows.map((r) => rowTo<LoanPayment>(r));
}

export async function adjustLoanAmount(loanId: number, newRemaining: number): Promise<Loan> {
  await ensureInit();
  await client.execute({
    sql: "UPDATE saturn_loans SET remaining_amount = ?, updated_at = datetime('now') WHERE id = ?",
    args: [newRemaining, loanId],
  });
  return (await getLoan(loanId))!;
}
