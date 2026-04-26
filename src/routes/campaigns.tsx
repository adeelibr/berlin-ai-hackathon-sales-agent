import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AuthGuard, AppShell } from "@/components/AppShell";
import { useTray } from "@/lib/tray-context";
import { SW_CAMPAIGNS, SW_PERSONAS, SW_LEADS, SW_STATE_LABEL, type Campaign } from "@/lib/workspace-mocks";
import { Plus, X, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/campaigns")({
  component: () => (
    <AuthGuard>
      <AppShell>
        <CampaignsPageContent />
      </AppShell>
    </AuthGuard>
  ),
});

function CampaignTrayContent({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const persona = SW_PERSONAS.find((p) => p.id === campaign.persona);
  const leads = SW_LEADS.filter((l) => campaign.leadIds.includes(l.id));
  const called = leads.filter((l) => l.state === "called").length;
  const scheduled = leads.filter((l) => l.state === "scheduled").length;
  const newLeads = leads.filter((l) => l.state === "new").length;
  const total = leads.length;
  const pct = total > 0 ? Math.round(((called + scheduled) / total) * 100) : 0;

  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference - (pct / 100) * circumference;

  const accentMap: Record<string, string> = {
    sage: "var(--sw-accent)",
    warm: "var(--sw-warm)",
    stone: "var(--sw-stone)",
  };
  const personaAccent = persona ? accentMap[persona.accent] ?? "var(--sw-accent)" : "var(--sw-accent)";

  return (
    <>
      <div className="sw-tray-head">
          <span className="kicker">Campaign · {campaign.id.toUpperCase()}</span>
          <button className="sw-tray-close" onClick={onClose} aria-label="Close">
            <X size={14} strokeWidth={1.6} />
          </button>
        </div>

        <div className="sw-tray-body">
          <div className="sw-tray-camp-hero">
            <div className="sw-camp-hero-grid">
              <div className="sw-arc">
                <svg width="132" height="132" viewBox="0 0 132 132">
                  <circle cx="66" cy="66" r="52" fill="none" stroke="var(--sw-line-soft)" strokeWidth="6" />
                  <circle
                    cx="66" cy="66" r="52"
                    fill="none"
                    stroke={campaign.status === "running" ? "var(--sw-accent)" : "var(--sw-muted)"}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div className="v">
                  {pct}%
                  <small>contact</small>
                </div>
              </div>
              <div>
                <div className="kicker" style={{ marginBottom: 4 }}>
                  <span className={"sw-status " + campaign.status}>
                    <span className="dot" />
                    {campaign.status}
                  </span>
                </div>
                <h2>{campaign.name}</h2>
                <div className="sw-leadbar" style={{ marginTop: 8 }}>
                  {total > 0 && (
                    <>
                      <i className="called" style={{ width: `${(called / total) * 100}%` }} />
                      <i className="scheduled" style={{ width: `${(scheduled / total) * 100}%` }} />
                      <i className="new" style={{ width: `${(newLeads / total) * 100}%` }} />
                    </>
                  )}
                </div>
                <div className="sw-leadbar-legend">
                  <span className="lg"><span className="dt" style={{ background: "var(--sw-accent)" }} /> Called {called}</span>
                  <span className="lg"><span className="dt" style={{ background: "var(--sw-warm)" }} /> Scheduled {scheduled}</span>
                  <span className="lg"><span className="dt" style={{ background: "var(--sw-muted)" }} /> New {newLeads}</span>
                </div>
              </div>
            </div>
          </div>

          {persona && (
            <div className="sw-tray-block">
              <h4>Voice persona</h4>
              <div className="sw-persona-card">
                <div className="gly" style={{ color: personaAccent }}>{persona.name[0]}</div>
                <div>
                  <div className="nm">{persona.name}</div>
                  <div className="st">{persona.style}</div>
                  <div className="sw-persona-stats">
                    <span>Tone · {persona.stats.tone}</span>
                    <span>Pace · {persona.stats.pace}</span>
                    <span>{persona.stats.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="sw-tray-block">
            <h4>Brief</h4>
            <p style={{ margin: 0, fontSize: 14, color: "var(--sw-ink-soft)", lineHeight: 1.7, fontFamily: "Fraunces, Georgia, serif", fontWeight: 300 }}>
              {campaign.brief}
            </p>
          </div>

          <div className="sw-tray-block">
            <h4>Talking points <span className="meta">{campaign.talkingPoints.length} points</span></h4>
            <ul className="sw-talking-list">
              {campaign.talkingPoints.map((pt, i) => (
                <li key={i}>
                  <span className="num">{i + 1}.</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="sw-tray-block" style={{ borderBottom: "none" }}>
            <h4>Leads <span className="meta">{total} assigned</span></h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {leads.map((l) => {
                const s = SW_STATE_LABEL[l.state];
                return (
                  <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", border: "1px solid var(--sw-line-soft)", borderRadius: 8, background: "var(--sw-card)" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--sw-ink)" }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: "var(--sw-muted)", marginTop: 2 }}>{l.company}</div>
                    </div>
                    <span className="sw-state">
                      <span className="dot" style={{ background: s.dot }} />
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      <div className="sw-tray-foot">
        <button className="sw-btn primary" style={{ flex: 1, justifyContent: "center" }}>
          {campaign.status === "running" ? "Pause campaign" : "Start campaign"}
        </button>
        <button className="sw-btn">Edit</button>
        <button className="sw-btn ghost">Duplicate</button>
      </div>
    </>
  );
}

function CampaignsPageContent() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { openTray, closeTray, isOpen } = useTray();

  const handleOpen = (id: string) => {
    setActiveId(id);
    const campaign = SW_CAMPAIGNS.find((c) => c.id === id);
    if (campaign) {
      const handleClose = () => {
        closeTray();
        setActiveId(null);
      };
      openTray(
        <CampaignTrayContent campaign={campaign} onClose={handleClose} />,
        () => setActiveId(null),
      );
    }
  };

  // Sync external close (Escape / route change) → clear activeId
  useEffect(() => {
    if (!isOpen && activeId) setActiveId(null);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sw-fade-in">
      <header className="sw-page-header">
        <div>
          <div className="kicker">Workspace</div>
          <h1 className="sw-page-title">Campaigns</h1>
          <p className="sw-page-sub">Each campaign pairs a voice persona with a lead list and a brief. Click any row to review before launching.</p>
        </div>
        <button className="sw-btn primary">
          <Plus size={14} strokeWidth={1.6} /> New campaign
        </button>
      </header>

      <div style={{ borderTop: "1px solid var(--sw-line-soft)" }}>
        {SW_CAMPAIGNS.map((campaign) => {
          const persona = SW_PERSONAS.find((p) => p.id === campaign.persona);
          const leads = SW_LEADS.filter((l) => campaign.leadIds.includes(l.id));
          const called = leads.filter((l) => l.state === "called").length;
          const scheduled = leads.filter((l) => l.state === "scheduled").length;
          const newLeads = leads.filter((l) => l.state === "new").length;
          const total = leads.length;

          return (
            <div key={campaign.id} className="sw-camp-row2" onClick={() => handleOpen(campaign.id)}>
              <div className="gly2">{campaign.name[0]}</div>
              <div className="nameblock">
                <div className="nm">{campaign.name}</div>
                <div className="br">{campaign.brief}</div>
              </div>
              <div className="voice2">
                {persona ? (
                  <>
                    <div className="vn">{persona.name}</div>
                    <div className="vt">{persona.style}</div>
                  </>
                ) : (
                  <div className="vn" style={{ color: "var(--sw-muted)" }}>No persona</div>
                )}
              </div>
              <div className="progblock">
                <div className="num">
                  {called + scheduled}
                  <small>/ {total} contacted</small>
                </div>
                <div className="leadbar-mini">
                  {total > 0 && (
                    <>
                      <i className="called" style={{ width: `${(called / total) * 100}%` }} />
                      <i className="scheduled" style={{ width: `${(scheduled / total) * 100}%` }} />
                      <i className="new" style={{ width: `${(newLeads / total) * 100}%` }} />
                    </>
                  )}
                </div>
              </div>
              <div className="statusblock">
                <span className={"sw-status " + campaign.status}>
                  <span className="dot" />
                  {campaign.status}
                </span>
                <span className="when">
                  {campaign.status === "running" ? "Active now" : "Draft"}
                </span>
                <ChevronRight size={14} strokeWidth={1.6} style={{ color: "var(--sw-muted)" }} />
              </div>
            </div>
          );
        })}
      </div>

      {SW_CAMPAIGNS.length === 0 && (
        <div className="sw-empty">
          <h3>No campaigns yet</h3>
          <p>Create your first campaign to pair a persona with a lead list.</p>
        </div>
      )}
    </div>
  );
}
