"use client";

import { useState, ReactNode } from "react";
import { Package, ArrowUpRight, ArrowDownLeft, RotateCcw, ShoppingBag, Landmark } from "lucide-react";
import { formatBirr, formatDate } from "@/lib/format";
import ModalDrilldown from "@/components/ModalDrilldown";
import PhoneDetail from "@/components/PhoneDetail";
import { useData } from "@/lib/DataProvider";
import type { TimelineEvent } from "@/lib/DataProvider";

type EventType =
  | "phone_added"
  | "distributed"
  | "collected"
  | "returned"
  | "direct_sale"
  | "expense"
  | "bank_deposit"
  | "bank_withdrawal";

const TYPE_CONFIG: Record<
  EventType,
  { Icon: React.ElementType; color: string }
> = {
  phone_added:     { Icon: Package,       color: "var(--muted)" },
  distributed:     { Icon: ArrowUpRight,  color: "var(--amber)" },
  collected:       { Icon: ArrowDownLeft, color: "var(--green)" },
  returned:        { Icon: RotateCcw,     color: "var(--muted)" },
  direct_sale:     { Icon: ShoppingBag,   color: "var(--green)" },
  expense:         { Icon: ArrowUpRight,  color: "var(--error)" },
  bank_deposit:    { Icon: Landmark,      color: "var(--green)" },
  bank_withdrawal: { Icon: Landmark,      color: "var(--error)" },
};

/* ─── Phone-type events where we can extract a phone ID ─── */
const PHONE_EVENT_PREFIXES: Record<string, string[]> = {
  phone_added: ["phone-add-"],
  distributed: ["phone-dist-"],
  direct_sale: ["phone-sale-", "phone-add-"],
  collected:   ["phone-col-", "phone-add-"],
};

function extractPhoneId(event: TimelineEvent): number | null {
  const prefixes = PHONE_EVENT_PREFIXES[event.type];
  if (!prefixes) return null;
  for (const prefix of prefixes) {
    if (event.id.startsWith(prefix)) {
      const num = parseInt(event.id.slice(prefix.length), 10);
      if (!isNaN(num)) return num;
    }
  }
  // Also try generic patterns
  if (event.id.startsWith("phone-add-")) {
    const num = parseInt(event.id.slice("phone-add-".length), 10);
    if (!isNaN(num)) return num;
  }
  if (event.id.startsWith("phone-dist-")) {
    const num = parseInt(event.id.slice("phone-dist-".length), 10);
    if (!isNaN(num)) return num;
  }
  return null;
}

function isPhoneEvent(type: EventType): boolean {
  return ["phone_added", "distributed", "direct_sale", "collected"].includes(type);
}

/* ─── Date helpers ─── */

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

  for (const label of GROUP_ORDER) {
    if (map.has(label)) {
      groups.push({ label, events: map.get(label)! });
      map.delete(label);
    }
  }

  for (const [label, evs] of map) {
    groups.push({ label, events: evs });
  }

  return groups;
}

/* ─── Detail row helper for inline cards ─── */
const detailRow = (label: string, value: string | null | undefined, color?: string) => {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--surface-border)" }}>
      <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: color || "var(--white)" }}>{value}</span>
    </div>
  );
};

/* ─── Inline detail cards ─── */

function ExpenseDetailCard({ event }: { event: TimelineEvent }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--white)", margin: "0 0 16px" }}>
        {event.title}
      </h2>
      <div style={{ marginBottom: 16 }}>
        {detailRow("Type", "Expense")}
        {detailRow("Description", event.title)}
        {event.amount !== null && detailRow("Amount", formatBirr(event.amount), "var(--error)")}
        {detailRow("Date", formatDate(event.created_at))}
        {event.subtitle && detailRow("Details", event.subtitle)}
      </div>
    </div>
  );
}

function BankDetailCard({ event }: { event: TimelineEvent }) {
  const isDeposit = event.type === "bank_deposit";
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--white)", margin: "0 0 16px" }}>
        {event.title}
      </h2>
      <div style={{ marginBottom: 16 }}>
        {detailRow("Type", isDeposit ? "Deposit" : "Withdrawal")}
        {event.amount !== null && detailRow("Amount", formatBirr(event.amount), isDeposit ? "var(--green)" : "var(--error)")}
        {event.subtitle && detailRow("Details", event.subtitle)}
        {detailRow("Date", formatDate(event.created_at))}
      </div>
    </div>
  );
}

function GenericEventCard({ event }: { event: TimelineEvent }) {
  const amountColor =
    event.amountType === "income"  ? "var(--green)"  :
    event.amountType === "expense" ? "var(--error)"  :
    "var(--muted)";

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--white)", margin: "0 0 16px" }}>
        {event.title}
      </h2>
      <div style={{ marginBottom: 16 }}>
        {detailRow("Type", event.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))}
        {event.amount !== null && detailRow("Amount", formatBirr(event.amount), amountColor)}
        {event.subtitle && detailRow("Details", event.subtitle)}
        {detailRow("Date", formatDate(event.created_at))}
      </div>
    </div>
  );
}

/* ─── Page ─── */

export default function TimelinePage() {
  const { getTimelineEvents, loading, refresh } = useData();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  // Computed instantly from context
  const events = getTimelineEvents();

  const groups = groupEvents(events);

  // Flat index for modal cycling
  const flatEvents = groups.flatMap((g) => g.events);

  function openEvent(eventId: string) {
    const idx = flatEvents.findIndex((e) => e.id === eventId);
    if (idx >= 0) {
      setModalIndex(idx);
      setModalOpen(true);
    }
  }

  function renderContent(item: any, pushView: (content: ReactNode, title: string) => void): ReactNode {
    const event = item as TimelineEvent;

    // Phone events: try to extract phone ID for PhoneDetail
    if (isPhoneEvent(event.type as EventType)) {
      const phoneId = extractPhoneId(event);
      if (phoneId !== null) {
        return (
          <PhoneDetail
            phoneId={phoneId}
            pushView={pushView}
            onAction={() => { refresh(); setModalOpen(false); }}
          />
        );
      }
    }

    // Expense events
    if (event.type === "expense") {
      return <ExpenseDetailCard event={event} />;
    }

    // Bank events
    if (event.type === "bank_deposit" || event.type === "bank_withdrawal") {
      return <BankDetailCard event={event} />;
    }

    // Fallback: generic card
    return <GenericEventCard event={event} />;
  }

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
        {!loading && (
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

        {!loading && events.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", fontSize: 14 }}>
            No events yet
          </div>
        )}

        {!loading && groups.map((group) => (
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
                const cfg = TYPE_CONFIG[event.type as EventType];
                const Icon = cfg.Icon;

                const amountColor =
                  event.amountType === "income"  ? "var(--green)"  :
                  event.amountType === "expense" ? "var(--error)"  :
                  "var(--muted)";

                return (
                  <div
                    key={event.id}
                    onClick={() => openEvent(event.id)}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--surface-border)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      cursor: "pointer",
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

      {/* Modal Drilldown */}
      <ModalDrilldown
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        items={flatEvents}
        currentIndex={modalIndex}
        onChangeIndex={setModalIndex}
        renderContent={renderContent}
      />
    </div>
  );
}
