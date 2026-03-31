import { NextResponse } from "next/server";
import { getPhones, getTransactions, getBankEntries, getSellers } from "@/lib/db";

export async function GET() {
  const [phones, transactions, bankEntries, sellers] = await Promise.all([
    getPhones(),
    getTransactions(),
    getBankEntries(),
    getSellers(),
  ]);

  const sellerMap: Record<number, string> = {};
  for (const s of sellers) sellerMap[s.id] = s.name;

  const events: Array<{
    id: string;
    type: "phone_added" | "distributed" | "collected" | "returned" | "direct_sale" | "expense" | "bank_deposit" | "bank_withdrawal";
    title: string;
    subtitle: string | null;
    amount: number | null;
    amountType: "income" | "expense" | "neutral" | null;
    created_at: string;
  }> = [];

  // Phone events
  for (const p of phones) {
    events.push({
      id: `phone-add-${p.id}`,
      type: "phone_added",
      title: `Added ${p.brand} ${p.model} to stock`,
      subtitle: `Cost: ETB ${p.cost_price.toLocaleString()} · Asking: ETB ${p.asking_price.toLocaleString()}`,
      amount: p.cost_price,
      amountType: "neutral",
      created_at: p.created_at,
    });

    if (p.distributed_at && p.seller_id) {
      events.push({
        id: `phone-dist-${p.id}`,
        type: "distributed",
        title: `Gave ${p.brand} ${p.model} to ${sellerMap[p.seller_id] || "Unknown"}`,
        subtitle: `Asking: ETB ${p.asking_price.toLocaleString()}`,
        amount: p.asking_price,
        amountType: "neutral",
        created_at: p.distributed_at,
      });
    }
  }

  // Transaction events
  for (const t of transactions) {
    const sellerName = t.seller_id ? sellerMap[t.seller_id] : null;
    let type: typeof events[0]["type"];
    if (t.category === "collection") type = "collected";
    else if (t.category === "direct_sale") type = "direct_sale";
    else type = "expense";

    events.push({
      id: `tx-${t.id}`,
      type,
      title: t.description,
      subtitle: [sellerName, t.memo].filter(Boolean).join(" · ") || null,
      amount: t.amount,
      amountType: t.type === "income" ? "income" : "expense",
      created_at: t.created_at,
    });
  }

  // Bank events
  for (const b of bankEntries) {
    events.push({
      id: `bank-${b.id}`,
      type: b.type === "deposit" ? "bank_deposit" : "bank_withdrawal",
      title: `Bank ${b.type}`,
      subtitle: b.memo,
      amount: b.amount,
      amountType: b.type === "deposit" ? "income" : "expense",
      created_at: b.created_at,
    });
  }

  // Sort by date descending
  events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json(events);
}
