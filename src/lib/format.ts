export function formatBirr(amount: number): string {
  return `ETB ${amount.toLocaleString()}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
