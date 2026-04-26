import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Megaphone, Phone, Users, UserPlus, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: () => <AuthGuard><Dashboard /></AuthGuard>,
});

type Lead = { id: string; status: string; created_at: string };
type LiveRun = {
  id: string;
  status: string;
  started_at: string;
  campaign_id: string | null;
  lead_id: string | null;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [liveRun, setLiveRun] = useState<LiveRun | null>(null);
  const [liveCampaign, setLiveCampaign] = useState<string>("");
  const [livePersona, setLivePersona] = useState<string>("");
  const [liveLead, setLiveLead] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [profileRes, leadsRes, runRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase.from("leads").select("id,status,created_at").order("created_at", { ascending: false }),
        supabase.from("runs").select("id,status,started_at,campaign_id,lead_id").eq("status", "active").order("started_at", { ascending: false }).limit(1),
      ]);
      if (cancelled) return;
      setDisplayName(profileRes.data?.display_name ?? user.email?.split("@")[0] ?? "");
      setLeads(leadsRes.data ?? []);
      setLiveRun(runRes.data?.[0] ?? null);
      setLoading(false);
    })();

    const ch = supabase
      .channel("dash-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, async () => {
        const { data } = await supabase
          .from("runs").select("id,status,started_at,campaign_id,lead_id")
          .eq("status", "active").order("started_at", { ascending: false }).limit(1);
        setLiveRun(data?.[0] ?? null);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, async () => {
        const { data } = await supabase.from("leads").select("id,status,created_at").order("created_at", { ascending: false });
        if (data) setLeads(data);
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  // Resolve campaign + persona + lead labels for the live card
  useEffect(() => {
    if (!liveRun) { setLiveCampaign(""); setLivePersona(""); setLiveLead(""); return; }
    (async () => {
      const [c, l] = await Promise.all([
        liveRun.campaign_id
          ? supabase.from("campaigns").select("name,persona_id").eq("id", liveRun.campaign_id).maybeSingle()
          : Promise.resolve({ data: null } as const),
        liveRun.lead_id
          ? supabase.from("leads").select("name,company").eq("id", liveRun.lead_id).maybeSingle()
          : Promise.resolve({ data: null } as const),
      ]);
      setLiveCampaign(c.data?.name ?? "");
      setLiveLead(l.data ? `${l.data.name}${l.data.company ? ` · ${l.data.company}` : ""}` : "");
      if (c.data?.persona_id) {
        const { data: p } = await supabase.from("sales_personas").select("name").eq("id", c.data.persona_id).maybeSingle();
        setLivePersona(p?.name ?? "");
      } else {
        setLivePersona("");
      }
    })();
  }, [liveRun]);

  const stats = useMemo(() => {
    const total = leads.length;
    const now = Date.now();
    const newThisWeek = leads.filter((l) => now - new Date(l.created_at).getTime() < 7 * 864e5).length;
    const contacted = leads.filter((l) => ["contacted", "qualified", "won"].includes(l.status)).length;
    const won = leads.filter((l) => l.status === "won").length;
    return { total, newThisWeek, contacted, won };
  }, [leads]);

  const cards: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
    { label: "Total leads", value: stats.total, icon: Users, tone: "text-foreground" },
    { label: "New this week", value: stats.newThisWeek, icon: UserPlus, tone: "text-accent" },
    { label: "Contacted", value: stats.contacted, icon: Phone, tone: "text-foreground" },
    { label: "Won", value: stats.won, icon: CheckCircle2, tone: "text-accent" },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Today</p>
          <h1 className="mt-2 font-display text-4xl text-foreground">
            {greeting()}{displayName ? `, ${displayName}` : ""}.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Three calls scheduled. One conversation in flight.</p>
        </div>

        {/* Stat cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(loading ? Array.from({ length: 4 }).map((_, i) => ({ label: "", value: 0, icon: Users, tone: "", _k: i })) : cards).map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={i} className="rounded-xl border border-border/60 bg-card/60 p-5" style={{ boxShadow: "var(--shadow-zen)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{c.label || "—"}</span>
                  <Icon className={`h-3.5 w-3.5 opacity-60 ${c.tone}`} />
                </div>
                <div className="mt-4 font-display text-3xl tabular-nums text-foreground">{loading ? "—" : c.value}</div>
              </div>
            );
          })}
        </div>

        {/* Now dialing */}
        <div className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-foreground">Now dialing</h2>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Live</span>
          </div>
          <div className="mt-4">
            {liveRun ? (
              <button
                onClick={() => navigate({ to: "/conversations/$runId", params: { runId: liveRun.id } })}
                className="group flex w-full items-center justify-between rounded-xl border border-accent/30 bg-accent/5 p-6 text-left transition-all hover:border-accent/60"
                style={{ boxShadow: "var(--shadow-zen)" }}
              >
                <div className="flex items-center gap-4">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
                  </span>
                  <div>
                    <div className="font-display text-lg text-foreground">{liveLead || "Active conversation"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {liveCampaign && <span>Campaign · {liveCampaign}</span>}
                      {livePersona && <><span className="opacity-40">·</span><span>Voice · {livePersona}</span></>}
                      <span className="opacity-40">·</span>
                      <span><Clock className="mr-1 inline h-3 w-3" />{new Date(liveRun.started_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">Listen in →</span>
              </button>
            ) : (
              <Link
                to="/campaigns"
                className="flex w-full items-center justify-between rounded-xl border border-dashed border-border/60 bg-card/30 p-6 transition-colors hover:border-accent/50 hover:bg-card/50"
              >
                <div className="flex items-center gap-4">
                  <Megaphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-display text-lg text-foreground">Nothing on the line.</div>
                    <p className="mt-1 text-xs text-muted-foreground">Launch a campaign to put a persona on the phone.</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-md">Open campaigns</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
