import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock3, Plus, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";

import { AppShell, AuthGuard } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/flows")({
  component: () => (
    <AuthGuard>
      <FlowsPage />
    </AuthGuard>
  ),
});

type Flow = {
  id: string;
  name: string;
  updated_at: string;
};

function FlowsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("flows")
        .select("id,name,updated_at")
        .order("updated_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        toast.error(error.message);
      } else {
        setFlows(data ?? []);
      }
      setLoading(false);
    })();

    const channel = supabase
      .channel("flows-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "flows" }, async () => {
        const { data } = await supabase
          .from("flows")
          .select("id,name,updated_at")
          .order("updated_at", { ascending: false });
        setFlows(data ?? []);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const createFlow = async () => {
    const { data, error } = await supabase
      .from("flows")
      .insert({ user_id: user!.id, name: "Untitled flow" })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    navigate({ to: "/flows/$flowId", params: { flowId: data.id } });
  };

  const deleteFlow = async (flowId: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its conversations? This cannot be undone.`)) return;

    await supabase.from("runs").delete().eq("flow_id", flowId);
    const { error } = await supabase.from("flows").delete().eq("id", flowId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setFlows((current) => current.filter((flow) => flow.id !== flowId));
    toast.success("Flow deleted");
  };

  return (
    <AppShell>
      <div className="sw-fade-in">
        <header className="sw-page-header">
          <div>
            <div className="kicker">Operate</div>
            <h1 className="sw-page-title">Flows</h1>
            <p className="sw-page-sub">Compose a call from three quiet nodes: who we are, the agent, and the dial. Each flow is a reusable script.</p>
          </div>
          <button className="sw-btn primary" onClick={createFlow}>
            <Plus size={14} strokeWidth={1.6} /> New flow
          </button>
        </header>

        {loading ? (
          <div style={{ fontSize: 13, color: "var(--sw-muted)" }}>Loading…</div>
        ) : flows.length === 0 ? (
          <div className="sw-empty">
            <Workflow size={32} style={{ color: "var(--sw-muted)", margin: "0 auto 16px" }} />
            <h3>Create your first flow</h3>
            <p style={{ marginBottom: 20 }}>Three quiet nodes. One live conversation.</p>
            <button className="sw-btn" onClick={createFlow}>New flow</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {flows.map((flow) => (
              <div
                key={flow.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 16,
                  padding: "20px 24px",
                  border: "1px solid var(--sw-line)",
                  borderRadius: 12,
                  background: "var(--sw-card)",
                  alignItems: "center",
                }}
              >
                <div>
                  <div className="kicker" style={{ marginBottom: 6 }}>Flow</div>
                  <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22, color: "var(--sw-ink)", letterSpacing: "-0.01em" }}>{flow.name}</div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--sw-muted)", fontFamily: "ui-monospace, monospace" }}>
                    <Clock3 size={10} style={{ display: "inline", marginRight: 4 }} />
                    Updated {new Date(flow.updated_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link to="/flows/$flowId" params={{ flowId: flow.id }}>
                      Open builder
                    </Link>
                  </Button>
                  <button
                    type="button"
                    aria-label={`Delete ${flow.name}`}
                    onClick={() => deleteFlow(flow.id, flow.name)}
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
