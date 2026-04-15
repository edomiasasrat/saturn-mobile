export interface Seller {
  id: number;
  name: string;
  phone_number: string | null;
  location: string | null;
  memo: string | null;
  created_at: string;
}

export interface Phone {
  id: number;
  brand: string;
  model: string;
  imei: string | null;
  storage: string | null;
  color: string | null;
  condition: "new" | "used_good" | "used_fair";
  cost_price: number;
  asking_price: number;
  status: "in_stock" | "with_seller" | "sold" | "returned";
  seller_id: number | null;
  memo: string | null;
  created_at: string;
  distributed_at: string | null;
  sold_at: string | null;
}

export interface Transaction {
  id: number;
  type: "income" | "expense";
  amount: number;
  description: string;
  memo: string | null;
  phone_id: number | null;
  seller_id: number | null;
  category: "collection" | "direct_sale" | "purchase" | "rent" | "utilities" | "transport" | "other";
  payment_method: "cash" | "bank" | null;
  created_at: string;
}

export interface BankEntry {
  id: number;
  type: "deposit" | "withdrawal";
  amount: number;
  memo: string | null;
  bank_name: string | null;
  currency: "birr" | "usd" | "usdt";
  balance_after: number;
  created_at: string;
}

export interface Loan {
  id: number;
  person_name: string;
  phone_number: string | null;
  original_amount: number;
  remaining_amount: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanPayment {
  id: number;
  loan_id: number;
  amount: number;
  memo: string | null;
  created_at: string;
}

export interface PhoneActivity {
  bought: number;
  sold: number;
  sold_by_me: number;
  sold_by_sellers: number;
}

export interface SellerWithStats extends Seller {
  phones_held: number;
  total_owed: number;
  total_collected: number;
  total_given: number;
}

export interface DashboardStats {
  phones_in_stock: number;
  phones_with_sellers: number;
  money_out_there: number;
  stock_value: number;
  total_collections: number;
  total_expenses: number;
  net_profit: number;
  bank_balance: number;
  total_capital: number;
}
