export interface Phone {
  id: number;
  brand: string;
  model: string;
  imei: string | null;
  storage: string | null;
  color: string | null;
  condition: "new" | "used_good" | "used_fair";
  cost_price: number;
  selling_price: number;
  status: "in_stock" | "sold" | "returned";
  memo: string | null;
  created_at: string;
  sold_at: string | null;
}

export interface Transaction {
  id: number;
  type: "income" | "expense";
  amount: number;
  description: string;
  memo: string | null;
  phone_id: number | null;
  category: "phone_sale" | "rent" | "utilities" | "transport" | "other";
  created_at: string;
}

export interface Debt {
  id: number;
  type: "owes_me" | "i_owe";
  name: string;
  phone_number: string | null;
  original_amount: number;
  remaining_amount: number;
  memo: string | null;
  due_date: string | null;
  created_at: string;
}

export interface DebtPayment {
  id: number;
  debt_id: number;
  amount: number;
  memo: string | null;
  created_at: string;
}

export interface BankEntry {
  id: number;
  type: "deposit" | "withdrawal";
  amount: number;
  memo: string | null;
  balance_after: number;
  created_at: string;
}

export interface DashboardStats {
  phones_in_stock: number;
  inventory_value_cost: number;
  inventory_value_selling: number;
  total_income: number;
  total_expenses: number;
  net_profit: number;
  bank_balance: number;
  total_owed_to_me: number;
  total_i_owe: number;
  total_capital: number;
  cash_capital: number;
}
