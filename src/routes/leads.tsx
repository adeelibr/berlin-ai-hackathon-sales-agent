import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AuthGuard, AppShell } from "@/components/AppShell";
import { useTray } from "@/lib/tray-context";
import { SW_LEADS, SW_STATE_LABEL, type Lead } from "@/lib/workspace-mocks";
import { ChevronRight, Plus, Search, X } from "lucide-react";

export const Route = createFileRoute("/leads")({
  component: () => (
    <AuthGuard>
      <AppShell>
        <LeadsPageContent />
      </AppShell>
    </AuthGuard>
  ),
});

function LeadTrayContent({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const s = SW_STATE_LABEL[lead.state];
  const initials = lead.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toLowerCase();
  const email = `${lead.name.toLowerCase().split(" ")[0]}@${lead.company.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12)}.com`;

  const history =
    lead.state === "scheduled"
      ? [
          { when: "Tomorrow · 14:30", text: "Callback scheduled · 20 min", now: true },
          { when: "Apr 24 · 11:42",   text: "Voice · Margot · 2:50 · agreed to follow up" },
          { when: "Apr 22 · 09:10",   text: "Added to Q2 Berlin agencies" },
        ]
      : lead.state === "called"
      ? [
          { when: "Apr 25 · 16:08", text: "Voice · Hideo · 1:20 · no answer", now: true },
          { when: "Apr 23 · 10:55", text: "Voice · Hideo · 0:40 · busy" },
          { when: "Apr 22 · 09:10", text: "Added to Q2 Berlin agencies" },
        ]
      : [
          { when: "Today",          text: "Awaiting first dial", now: true },
          { when: "Apr 22 · 09:10", text: "Added to lead list · imported from CSV" },
        ];

  const briefs: Record<string, string> = {
    "Northwind Logistics": "Mid-size logistics operator running 24-hour dispatch from Hamburg and Berlin. Pain point: after-hours coverage during driver handoffs.",
    "Helio Solar GmbH":    "DACH solar installer, 18 trucks. Owner-operated. Hates being sold to. Last deal won by referral.",
    "Kintsugi Studio":     "Boutique design studio. Three founders. Looking to systemize cold outreach without losing tone.",
  };
  const brief = briefs[lead.company] ?? "Target account on the active list. Small to mid-market. Owner or VP-level decision maker. Open to outbound when the first call earns the second.";

  const seed = [...lead.name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const bars = Array.from({ length: 56 }, (_, i) => {
    const v = (Math.sin((i + seed) * 0.45) + Math.sin((i + seed) * 0.18)) / 2;
    const h = 8 + Math.abs(v) * 32;
    const quiet = i > 38 || (i > 18 && i < 24);
    return { h, quiet };
  });

  const lastCall =
    lead.state === "called"
      ? { who: "Hideo", duration: "1:20", outcome: "No answer" }
      : lead.state === "scheduled"
      ? { who: "Margot", duration: "2:50", outcome: "Agreed to follow up" }
      : null;

  const moods =
    lead.state === "scheduled" ? ["warm", "interested", "specific"]
    : lead.state === "called"  ? ["cautious", "polite", "skeptical"]
    : ["unknown", "first contact"];

  return (
    <>
      <div className="sw-tray-head">
        <span className="kicker">Lead detail · {lead.id.toUpperCase()}</span>
        <button className="sw-tray-close" onClick={onClose} aria-label="Close">
          <X size={14} strokeWidth={1.6} />
        </button>
      </div>

      <div className="sw-tray-body">
        <div className="sw-tray-hero">
          <div className="sw-tray-hero-top">
            <div>
              <div className="sw-tray-mono">Active lead</div>
              <div className="sw-tray-id">{initials}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="sw-tray-mono">Added</div>
              <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 14, color: "var(--sw-ink-soft)", marginTop: 4 }}>Apr 22, 2026</div>
            </div>
          </div>
          <h2 className="sw-tray-name-big">{lead.name}</h2>
          <div className="sw-tray-co">{lead.company}</div>
          <div className="sw-tray-state-row">
            <span className="sw-chip">
              <span className="dot" style={{ background: s.dot }} />
              <strong>{s.label}</strong>
            </span>
            <span className="sw-chip">UTC+1 · Berlin</span>
            <span className="sw-chip">Operations · Lead</span>
          </div>
        </div>

        <div className="sw-tray-block">
          <h4>
            {lastCall ? "Last call" : "Awaiting first dial"}
            <span className="meta">{lastCall ? "Apr 25 · 16:08" : "Today"}</span>
          </h4>
          <div className="sw-call-card">
            <div className="sw-call-card-top">
              <div className="who">
                {lastCall ? (
                  <>{lastCall.who} <em>· {lastCall.outcome.toLowerCase()}</em></>
                ) : (
                  <em style={{ color: "var(--sw-muted)" }}>No call placed yet — agent will introduce itself first.</em>
                )}
              </div>
              {lastCall && (
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--sw-muted)" }}>{lastCall.duration}</div>
              )}
            </div>
            <div className="sw-wave" aria-hidden="true">
              {bars.map((b, i) => (
                <i key={i} className={b.quiet ? "q" : ""} style={{ height: b.h }} />
              ))}
            </div>
            <div className="sw-call-card-foot">
              <span>00:00</span>
              <span>{lastCall ? lastCall.duration : "—:—"}</span>
            </div>
          </div>
          <div className="sw-mood-row" style={{ marginTop: 14 }}>
            {moods.map((m) => <span key={m} className="sw-mood">{m}</span>)}
          </div>
        </div>

        <div className="sw-tray-block">
          <h4>Reach</h4>
          <div className="sw-tray-contact">
            <div className="it">
              <div className="lbl">Phone</div>
              <div className="v">{lead.phone}</div>
            </div>
            <div className="it email">
              <div className="lbl">Email</div>
              <div className="v">{email}</div>
            </div>
            <div className="it">
              <div className="lbl">Best time</div>
              <div className="v">Tue–Thu · AM</div>
            </div>
            <div className="it">
              <div className="lbl">Channel</div>
              <div className="v">Voice first</div>
            </div>
          </div>
        </div>

        <div className="sw-tray-block">
          <h4>Account brief</h4>
          <p style={{ margin: 0, fontSize: 14, color: "var(--sw-ink-soft)", lineHeight: 1.7, fontFamily: "Fraunces, Georgia, serif", fontWeight: 300 }}>
            {brief}
          </p>
        </div>

        <div className="sw-tray-block">
          <h4>Activity <span className="meta">{history.length} events</span></h4>
          <ul className="sw-tray-timeline">
            {history.map((h, i) => (
              <li key={i} className={h.now ? "now" : ""}>
                <span className="tdot" />
                <span>{h.text}</span>
                <span className="when">{h.when}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="sw-tray-block" style={{ borderBottom: "none" }}>
          <h4>Notes <span className="meta">read by agent</span></h4>
          <textarea className="sw-textarea" rows={3} placeholder="Quiet observations. The agent reads these before dialing." />
        </div>
      </div>

      <div className="sw-tray-foot">
        <button className="sw-btn primary" style={{ flex: 1, justifyContent: "center" }}>Dial now</button>
        <button className="sw-btn">Schedule</button>
        <button className="sw-btn ghost" onClick={onClose}>Company</button>
      </div>
    </>
  );
}

function LeadsPageContent() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "called" | "scheduled">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const { openTray, closeTray, isOpen } = useTray();

  const leads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SW_LEADS.filter((l) => {
      if (filter !== "all" && l.state !== filter) return false;
      if (!q) return true;
      return l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.phone.toLowerCase().includes(q);
    });
  }, [query, filter]);

  const counts = useMemo(() => ({
    all:       SW_LEADS.length,
    new:       SW_LEADS.filter((l) => l.state === "new").length,
    called:    SW_LEADS.filter((l) => l.state === "called").length,
    scheduled: SW_LEADS.filter((l) => l.state === "scheduled").length,
  }), []);

  // Sync activeId → tray
  const handleOpen = (id: string) => {
    setActiveId(id);
    const lead = SW_LEADS.find((l) => l.id === id);
    if (lead) {
      const handleClose = () => {
        closeTray();
        setActiveId(null);
      };
      openTray(
        <LeadTrayContent lead={lead} onClose={handleClose} />,
        () => setActiveId(null),
      );
    }
  };

  // Sync external close (Escape / route change) → clear activeId
  useEffect(() => {
    if (!isOpen && activeId) setActiveId(null);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  type FilterKey = "all" | "new" | "called" | "scheduled";
  const Pill = ({ id, label }: { id: FilterKey; label: string }) => (
    <button className={"sw-pill " + (filter === id ? "active" : "")} onClick={() => setFilter(id)}>
      {id !== "all" && <span className="dot" style={{ background: SW_STATE_LABEL[id as Exclude<FilterKey, "all">].dot }} />}
      {label} <span style={{ opacity: 0.55, marginLeft: 4 }}>{counts[id]}</span>
    </button>
  );

  return (
    <div className="sw-fade-in">
      <header className="sw-page-header">
        <div>
          <div className="kicker">Workspace</div>
          <h1 className="sw-page-title">Leads</h1>
          <p className="sw-page-sub">A quiet list. Click any row to read the full lead before you let an agent dial.</p>
        </div>
        <button className="sw-btn primary">
          <Plus size={14} strokeWidth={1.6} /> Add lead
        </button>
      </header>

      <div className="sw-toolbar">
        <div className="sw-search">
          <span className="sw-search-icon"><Search size={14} strokeWidth={1.6} /></span>
          <input className="sw-input" placeholder="Search by name, company, or number" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="sw-filter-pills">
          <Pill id="all" label="All" />
          <Pill id="new" label="New" />
          <Pill id="called" label="Called" />
          <Pill id="scheduled" label="Scheduled" />
        </div>
      </div>

      <div className="sw-leads-list">
        {leads.map((l, i) => {
          const s = SW_STATE_LABEL[l.state];
          return (
            <div key={l.id} className="sw-lead-row" onClick={() => handleOpen(l.id)}>
              <div className="sw-lead-index">{String(i + 1).padStart(2, "0")}</div>
              <div className="sw-lead-name">{l.name}</div>
              <div className="sw-lead-company">{l.company}</div>
              <div className="sw-lead-phone">{l.phone}</div>
              <div className="sw-state">
                <span className="dot" style={{ background: s.dot }} />
                {s.label}
              </div>
              <div className="sw-lead-arrow"><ChevronRight size={14} strokeWidth={1.6} /></div>
            </div>
          );
        })}
        {leads.length === 0 && (
          <div style={{ padding: "60px 8px", textAlign: "center", color: "var(--sw-muted)", fontSize: 13 }}>No leads match.</div>
        )}
      </div>

      <div className="sw-leads-foot">
        <span>{leads.length} of {SW_LEADS.length} leads</span>
        <span>Last synced 2 minutes ago</span>
      </div>
    </div>
  );
}
