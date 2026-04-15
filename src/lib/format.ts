export function formatBirr(amount: number): string {
  return `ETB ${amount.toLocaleString()}`;
}

export function formatCurrency(amount: number, currency: string): string {
  if (currency === "usd") return `USD ${amount.toLocaleString()}`;
  if (currency === "usdt") return `USDT ${amount.toLocaleString()}`;
  return `ETB ${amount.toLocaleString()}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
