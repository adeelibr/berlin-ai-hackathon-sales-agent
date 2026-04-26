import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGuard, AppShell } from "@/components/AppShell";
import { useTray } from "@/lib/tray-context";
import { SW_PERSONAS, type Persona } from "@/lib/workspace-mocks";
import { Plus, X } from "lucide-react";

export const Route = createFileRoute("/sales-personas")({
  component: () => (
    <AuthGuard>
      <AppShell>
        <SalesPersonasPageContent />
      </AppShell>
    </AuthGuard>
  ),
});

const ACCENT_MAP: Record<string, string> = {
  sage: "acc-sage",
  stone: "acc-stone",
  warm: "acc-warm",
};

function PersonaTrayContent({
  persona,
  onClose,
}: {
  persona: Persona;
  onClose: () => void;
}) {
  const accentColor =
    persona.accent === "warm"
      ? "var(--sw-warm)"
      : persona.accent === "stone"
        ? "var(--sw-stone)"
        : "var(--sw-accent)";

  return (
    <>
      <div className="sw-tray-head">
        <span className="kicker">Voice persona</span>
        <button className="sw-tray-close" onClick={onClose} aria-label="Close">
          <X size={14} strokeWidth={1.6} />
        </button>
      </div>

      <div className="sw-tray-body">
        <div className="sw-portrait">
          <span className="glyph" style={{ color: accentColor }}>
            {persona.name[0]}
          </span>
          <span className="corner">{persona.accent} voice</span>
        </div>

        <div className="sw-tray-block">
          <div className="sw-pers-hero-eyebrow">
            <span>Voice persona</span>
            <span>{persona.feature ? "Featured" : "Standard"}</span>
          </div>
          <h2 className="sw-tray-name-big" style={{ marginTop: 8 }}>
            {persona.name}
          </h2>
          <div
            style={{
              fontFamily: "Fraunces, Georgia, serif",
              fontStyle: "italic",
              color: "var(--sw-ink-soft)",
              fontSize: 16,
              fontWeight: 300,
              marginTop: 6,
            }}
          >
            {persona.style}
          </div>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 14,
              lineHeight: 1.65,
              color: "var(--sw-ink-soft)",
              fontFamily: "Fraunces, Georgia, serif",
              fontWeight: 300,
            }}
          >
            {persona.bio}
          </p>
        </div>

        <div className="sw-tray-block">
          <h4>Profile</h4>
          <div className="sw-tray-contact">
            <div className="it">
              <div className="lbl">Tone</div>
              <div className="v">{persona.stats.tone}</div>
            </div>
            <div className="it">
              <div className="lbl">Pace</div>
              <div className="v">{persona.stats.pace}</div>
            </div>
            <div className="it">
              <div className="lbl">Avg length</div>
              <div className="v">{persona.stats.length}</div>
            </div>
            <div className="it">
              <div className="lbl">Tier</div>
              <div className="v">{persona.feature ? "Featured" : "Standard"}</div>
            </div>
          </div>
        </div>

        <div className="sw-tray-block" style={{ borderBottom: "none" }}>
          <h4>Best for</h4>
          <p style={{ margin: 0, fontSize: 13, color: "var(--sw-ink-soft)", lineHeight: 1.55 }}>
            {persona.bestFor}
          </p>
        </div>
      </div>

      <div className="sw-tray-foot">
        <button className="sw-btn primary" style={{ flex: 1, justifyContent: "center" }}>
          Use in campaign
        </button>
        <button className="sw-btn">Edit voice</button>
      </div>
    </>
  );
}

function SalesPersonasPageContent() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { openTray, closeTray, isOpen } = useTray();

  const featured = SW_PERSONAS.filter((p) => p.feature);
  const others = SW_PERSONAS.filter((p) => !p.feature);

  const handleOpen = (id: string) => {
    setSelectedId(id);
    const persona = SW_PERSONAS.find((p) => p.id === id);

    if (persona) {
      const handleClose = () => {
        closeTray();
        setSelectedId(null);
      };

      openTray(<PersonaTrayContent persona={persona} onClose={handleClose} />, () => setSelectedId(null));
    }
  };

  useEffect(() => {
    if (!isOpen && selectedId) setSelectedId(null);
  }, [isOpen, selectedId]);

  return (
    <div className="sw-fade-in">
      <header className="sw-page-header">
        <div>
          <div className="kicker">Workspace</div>
          <h1 className="sw-page-title">Sales personas</h1>
          <p className="sw-page-sub">
            Each persona is a trained voice with a distinct cadence. Select one to preview before assigning it to a campaign.
          </p>
        </div>
        <button className="sw-btn primary">
          <Plus size={14} strokeWidth={1.6} /> New persona
        </button>
      </header>

      {featured.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="sw-pers-section-title">
            <h3>Featured <em>voices</em></h3>
            <span className="meta">{featured.length} personas</span>
          </div>
          <div className="sw-pers-cards">
            {featured.map((p) => (
              <div
                key={p.id}
                className={"sw-pers-row " + ACCENT_MAP[p.accent] + (selectedId === p.id ? " selected" : "")}
                onClick={() => handleOpen(p.id)}
              >
                <div className="sw-pers-row-glyph">{p.name[0]}</div>
                <div>
                  <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22, letterSpacing: "-0.01em", color: "var(--sw-ink)" }}>
                    {p.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "Fraunces, Georgia, serif",
                      fontStyle: "italic",
                      color: "var(--sw-ink-soft)",
                      fontSize: 14,
                      fontWeight: 300,
                      marginTop: 2,
                    }}
                  >
                    {p.style}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--sw-muted)", lineHeight: 1.5 }}>{p.bestFor}</div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      gap: 12,
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--sw-muted)",
                    }}
                  >
                    <span>{p.stats.tone}</span>
                    <span>{p.stats.pace}</span>
                    <span>{p.stats.length}</span>
                  </div>
                </div>
                <div style={{ color: "var(--sw-muted)", opacity: selectedId === p.id ? 1 : 0, transition: "opacity 120ms" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 999, background: "var(--sw-accent)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sw-pers-section-title" style={{ marginTop: 8 }}>
        <h3>All <em>voices</em></h3>
        <span className="meta">{others.length} more</span>
      </div>
      <div className="sw-pers-grid">
        {others.map((p) => (
          <div
            key={p.id}
            className={"sw-pers-card " + ACCENT_MAP[p.accent] + (selectedId === p.id ? " selected" : "")}
            onClick={() => handleOpen(p.id)}
          >
            <div className="sw-pers-card-glyph">{p.name[0]}</div>
            <div>
              <div className="sw-pers-card-name">{p.name}</div>
              <div className="sw-pers-card-style">{p.style}</div>
            </div>
            <div className="sw-pers-card-best">
              <span className="label">Best for</span>
              <span className="val">{p.bestFor}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
