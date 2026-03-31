"use client";

import { useEffect, useState } from "react";
import { Package, ArrowUpRight, ArrowDownLeft, RotateCcw, ShoppingBag, Landmark } from "lucide-react";
import { formatBirr } from "@/lib/format";

type EventType =
  | "phone_added"
  | "distributed"
  | "collected"
  | "returned"
  | "direct_sale"
  | "expense"
  | "bank_deposit"
  | "bank_withdrawal";

interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  subtitle: string | null;
  amount: number | null;
  amountType: "income" | "expense" | "neutral" | null;
  created_at: string;
}

const TYPE_CONFIG: Record<
  EventType,
  { Icon: React.ElementType; color: string }
> = {
  phone_added:     { Icon: Package,       color: "var(--muted)" },
  distributed:     { Icon: ArrowUpRight,  color: "var(--accent)" },
  collected:       { Icon: ArrowDownLeft, color: "var(--green)" },
  returned:        { Icon: RotateCcw,     color: "var(--muted)" },
  direct_sale:     { Icon: ShoppingBag,   color: "var(--green)" },
  expense:         { Icon: ArrowUpRight,  color: "var(--error)" },
  bank_deposit:    { Icon: Landmark,      color: "var(--green)" },
  bank_withdrawal: { Icon: Landmark,      color: "var(--error)" },
};

function relativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1)    return "just now";
  if (diffMins < 60)   return `${diffMins}m ago`;
  if (diffHours < 24)  return `${diffHours}h ago`;
  if (diffDays < 7)    return `${diffDays}d ago`;
  if (diffWeeks < 5)   return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

function getGroupKey(iso: string): string {
  const now = new Date();
  const date = new Date(iso);

  const todayStr    = now.toDateString();
  const dateStr     = date.toDateString();

  if (todayStr === dateStr) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === dateStr) return "Yesterday";

  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7)  return "This Week";
  if (diffDays < 30) return "This Month";

  // Older: group by "Month Year"
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month"];

function groupEvents(events: TimelineEvent[]): Array<{ label: string; events: TimelineEvent[] }> {
  const map = new Map<string, TimelineEvent[]>();

  for (const e of events) {
    const key = getGroupKey(e.created_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }

  const groups: Array<{ label: string; events: TimelineEvent[] }> = [];

  // Fixed order for recent groups
  for (const label of GROUP_ORDER) {
    if (map.has(label)) {
      groups.push({ label, events: map.get(label)! });
      map.delete(label);
    }
  }

  // Remaining older groups (already in date-desc order since events are sorted)
  for (const [label, evs] of map) {
    groups.push({ label, events: evs });
  }

  return groups;
}

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/timeline")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load timeline");
        return r.json();
      })
      .then((data) => { setEvents(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const groups = groupEvents(events);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", paddingBottom: 80 }}>
      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--bg)",
        borderBottom: "1px solid var(--surface-border)",
        padding: "16px 16px 12px",
      }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
          Timeline
        </h1>
        {!loading && !error && (
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>
            {events.length} event{events.length !== 1 ? "s" : ""} total
          </p>
        )}
      </div>

      <div style={{ padding: "12px 16px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", fontSize: 14 }}>
            Loading...
          </div>
        )}

        {error && (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--error)",
            borderRadius: 10, padding: "16px", color: "var(--error)", fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", fontSize: 14 }}>
            No events yet
          </div>
        )}

        {!loading && !error && groups.map((group) => (
          <div key={group.label} style={{ marginBottom: 8 }}>
            {/* Group header */}
            <div style={{
              position: "sticky", top: 57, zIndex: 5,
              padding: "8px 0 6px",
              background: "var(--bg)",
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                textTransform: "uppercase", color: "var(--muted)",
              }}>
                {group.label}
              </span>
            </div>

            {/* Events */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {group.events.map((event) => {
                const cfg = TYPE_CONFIG[event.type];
                const Icon = cfg.Icon;

                const amountColor =
                  event.amountType === "income"  ? "var(--green)"  :
                  event.amountType === "expense" ? "var(--error)"  :
                  "var(--muted)";

                return (
                  <div
                    key={event.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--surface-border)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: "var(--bg)",
                      border: "1px solid var(--surface-border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      color: cfg.color,
                    }}>
                      <Icon size={17} strokeWidth={2} />
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600, color: "var(--text)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {event.title}
                      </div>
                      {event.subtitle && (
                        <div style={{
                          fontSize: 12, color: "var(--muted)", marginTop: 2,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {event.subtitle}
                        </div>
                      )}
                    </div>

                    {/* Right side: amount + date */}
                    <div style={{
                      display: "flex", flexDirection: "column",
                      alignItems: "flex-end", gap: 3, flexShrink: 0,
                    }}>
                      {event.amount !== null && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: amountColor }}>
                          {formatBirr(event.amount)}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        {relativeDate(event.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
