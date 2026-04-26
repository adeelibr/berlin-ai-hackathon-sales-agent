import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { ArrowLeft, Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { generateReport } from "@/lib/gradium.functions";
import { authHeaders } from "@/lib/server-fn-auth";

export const Route = createFileRoute("/runs/$runId")({
  component: () => <AuthGuard><RunDetail /></AuthGuard>,
});

type SalesReport = {
  summary: string;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  intent_score: number;
  stage: string;
  key_topics: string[];
  pain_points: string[];
  objections: string[];
  opportunities: string[];
  next_steps: string[];
  risk_flags: string[];
  quotable_moments: { quote: string; why_it_matters: string }[];
};

type Run = {
  id: string; status: string; transcript: string | null;
  error: string | null; started_at: string; completed_at: string | null;
  report: SalesReport | null; report_generated_at: string | null;
};

function RunDetail() {
  const { runId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [generating, setGenerating] = useState(false);
  const generateFn = useServerFn(generateReport);

  useEffect(() => {
    if (!user) return;
    const load = () => supabase.from("runs").select("*").eq("id", runId).maybeSingle().then(({ data }) => {
      if (data) setRun(data as unknown as Run);
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

  const buildReport = async () => {
    if (!run?.transcript?.trim()) { toast.error("No transcript to analyze"); return; }
    setGenerating(true);
    try {
      const { reportJson } = await generateFn({
        data: { transcript: run.transcript },
        headers: await authHeaders(),
      });
      const report = JSON.parse(reportJson) as SalesReport;
      const { error } = await supabase
        .from("runs")
        .update({ report: report as unknown as never, report_generated_at: new Date().toISOString() })
        .eq("id", runId);
      if (error) throw new Error(error.message);
      toast.success("Report generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
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
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg">Sales report</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {run.report_generated_at
                        ? `Generated ${new Date(run.report_generated_at).toLocaleString()}`
                        : "AI-generated structured analysis for the sales head."}
                    </p>
                  </div>
                  <Button onClick={buildReport} disabled={generating} size="sm" variant={run.report ? "outline" : "default"}>
                    {generating
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…</>
                      : <><Sparkles className="h-3.5 w-3.5" /> {run.report ? "Regenerate" : "Generate report"}</>}
                  </Button>
                </div>
                {run.report && <ReportView report={run.report} />}
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

function ReportView({ report }: { report: SalesReport }) {
  const sentimentColor: Record<string, string> = {
    positive: "text-accent",
    neutral: "text-muted-foreground",
    negative: "text-destructive",
    mixed: "text-foreground",
  };
  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm leading-relaxed">{report.summary}</p>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Sentiment" value={report.sentiment} valueClass={sentimentColor[report.sentiment]} />
        <Stat label="Intent" value={`${report.intent_score}/10`} />
        <Stat label="Stage" value={report.stage.replace(/_/g, " ")} />
      </div>

      <Section title="Key topics" items={report.key_topics} />
      <Section title="Pain points" items={report.pain_points} />
      <Section title="Opportunities" items={report.opportunities} />
      <Section title="Objections" items={report.objections} />
      <Section title="Next steps" items={report.next_steps} />
      <Section title="Risk flags" items={report.risk_flags} tone="destructive" />

      {report.quotable_moments?.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Quotable moments</h3>
          <div className="mt-3 space-y-3">
            {report.quotable_moments.map((q, i) => (
              <blockquote key={i} className="border-l-2 border-accent/40 pl-4">
                <p className="text-sm italic">"{q.quote}"</p>
                <p className="mt-1 text-xs text-muted-foreground">{q.why_it_matters}</p>
              </blockquote>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-medium capitalize ${valueClass ?? ""}`}>{value}</div>
    </div>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone?: "destructive" }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={i} className={`flex gap-2 ${tone === "destructive" ? "text-destructive" : ""}`}>
            <span className="text-muted-foreground">•</span>
            <span className="flex-1">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
