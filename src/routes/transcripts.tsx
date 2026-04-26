import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Search, FileText, Sparkles } from "lucide-react";

export const Route = createFileRoute("/transcripts")({
  component: () => (
    <AuthGuard>
      <TranscriptsPage />
    </AuthGuard>
  ),
});

type Run = {
  id: string;
  status: string;
  transcript: string | null;
  started_at: string;
  completed_at: string | null;
  campaign_id: string | null;
  lead_id: string | null;
  report_generated_at: string | null;
};

type Campaign = { id: string; name: string };
type Lead = { id: string; name: string; company: string };

type Filter = "all" | "with_report" | "without_report";

function statusPillClass(s: string) {
  if (s === "completed") return "bg-node-done/40 text-foreground";
  if (s === "active" || s === "running") return "bg-node-running/40 text-foreground";
  if (s === "error") return "bg-destructive/30 text-destructive";
  return "bg-muted text-muted-foreground";
}

function snippet(transcript: string | null) {
  if (!transcript) return "";
  const text = transcript.replace(/\s+/g, " ").trim();
  return text.length > 140 ? text.slice(0, 140) + "…" : text;
}

function turnCount(transcript: string | null) {
  if (!transcript) return 0;
  return transcript.split("\n").filter((l) => l.trim().length > 0).length;
}

function TranscriptsPage() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [campaigns, setCampaigns] = useState<Record<string, Campaign>>({});
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const [r, c, l] = await Promise.all([
        supabase
          .from("runs")
          .select("id,status,transcript,started_at,completed_at,campaign_id,lead_id,report_generated_at")
          .order("started_at", { ascending: false }),
        supabase.from("campaigns").select("id,name"),
        supabase.from("leads").select("id,name,company"),
      ]);
      if (cancelled) return;
      setRuns(((r.data ?? []) as Run[]).filter((x) => x.transcript && x.transcript.trim().length > 0));
      const cMap: Record<string, Campaign> = {};
      for (const row of (c.data ?? []) as Campaign[]) cMap[row.id] = row;
      setCampaigns(cMap);
      const lMap: Record<string, Lead> = {};
      for (const row of (l.data ?? []) as Lead[]) lMap[row.id] = row;
      setLeads(lMap);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("transcripts-runs")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  const counts = useMemo(
    () => ({
      all: runs.length,
      with_report: runs.filter((r) => !!r.report_generated_at).length,
      without_report: runs.filter((r) => !r.report_generated_at).length,
    }),
    [runs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs.filter((r) => {
      if (filter === "with_report" && !r.report_generated_at) return false;
      if (filter === "without_report" && r.report_generated_at) return false;
      if (!q) return true;
      const camp = r.campaign_id ? campaigns[r.campaign_id]?.name ?? "" : "";
      const lead = r.lead_id ? leads[r.lead_id] : undefined;
      const haystack = [
        r.transcript ?? "",
        camp,
        lead?.name ?? "",
        lead?.company ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [runs, query, filter, campaigns, leads]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Workspace</p>
            <h1 className="mt-2 font-display text-4xl">Transcripts</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Every conversation your agents have had. Open one to see the full transcript and the AI report.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transcripts, leads, campaigns…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "all", label: "All" },
                { key: "with_report", label: "With report" },
                { key: "without_report", label: "No report yet" },
              ] as { key: Filter; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  filter === f.key
                    ? "border-accent/60 bg-accent/15 text-foreground"
                    : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label} <span className="opacity-60">{counts[f.key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-card/40">
          {loading ? (
            <div className="px-6 py-12 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <FileText className="mx-auto h-6 w-6 text-muted-foreground/60" />
              <p className="mt-3 font-display text-lg">
                {runs.length === 0 ? "No transcripts yet." : "Nothing matches that filter."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {runs.length === 0
                  ? "Run a campaign — the conversation will land here."
                  : "Try a different search or filter."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-6 py-3 font-normal w-12">#</th>
                  <th className="px-6 py-3 font-normal">When</th>
                  <th className="px-6 py-3 font-normal">Lead</th>
                  <th className="px-6 py-3 font-normal">Campaign</th>
                  <th className="px-6 py-3 font-normal">Preview</th>
                  <th className="px-6 py-3 font-normal">Turns</th>
                  <th className="px-6 py-3 font-normal">Report</th>
                  <th className="px-6 py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const lead = r.lead_id ? leads[r.lead_id] : undefined;
                  const camp = r.campaign_id ? campaigns[r.campaign_id] : undefined;
                  return (
                    <tr
                      key={r.id}
                      className="group cursor-pointer border-b border-border/30 last:border-0 transition-colors hover:bg-muted/40"
                    >
                      <td className="px-6 py-4 align-top font-mono text-xs text-muted-foreground">
                        <Link
                          to="/runs/$runId"
                          params={{ runId: r.id }}
                          className="block"
                        >
                          {String(i + 1).padStart(2, "0")}
                        </Link>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <Link to="/runs/$runId" params={{ runId: r.id }} className="block">
                          <div className="text-foreground">
                            {new Date(r.started_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(r.started_at).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <Link to="/runs/$runId" params={{ runId: r.id }} className="block">
                          <div className="text-foreground">
                            {lead?.name || <span className="text-muted-foreground">—</span>}
                          </div>
                          {lead?.company && (
                            <div className="text-xs text-muted-foreground">{lead.company}</div>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4 align-top text-muted-foreground">
                        <Link to="/runs/$runId" params={{ runId: r.id }} className="block">
                          {camp?.name || "—"}
                        </Link>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <Link to="/runs/$runId" params={{ runId: r.id }} className="block">
                          <p className="line-clamp-2 max-w-md text-xs text-muted-foreground">
                            {snippet(r.transcript)}
                          </p>
                        </Link>
                      </td>
                      <td className="px-6 py-4 align-top font-mono text-xs text-muted-foreground">
                        <Link to="/runs/$runId" params={{ runId: r.id }} className="block">
                          {turnCount(r.transcript)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <Link to="/runs/$runId" params={{ runId: r.id }} className="block">
                          {r.report_generated_at ? (
                            <span className="inline-flex items-center gap-1 text-xs text-accent">
                              <Sparkles className="h-3 w-3" /> Ready
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <Link to="/runs/$runId" params={{ runId: r.id }} className="block">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${statusPillClass(
                              r.status,
                            )}`}
                          >
                            {r.status}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}