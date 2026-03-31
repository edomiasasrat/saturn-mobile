interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  accent?: string;
}

export default function StatCard({ label, value, color, accent }: StatCardProps) {
  const valueColor = color || (accent === "success" ? "var(--success)" : accent === "danger" ? "var(--error)" : "var(--white)");
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--surface-border)",
      padding: "14px 12px",
      borderRadius: "var(--radius)",
      textAlign: "center",
      cursor: "pointer",
    }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}
