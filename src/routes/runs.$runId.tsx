import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/runs/$runId")({
  component: () => <AuthGuard><RunDetail /></AuthGuard>,
});

type Run = {
  id: string; phone_number: string; status: string; generated_script: string | null;
  transcript: string | null; recording_url: string | null; cleaned_recording_url: string | null;
  duration_seconds: number | null; error: string | null; started_at: string; completed_at: string | null;
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

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <button onClick={() => navigate({ to: "/dashboard" })} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {!run ? <div className="mt-12 text-sm text-muted-foreground">Loading…</div> : (
          <div className="mt-6 space-y-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Call</p>
              <h1 className="mt-2 font-mono text-3xl">{run.phone_number}</h1>
              <div className="mt-3 flex gap-3 text-sm text-muted-foreground">
                <span>Status: <span className="text-foreground">{run.status}</span></span>
                {run.duration_seconds && <span>Duration: <span className="text-foreground">{run.duration_seconds}s</span></span>}
              </div>
            </div>
            {run.error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{run.error}</div>}
            {run.cleaned_recording_url && (
              <div className="rounded-xl border border-border/60 bg-card/60 p-6">
                <h2 className="font-display text-lg">Recording (cleaned)</h2>
                <audio controls src={run.cleaned_recording_url} className="mt-4 w-full" />
              </div>
            )}
            {run.generated_script && (
              <div className="rounded-xl border border-border/60 bg-card/60 p-6">
                <h2 className="font-display text-lg">Generated script</h2>
                <pre className="mt-4 whitespace-pre-wrap font-mono text-xs text-muted-foreground">{run.generated_script}</pre>
              </div>
            )}
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
