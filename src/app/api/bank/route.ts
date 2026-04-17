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
