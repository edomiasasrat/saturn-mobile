"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Package, Users, Clock, Landmark } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/sellers", label: "Sellers", icon: Users },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/bank", label: "Bank", icon: Landmark },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "var(--surface)", borderTop: "1px solid var(--surface-border)",
      display: "flex", justifyContent: "space-around",
      padding: "8px 0 env(safe-area-inset-bottom, 8px)", zIndex: 50,
    }}>
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
        const Icon = tab.icon;
        return (
          <Link key={tab.href} href={tab.href} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 2, padding: "6px 12px", borderRadius: 8, textDecoration: "none",
            color: active ? "var(--accent)" : "var(--muted)",
            fontWeight: active ? 700 : 500, fontSize: 11, transition: "all 0.2s",
          }}>
            <Icon size={22} strokeWidth={active ? 2.5 : 2} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
