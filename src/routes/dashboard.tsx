import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Workflow, Phone, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  ),
});

type Flow = {
  id: string;
  name: string;
  updated_at: string;
  phone_numbers: string;
};

type Run = {
  id: string;
  flow_id: string;
  phone_number: string;
  status: string;
  started_at: string;
  duration_seconds: number | null;
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-node-idle text-muted-foreground",
  running: "bg-node-running text-foreground zen-pulse",
  completed: "bg-node-done text-accent-foreground",
  failed: "bg-node-error text-destructive-foreground",
  "no-answer": "bg-node-idle text-muted-foreground",
};

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [flowsRes, runsRes] = await Promise.all([
        supabase.from("flows").select("id,name,updated_at,phone_numbers").order("updated_at", { ascending: false }),
        supabase.from("runs").select("id,flow_id,phone_number,status,started_at,duration_seconds").order("started_at", { ascending: false }).limit(10),
      ]);
      if (cancelled) return;
      if (flowsRes.error) toast.error(flowsRes.error.message);
      if (runsRes.error) toast.error(runsRes.error.message);
      setFlows(flowsRes.data ?? []);
      setRuns(runsRes.data ?? []);
      setLoading(false);
    })();

    // realtime updates for runs
    const channel = supabase
      .channel("dashboard-runs")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => {
        supabase.from("runs").select("id,flow_id,phone_number,status,started_at,duration_seconds").order("started_at", { ascending: false }).limit(10).then(({ data }) => {
          if (data) setRuns(data);
        });
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

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your space</p>
            <h1 className="mt-2 font-display text-4xl text-foreground">Flows</h1>
          </div>
          <Button onClick={createFlow} className="rounded-md">
            <Plus className="h-4 w-4" /> New flow
          </Button>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full text-sm text-muted-foreground">Loading…</div>
          ) : flows.length === 0 ? (
            <button
              onClick={createFlow}
              className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 p-16 text-center transition-colors hover:border-accent/50 hover:bg-card/50"
            >
              <Workflow className="h-8 w-8 text-muted-foreground" />
              <p className="mt-4 font-display text-lg">Create your first flow</p>
              <p className="mt-1 text-sm text-muted-foreground">Five quiet nodes. One outbound call.</p>
            </button>
          ) : (
            flows.map((flow) => {
              const numCount = flow.phone_numbers.split(",").map((s) => s.trim()).filter(Boolean).length;
              return (
                <Link
                  key={flow.id}
                  to="/flows/$flowId"
                  params={{ flowId: flow.id }}
                  className="group rounded-xl border border-border/60 bg-card/60 p-6 transition-all hover:border-accent/40"
                  style={{ boxShadow: "var(--shadow-zen)" }}
                >
                  <div className="flex items-start justify-between">
                    <Workflow className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-accent" />
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {new Date(flow.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="mt-6 font-display text-lg text-foreground">{flow.name}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <Phone className="mr-1 inline h-3 w-3" />
                    {numCount} {numCount === 1 ? "number" : "numbers"}
                  </p>
                </Link>
              );
            })
          )}
        </div>

        {/* recent runs */}
        <div className="mt-20">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-foreground">Recent calls</h2>
            <span className="text-xs text-muted-foreground">last 10</span>
          </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-card/40">
            {runs.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">No calls yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-6 py-3 font-normal">Number</th>
                    <th className="px-6 py-3 font-normal">Status</th>
                    <th className="px-6 py-3 font-normal">Duration</th>
                    <th className="px-6 py-3 font-normal">When</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate({ to: "/runs/$runId", params: { runId: r.id } })}
                      className="cursor-pointer border-b border-border/30 last:border-0 transition-colors hover:bg-muted/40"
                    >
                      <td className="px-6 py-4 font-mono text-xs">{r.phone_number}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_COLOR[r.status] ?? "bg-muted text-muted-foreground"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {r.duration_seconds ? `${r.duration_seconds}s` : "—"}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <Clock className="mr-1 inline h-3 w-3" />
                        {new Date(r.started_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
