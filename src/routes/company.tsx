import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard, AppShell } from "@/components/AppShell";
import { SW_COMPANY } from "@/lib/workspace-mocks";

export const Route = createFileRoute("/company")({
  component: () => (
    <AuthGuard>
      <CompanyPage />
    </AuthGuard>
  ),
});

function CompanyPage() {
  const co = SW_COMPANY;

  return (
    <AppShell>
      <div className="sw-fade-in">
        <header className="sw-page-header">
          <div>
            <div className="kicker">Workspace</div>
            <h1 className="sw-page-title">Company</h1>
            <p className="sw-page-sub">The context your agents read before every call. Keep it honest and specific.</p>
          </div>
          <button className="sw-btn primary">Save changes</button>
        </header>

        <div className="sw-company-grid">
          <div>
            {/* Identity */}
            <div className="sw-section">
              <h2 className="sw-section-title">Identity</h2>
              <div className="sw-field-row">
                <div className="sw-field">
                  <label className="sw-label">Company name</label>
                  <input className="sw-input" defaultValue={co.name} />
                </div>
                <div className="sw-field">
                  <label className="sw-label">Industry</label>
                  <input className="sw-input" defaultValue={co.industry} />
                </div>
              </div>
              <div className="sw-field">
                <label className="sw-label">Tagline</label>
                <input className="sw-input" defaultValue={co.tagline} />
              </div>
              <div className="sw-field-row">
                <div className="sw-field">
                  <label className="sw-label">Website</label>
                  <input className="sw-input" defaultValue={co.website} />
                </div>
                <div className="sw-field">
                  <label className="sw-label">LinkedIn</label>
                  <input className="sw-input" defaultValue={co.socials.linkedin} />
                </div>
              </div>
            </div>

            {/* Positioning */}
            <div className="sw-section">
              <h2 className="sw-section-title">Positioning</h2>
              <div className="sw-field">
                <label className="sw-label">What we do</label>
                <textarea className="sw-textarea" defaultValue={co.whatWeDo} />
              </div>
              <div className="sw-field">
                <label className="sw-label">Value proposition</label>
                <textarea className="sw-textarea" defaultValue={co.valueProp} />
              </div>
              <div className="sw-field">
                <label className="sw-label">Target customer</label>
                <textarea className="sw-textarea" rows={2} defaultValue={co.targetCustomer} />
              </div>
            </div>

            {/* Pricing */}
            <div className="sw-section">
              <h2 className="sw-section-title">Pricing</h2>
              <div className="sw-pricing">
                {co.pricing.map((tier) => (
                  <div key={tier.tier} className="sw-pricing-tier">
                    <div className="tier-name">{tier.tier}</div>
                    <div className="tier-price">{tier.price}</div>
                    <div className="tier-detail">{tier.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pain points */}
            <div className="sw-section">
              <h2 className="sw-section-title">Pain points we solve</h2>
              <ul className="sw-pain-list">
                {co.painPoints.map((pt, i) => (
                  <li key={i}>
                    <span className="sw-pain-num">{i + 1}.</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sidebar */}
          <div className="sw-company-side">
            <div className="sw-logo">
              <div className="sw-logo-mark" />
            </div>

            <div style={{ fontSize: 13, color: "var(--sw-ink-soft)", lineHeight: 1.6 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>About this page</div>
              <p>The company profile is injected at the start of every agent call. The agent reads it as context before introducing itself.</p>
              <p style={{ marginTop: 10 }}>Keep the pain points honest — agents that mirror real buyer language perform consistently better.</p>
            </div>

            <div style={{ border: "1px solid var(--sw-line)", borderRadius: 10, padding: 16, background: "var(--sw-card)" }}>
              <div className="kicker" style={{ marginBottom: 10 }}>Quick stats</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--sw-muted)" }}>Campaigns using profile</span>
                  <span style={{ fontFamily: "Fraunces, Georgia, serif", color: "var(--sw-ink)" }}>3</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--sw-muted)" }}>Pain points defined</span>
                  <span style={{ fontFamily: "Fraunces, Georgia, serif", color: "var(--sw-ink)" }}>{co.painPoints.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--sw-muted)" }}>Pricing tiers</span>
                  <span style={{ fontFamily: "Fraunces, Georgia, serif", color: "var(--sw-ink)" }}>{co.pricing.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--sw-muted)" }}>Last updated</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--sw-muted)" }}>Apr 26</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
