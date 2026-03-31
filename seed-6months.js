const { createClient } = require("@libsql/client");
const fs = require("fs");

const env = fs.readFileSync("/home/dizzy/saturn-mobile/.env.local", "utf8");
const url = env.match(/TURSO_DATABASE_URL=(.*)/)[1].trim();
const token = env.match(/TURSO_AUTH_TOKEN=(.*)/)[1].trim();
const client = createClient({ url, authToken: token });

async function run() {
  // WIPE existing data for clean seed
  await client.batch([
    "DELETE FROM saturn_transactions",
    "DELETE FROM saturn_phones",
    "DELETE FROM saturn_sellers",
    "DELETE FROM saturn_bank_entries",
  ], "write");
  console.log("Wiped old data");

  // ── SELLERS (18 sellers across Addis) ──
  const sellers = [
    { name: "Abebe Electronics", phone: "0911234567", loc: "Merkato", memo: "Big buyer, pays on time" },
    { name: "Sara Mobile", phone: "0922345678", loc: "Piazza", memo: "Small shop, 2-3 phones at a time" },
    { name: "Daniel Phone House", phone: "0933456789", loc: "Bole", memo: "Premium phones only" },
    { name: "Kidus Telecom", phone: "0944567890", loc: "Merkato", memo: "Bulk buyer, negotiates hard" },
    { name: "Meron Accessories", phone: "0955678901", loc: "Mexico", memo: "Phones + accessories" },
    { name: "Yonas Mobile Shop", phone: "0966789012", loc: "Arat Kilo", memo: "University area, budget phones" },
    { name: "Hana Tech", phone: "0977890123", loc: "CMC", memo: "New seller, started 3 months ago" },
    { name: "Fikru Phone Center", phone: "0988901234", loc: "Merkato", memo: "Oldest partner, very reliable" },
    { name: "Tigist Mobile", phone: "0912345670", loc: "Gerji", memo: "Prefers Samsung" },
    { name: "Binyam Gadgets", phone: "0923456701", loc: "Piazza", memo: "Also sells laptops" },
    { name: "Rahel Electronics", phone: "0934567012", loc: "Bole Medhanialem", memo: "iPhone specialist" },
    { name: "Solomon Phones", phone: "0945670123", loc: "Megenagna", memo: "Good with Tecno/Infinix" },
    { name: "Almaz Mobile", phone: "0956701234", loc: "Kality", memo: "South Addis coverage" },
    { name: "Dawit Tech Hub", phone: "0967012345", loc: "Kazanchis", memo: "Corporate clients" },
    { name: "Bethlehem Store", phone: "0978123456", loc: "Lebu", memo: "Suburban, steady sales" },
    { name: "Girma Wholesale", phone: "0989234567", loc: "Merkato", memo: "Also a supplier, we trade stock" },
    { name: "Selamawit Phones", phone: "0911345678", loc: "Sarbet", memo: "Weekend market seller" },
    { name: "Henok Mobile", phone: "0922456789", loc: "Bole Atlas", memo: "Mall kiosk" },
  ];

  const sellerIds = [];
  for (const s of sellers) {
    const r = await client.execute({
      sql: "INSERT INTO saturn_sellers (name, phone_number, location, memo) VALUES (?, ?, ?, ?) RETURNING id",
      args: [s.name, s.phone, s.loc, s.memo],
    });
    sellerIds.push(Number(r.rows[0].id));
  }
  console.log("Created " + sellerIds.length + " sellers");

  // ── PHONES (150+ phones over 6 months) ──
  const brands = [
    { brand: "Samsung", models: ["Galaxy A14", "Galaxy A34", "Galaxy A54", "Galaxy S23", "Galaxy S24", "Galaxy A05", "Galaxy M14", "Galaxy A25"] },
    { brand: "iPhone", models: ["11", "12", "13", "13 Pro", "14", "14 Pro", "15", "SE 2022"] },
    { brand: "Tecno", models: ["Spark 10", "Spark 10 Pro", "Camon 20", "Camon 20 Pro", "Pop 7", "Pova 5"] },
    { brand: "Infinix", models: ["Hot 30", "Hot 30i", "Note 30", "Zero 30", "Smart 7"] },
    { brand: "Xiaomi", models: ["Redmi 12", "Redmi Note 12", "Redmi Note 13", "Poco X5", "Poco M5"] },
    { brand: "Huawei", models: ["Nova Y61", "Nova Y90", "Nova 11i"] },
    { brand: "Realme", models: ["C55", "C51", "11 Pro"] },
    { brand: "Nokia", models: ["G21", "G42", "C32"] },
    { brand: "Vivo", models: ["Y17s", "Y36", "V29"] },
  ];

  const conditions = ["new", "new", "new", "used_good", "used_good", "used_fair"];
  const storages = ["64GB", "128GB", "128GB", "256GB", "256GB", "512GB"];
  const colors = ["Black", "Blue", "White", "Green", "Purple", "Gold", "Silver", "Red"];

  const phoneData = [];
  let imeiBase = 350000000000000;

  for (let i = 0; i < 160; i++) {
    const brandGroup = brands[Math.floor(Math.random() * brands.length)];
    const model = brandGroup.models[Math.floor(Math.random() * brandGroup.models.length)];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const storage = storages[Math.floor(Math.random() * storages.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];

    // Price based on brand
    let baseCost;
    switch (brandGroup.brand) {
      case "iPhone": baseCost = 15000 + Math.floor(Math.random() * 35000); break;
      case "Samsung": baseCost = 5000 + Math.floor(Math.random() * 30000); break;
      case "Huawei": baseCost = 6000 + Math.floor(Math.random() * 15000); break;
      case "Xiaomi": baseCost = 4000 + Math.floor(Math.random() * 12000); break;
      default: baseCost = 3000 + Math.floor(Math.random() * 10000); break;
    }
    if (condition === "used_good") baseCost = Math.floor(baseCost * 0.7);
    if (condition === "used_fair") baseCost = Math.floor(baseCost * 0.5);

    const margin = Math.floor(baseCost * (0.1 + Math.random() * 0.2));
    const askingPrice = baseCost + margin;

    // Random date in past 6 months
    const daysAgo = Math.floor(Math.random() * 180);

    phoneData.push({
      brand: brandGroup.brand, model, imei: String(imeiBase + i),
      storage, color, condition, cost_price: baseCost,
      asking_price: askingPrice, daysAgo,
    });
  }

  // Sort by date (oldest first)
  phoneData.sort((a, b) => b.daysAgo - a.daysAgo);

  const phoneIds = [];
  for (const p of phoneData) {
    const r = await client.execute({
      sql: `INSERT INTO saturn_phones (brand, model, imei, storage, color, condition, cost_price, asking_price, status, memo, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_stock', NULL, datetime('now', '-${p.daysAgo} days')) RETURNING id`,
      args: [p.brand, p.model, p.imei, p.storage, p.color, p.condition, p.cost_price, p.asking_price],
    });
    phoneIds.push({ id: Number(r.rows[0].id), ...p });
  }
  console.log("Created " + phoneIds.length + " phones");

  // ── DISTRIBUTE PHONES TO SELLERS (over time) ──
  // ~120 phones get distributed, ~90 get collected/sold, ~30 still with sellers, ~10 returned, ~30 still in stock
  
  const distributed = phoneIds.slice(0, 120); // first 120 phones get distributed
  let bankBalance = 0;
  const txBatch = [];
  const bankBatch = [];

  for (const phone of distributed) {
    const sellerId = sellerIds[Math.floor(Math.random() * sellerIds.length)];
    const distDaysAgo = Math.max(1, phone.daysAgo - Math.floor(Math.random() * 5));

    await client.execute({
      sql: `UPDATE saturn_phones SET status = 'with_seller', seller_id = ?, distributed_at = datetime('now', '-${distDaysAgo} days') WHERE id = ?`,
      args: [sellerId, phone.id],
    });
  }
  console.log("Distributed 120 phones to sellers");

  // ── COLLECT PAYMENTS (90 phones get paid for) ──
  const collected = distributed.slice(0, 90);
  for (const phone of collected) {
    const collectDaysAgo = Math.max(0, phone.daysAgo - Math.floor(Math.random() * 10) - 5);
    const payMethod = Math.random() > 0.4 ? "cash" : "bank";

    // Mark phone as sold
    await client.execute({
      sql: `UPDATE saturn_phones SET status = 'sold', sold_at = datetime('now', '-${collectDaysAgo} days') WHERE id = ?`,
      args: [phone.id],
    });

    // Get seller_id
    const pRes = await client.execute({ sql: "SELECT seller_id FROM saturn_phones WHERE id = ?", args: [phone.id] });
    const sid = Number(pRes.rows[0].seller_id);

    // Create collection transaction
    await client.execute({
      sql: `INSERT INTO saturn_transactions (type, amount, description, seller_id, phone_id, category, payment_method, created_at)
            VALUES ('income', ?, ?, ?, ?, 'collection', ?, datetime('now', '-${collectDaysAgo} days'))`,
      args: [phone.asking_price, `Collection: ${phone.brand} ${phone.model}`, sid, phone.id, payMethod],
    });

    // If bank, create bank deposit
    if (payMethod === "bank") {
      bankBalance += phone.asking_price;
      await client.execute({
        sql: `INSERT INTO saturn_bank_entries (type, amount, memo, balance_after, created_at)
              VALUES ('deposit', ?, ?, ?, datetime('now', '-${collectDaysAgo} days'))`,
        args: [phone.asking_price, `Collection: ${phone.brand} ${phone.model}`, bankBalance],
      });
    }
  }
  console.log("Collected payment for 90 phones");

  // ── RETURN 5 phones back to stock ──
  const returned = distributed.slice(90, 95);
  for (const phone of returned) {
    await client.execute({
      sql: "UPDATE saturn_phones SET status = 'in_stock', seller_id = NULL, distributed_at = NULL WHERE id = ?",
      args: [phone.id],
    });
  }
  console.log("Returned 5 phones to stock");
  // Remaining 25 phones (index 95-119) stay with_seller

  // ── DIRECT SALES (10 from remaining stock) ──
  const directSale = phoneIds.slice(130, 140);
  for (const phone of directSale) {
    const saleDaysAgo = Math.max(0, phone.daysAgo - Math.floor(Math.random() * 7));
    const payMethod = Math.random() > 0.5 ? "cash" : "bank";
    const salePrice = phone.asking_price + Math.floor(Math.random() * 1000);

    await client.execute({
      sql: `UPDATE saturn_phones SET status = 'sold', sold_at = datetime('now', '-${saleDaysAgo} days') WHERE id = ?`,
      args: [phone.id],
    });

    await client.execute({
      sql: `INSERT INTO saturn_transactions (type, amount, description, category, payment_method, phone_id, created_at)
            VALUES ('income', ?, ?, 'direct_sale', ?, ?, datetime('now', '-${saleDaysAgo} days'))`,
      args: [salePrice, `Direct sale: ${phone.brand} ${phone.model}`, payMethod, phone.id],
    });

    if (payMethod === "bank") {
      bankBalance += salePrice;
      await client.execute({
        sql: `INSERT INTO saturn_bank_entries (type, amount, memo, balance_after, created_at)
              VALUES ('deposit', ?, ?, ?, datetime('now', '-${saleDaysAgo} days'))`,
        args: [salePrice, `Direct sale: ${phone.brand} ${phone.model}`, bankBalance],
      });
    }
  }
  console.log("Direct sold 10 phones");

  // ── LUMP SUM COLLECTIONS (scattered) ──
  for (let i = 0; i < 12; i++) {
    const sid = sellerIds[Math.floor(Math.random() * sellerIds.length)];
    const amount = (Math.floor(Math.random() * 20) + 5) * 1000;
    const daysAgo = Math.floor(Math.random() * 150);
    const payMethod = Math.random() > 0.5 ? "cash" : "bank";

    // Get seller name
    const sRes = await client.execute({ sql: "SELECT name FROM saturn_sellers WHERE id = ?", args: [sid] });
    const sName = sRes.rows[0].name;

    await client.execute({
      sql: `INSERT INTO saturn_transactions (type, amount, description, memo, seller_id, category, payment_method, created_at)
            VALUES ('income', ?, ?, ?, ?, 'collection', ?, datetime('now', '-${daysAgo} days'))`,
      args: [amount, `Lump sum from ${sName}`, "Partial payment on outstanding balance", sid, payMethod],
    });

    if (payMethod === "bank") {
      bankBalance += amount;
      await client.execute({
        sql: `INSERT INTO saturn_bank_entries (type, amount, memo, balance_after, created_at)
              VALUES ('deposit', ?, ?, ?, datetime('now', '-${daysAgo} days'))`,
        args: [amount, `Lump sum from ${sName}`, bankBalance],
      });
    }
  }
  console.log("Added 12 lump sum collections");

  // ── EXPENSES (monthly recurring + one-off) ──
  const monthlyExpenses = [
    { desc: "Shop rent", cat: "rent", amount: 8000 },
    { desc: "Electricity bill", cat: "utilities", amount: 1200 },
    { desc: "Water bill", cat: "utilities", amount: 400 },
  ];

  for (let month = 0; month < 6; month++) {
    for (const exp of monthlyExpenses) {
      const daysAgo = month * 30 + Math.floor(Math.random() * 5);
      await client.execute({
        sql: `INSERT INTO saturn_transactions (type, amount, description, category, created_at)
              VALUES ('expense', ?, ?, ?, datetime('now', '-${daysAgo} days'))`,
        args: [exp.amount, exp.desc, exp.cat],
      });
    }
  }

  // One-off expenses
  const oneOffs = [
    { desc: "Bulk purchase - 20 Samsung units from Dubai", amount: 180000, cat: "purchase", days: 150 },
    { desc: "Bulk purchase - 15 Tecno units", amount: 75000, cat: "purchase", days: 120 },
    { desc: "Bulk purchase - 10 iPhone units", amount: 280000, cat: "purchase", days: 90 },
    { desc: "Bulk purchase - 12 mixed units from Merkato", amount: 96000, cat: "purchase", days: 60 },
    { desc: "Bulk purchase - 8 Xiaomi units", amount: 48000, cat: "purchase", days: 45 },
    { desc: "Bulk purchase - 15 Samsung A-series", amount: 120000, cat: "purchase", days: 30 },
    { desc: "Bulk purchase - 10 Infinix + Tecno", amount: 65000, cat: "purchase", days: 15 },
    { desc: "Transport - Merkato pickup", amount: 800, cat: "transport", days: 145 },
    { desc: "Transport - Bole delivery run", amount: 600, cat: "transport", days: 110 },
    { desc: "Transport - CMC deliveries", amount: 500, cat: "transport", days: 75 },
    { desc: "Transport - Kality + Lebu run", amount: 900, cat: "transport", days: 40 },
    { desc: "Transport - Merkato restock", amount: 700, cat: "transport", days: 20 },
    { desc: "Transport - Piazza deliveries", amount: 550, cat: "transport", days: 8 },
    { desc: "Transport - Bole Atlas delivery", amount: 400, cat: "transport", days: 2 },
    { desc: "Phone display case", amount: 2500, cat: "other", days: 160 },
    { desc: "New SIM card holder rack", amount: 800, cat: "other", days: 100 },
    { desc: "Security camera for shop", amount: 4500, cat: "other", days: 80 },
    { desc: "Shop sign repair", amount: 1500, cat: "other", days: 50 },
    { desc: "WiFi router for shop", amount: 2000, cat: "other", days: 35 },
    { desc: "Screen protectors bulk - 100 pcs", amount: 3000, cat: "other", days: 25 },
    { desc: "Phone cases bulk - 50 pcs", amount: 2500, cat: "other", days: 10 },
  ];

  for (const e of oneOffs) {
    await client.execute({
      sql: `INSERT INTO saturn_transactions (type, amount, description, category, created_at)
            VALUES ('expense', ?, ?, ?, datetime('now', '-${e.days} days'))`,
      args: [e.amount, e.desc, e.cat],
    });
  }
  console.log("Added 6 months of expenses");

  // ── BANK: withdrawals for purchases ──
  const withdrawals = [
    { amount: 180000, memo: "Withdrawal for Dubai phone purchase", days: 151 },
    { amount: 75000, memo: "Withdrawal for Tecno bulk", days: 121 },
    { amount: 280000, memo: "Withdrawal for iPhone bulk", days: 91 },
    { amount: 96000, memo: "Withdrawal for Merkato purchase", days: 61 },
    { amount: 48000, memo: "Withdrawal for Xiaomi bulk", days: 46 },
    { amount: 50000, memo: "Cash withdrawal for expenses", days: 30 },
    { amount: 120000, memo: "Withdrawal for Samsung bulk", days: 31 },
    { amount: 65000, memo: "Withdrawal for Infinix/Tecno", days: 16 },
    { amount: 20000, memo: "Cash withdrawal for shop expenses", days: 7 },
  ];

  for (const w of withdrawals) {
    bankBalance -= w.amount;
    await client.execute({
      sql: `INSERT INTO saturn_bank_entries (type, amount, memo, balance_after, created_at)
            VALUES ('withdrawal', ?, ?, ?, datetime('now', '-${w.days} days'))`,
      args: [w.amount, w.memo, bankBalance],
    });
  }

  // Initial large deposit 6 months ago
  bankBalance += 500000;
  await client.execute({
    sql: `INSERT INTO saturn_bank_entries (type, amount, memo, balance_after, created_at)
          VALUES ('deposit', 500000, 'Starting business capital', ?, datetime('now', '-180 days'))`,
    args: [bankBalance],
  });

  console.log("Added bank entries, final balance: " + bankBalance);

  // ── FINAL STATS ──
  const phoneStats = await client.execute({ sql: "SELECT status, COUNT(*) as c FROM saturn_phones GROUP BY status", args: [] });
  console.log("\n=== FINAL STATE ===");
  console.log("Phones:", phoneStats.rows.map(r => `${r.status}: ${r.c}`).join(", "));
  
  const txStats = await client.execute({ sql: "SELECT type, COUNT(*) as c, SUM(amount) as total FROM saturn_transactions GROUP BY type", args: [] });
  console.log("Transactions:", txStats.rows.map(r => `${r.type}: ${r.c} txs, ETB ${r.total}`).join(" | "));
  
  const sellerStats = await client.execute({ sql: "SELECT COUNT(*) as c FROM saturn_sellers", args: [] });
  console.log("Sellers:", sellerStats.rows[0].c);
  
  const bankStats = await client.execute({ sql: "SELECT COUNT(*) as c FROM saturn_bank_entries", args: [] });
  console.log("Bank entries:", bankStats.rows[0].c);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
