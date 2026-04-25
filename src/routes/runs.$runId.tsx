import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/runs/$runId")({
  component: () => <AuthGuard><RunDetail /></AuthGuard>,
});

type Run = {
  id: string; status: string; transcript: string | null;
  error: string | null; started_at: string; completed_at: string | null;
};

function RunDetail() {
  const { runId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = () => supabase.from("runs").select("*").eq("id", runId).maybeSingle().then(({ data }) => {
      if (data) setRun(data as Run);
    });
    load();
    const channel = supabase.channel(`run-${runId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "runs", filter: `id=eq.${runId}` }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [runId, user]);

  const deleteRun = async () => {
    if (!confirm("Delete this conversation transcript? This cannot be undone.")) return;
    const { error } = await supabase.from("runs").delete().eq("id", runId);
    if (error) { toast.error(error.message); return; }
    toast.success("Conversation deleted");
    navigate({ to: "/dashboard" });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate({ to: "/dashboard" })} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {run && (
            <button
              onClick={deleteRun}
              className="flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
        {!run ? <div className="mt-12 text-sm text-muted-foreground">Loading…</div> : (
          <div className="mt-6 space-y-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Conversation</p>
              <h1 className="mt-2 font-display text-3xl">{new Date(run.started_at).toLocaleString()}</h1>
              <div className="mt-3 flex gap-3 text-sm text-muted-foreground">
                <span>Status: <span className="text-foreground">{run.status}</span></span>
              </div>
            </div>
            {run.error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{run.error}</div>}
            {run.transcript && (
              <div className="rounded-xl border border-border/60 bg-card/60 p-6">
                <h2 className="font-display text-lg">Transcript</h2>
                <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed">{run.transcript}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
