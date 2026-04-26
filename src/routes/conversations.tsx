import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock3, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell, AuthGuard } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/conversations")({
  component: () => (
    <AuthGuard>
      <ConversationsPage />
    </AuthGuard>
  ),
});

type RunRow = {
  id: string;
  status: string;
  started_at: string;
  flow_id: string;
  flowName: string;
};

const STATUS_DOT: Record<string, string> = {
  active:      "var(--sw-accent)",
  dialing:     "var(--sw-accent)",
  in_progress: "var(--sw-accent)",
  completed:   "var(--sw-accent)",
  failed:      "oklch(0.55 0.18 27)",
  busy:        "oklch(0.55 0.18 27)",
  no_answer:   "var(--sw-muted)",
  canceled:    "var(--sw-muted)",
};

function ConversationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadRuns = async () => {
      const { data, error } = await supabase
        .from("runs")
        .select("id,status,started_at,flow_id,flows(name)")
        .order("started_at", { ascending: false })
        .limit(40);

      if (error) {
        toast.error(error.message);
      } else {
        setRuns(
          (data ?? []).map((row) => ({
            id: row.id,
            status: row.status,
            started_at: row.started_at,
            flow_id: row.flow_id,
            flowName:
              typeof row.flows === "object" && row.flows && "name" in row.flows
                ? String(row.flows.name)
                : "Untitled flow",
          })),
        );
      }
      setLoading(false);
    };

    loadRuns();

    const channel = supabase
      .channel("conversations-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, loadRuns)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const deleteRun = async (runId: string) => {
    if (!confirm("Delete this conversation transcript?")) return;

    const { error } = await supabase.from("runs").delete().eq("id", runId);
    if (error) {
      toast.error(error.message);
      return;
    }

    setRuns((current) => current.filter((run) => run.id !== runId));
    toast.success("Conversation deleted");
  };

  return (
    <AppShell>
      <div className="sw-fade-in">
        <header className="sw-page-header">
          <div>
            <div className="kicker">Operate</div>
            <h1 className="sw-page-title">Conversations</h1>
            <p className="sw-page-sub">Every call leaves a transcript. Review what the agent said before the prospect did.</p>
          </div>
        </header>

        {loading ? (
          <div style={{ fontSize: 13, color: "var(--sw-muted)" }}>Loading…</div>
        ) : runs.length === 0 ? (
          <div className="sw-empty">
            <h3>No conversations yet</h3>
            <p>Start a flow and the transcripts will appear here.</p>
          </div>
        ) : (
          <div style={{ borderTop: "1px solid var(--sw-line-soft)" }}>
            {runs.map((run) => (
              <div
                key={run.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr 120px 1fr auto",
                  gap: 16,
                  alignItems: "center",
                  padding: "18px 8px",
                  borderBottom: "1px solid var(--sw-line-soft)",
                  cursor: "pointer",
                  transition: "background 120ms ease",
                }}
                onClick={() => navigate({ to: "/runs/$runId", params: { runId: run.id } })}
                onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.background = "oklch(0.985 0.004 80)"; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                <div>
                  <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 16, color: "var(--sw-ink)" }}>{run.flowName}</div>
                  <div style={{ fontSize: 11, color: "var(--sw-muted)", marginTop: 2 }}>{run.flow_id.slice(0, 8)}</div>
                </div>

                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--sw-muted)" }}>
                  {run.id.slice(0, 8)}
                </div>

                <div>
                  <span className="sw-state">
                    <span className="dot" style={{ background: STATUS_DOT[run.status] ?? "var(--sw-muted)" }} />
                    {run.status}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: "var(--sw-muted)" }}>
                  <Clock3 size={11} style={{ display: "inline", marginRight: 4 }} />
                  {new Date(run.started_at).toLocaleString()}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link to="/runs/$runId" params={{ runId: run.id }}>
                      Open
                    </Link>
                  </Button>
                  <button
                    type="button"
                    aria-label={`Delete ${run.id}`}
                    onClick={(e) => { e.stopPropagation(); deleteRun(run.id); }}
                    style={{ padding: 8, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "var(--sw-muted)" }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.55 0.18 27)"; (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.55 0.18 27 / 0.1)"; }}
                    onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--sw-muted)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
