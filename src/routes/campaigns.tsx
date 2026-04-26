import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Mic, Trash2, X, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/campaigns")({
  component: () => <AuthGuard><CampaignsPage /></AuthGuard>,
});

type Campaign = {
  id: string; name: string; persona_id: string | null;
  brief: string; talking_points: string[];
  status: "draft" | "running" | "paused"; updated_at: string;
  company_name: string; company_tagline: string; company_industry: string;
  company_website: string; company_linkedin: string; company_twitter: string;
  company_what_we_do: string; company_value_prop: string; company_target_customer: string;
  company_logo_url: string | null;
};
type Persona = { id: string; name: string; tagline: string; avatar_color: string };
type Lead = { id: string; name: string; company: string; phone: string; status: string };
type CampaignLead = { id: string; lead_id: string };

const COLOR: Record<string, string> = {
  sage: "bg-accent/30 text-accent-foreground",
  stone: "bg-muted text-foreground",
  rose: "bg-node-error/30 text-foreground",
};

function CampaignsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaignLeads, setCampaignLeads] = useState<Record<string, CampaignLead[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [c, p, l, cl] = await Promise.all([
      supabase.from("campaigns").select("*").order("updated_at", { ascending: false }),
      supabase.from("sales_personas").select("id,name,tagline,avatar_color").order("sort_order"),
      supabase.from("leads").select("id,name,company,phone,status"),
      supabase.from("campaign_leads").select("id,campaign_id,lead_id"),
    ]);
    setCampaigns((c.data ?? []) as Campaign[]);
    setPersonas((p.data ?? []) as Persona[]);
    setLeads((l.data ?? []) as Lead[]);
    const grouped: Record<string, CampaignLead[]> = {};
    for (const row of (cl.data ?? []) as { id: string; campaign_id: string; lead_id: string }[]) {
      grouped[row.campaign_id] ??= [];
      grouped[row.campaign_id].push({ id: row.id, lead_id: row.lead_id });
    }
    setCampaignLeads(grouped);
    if (!selectedId && c.data && c.data.length > 0) setSelectedId(c.data[0].id);
    setLoading(false);
  };

  useEffect(() => { if (user) refresh(); }, [user]);

  const createCampaign = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("campaigns")
      .insert({ user_id: user.id, name: "New campaign" })
      .select("*").single();
    if (error || !data) { toast.error(error?.message ?? "Failed"); return; }
    setCampaigns((prev) => [data as Campaign, ...prev]);
    setSelectedId(data.id);
  };

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-8 py-12">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Workspace</p>
            <h1 className="mt-2 font-display text-4xl">Campaigns</h1>
            <p className="mt-2 text-sm text-muted-foreground">A persona, a list, a brief. Then talk.</p>
          </div>
          <Button onClick={createCampaign} className="rounded-md"><Plus className="h-4 w-4" /> New campaign</Button>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-1">
            <p className="px-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">All campaigns</p>
            {loading ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">Loading…</p>
            ) : campaigns.length === 0 ? (
              <button onClick={createCampaign} className="mt-3 w-full rounded-xl border border-dashed border-border/60 bg-card/30 p-6 text-center text-sm text-muted-foreground hover:border-accent/40">
                Create your first campaign
              </button>
            ) : campaigns.map((c) => {
              const persona = personas.find((p) => p.id === c.persona_id);
              const leadCount = campaignLeads[c.id]?.length ?? 0;
              const isActive = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`block w-full rounded-lg px-3 py-3 text-left transition-colors ${
                    isActive ? "bg-muted/70" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-base">{c.name}</span>
                    <StatusDot status={c.status} />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {leadCount} {leadCount === 1 ? "lead" : "leads"} · {persona?.name ?? "No voice"}
                  </div>
                </button>
              );
            })}
          </aside>

          <section className="rounded-xl border border-border/60 bg-card/40 p-8" style={{ boxShadow: "var(--shadow-zen)" }}>
            {selected ? (
              <CampaignEditor
                key={selected.id}
                campaign={selected}
                personas={personas}
                leads={leads}
                attachedLeadIds={(campaignLeads[selected.id] ?? []).map((cl) => cl.lead_id)}
                onChange={(updated) => setCampaigns((prev) => prev.map((c) => c.id === updated.id ? updated : c))}
                onDelete={async () => {
                  if (!confirm("Delete this campaign?")) return;
                  await supabase.from("campaign_leads").delete().eq("campaign_id", selected.id);
                  await supabase.from("campaigns").delete().eq("id", selected.id);
                  setSelectedId(null);
                  refresh();
                }}
                onLeadsChanged={refresh}
                onLaunch={async () => {
                  if (!user) return;
                  if (!selected.persona_id) { toast.error("Pick a persona first"); return; }
                  // Find first available lead
                  const attachedIds = (campaignLeads[selected.id] ?? []).map((cl) => cl.lead_id);
                  const firstLead = leads.find((l) => attachedIds.includes(l.id));
                  // Create a placeholder flow row (legacy required FK) — we synthesize one named after the campaign
                  const { data: flow } = await supabase.from("flows").insert({
                    user_id: user.id, name: `${selected.name} (campaign)`,
                  }).select("id").single();
                  if (!flow) { toast.error("Could not start"); return; }
                  const { data: run, error } = await supabase.from("runs").insert({
                    user_id: user.id, flow_id: flow.id, campaign_id: selected.id,
                    lead_id: firstLead?.id ?? null, status: "active",
                  }).select("id").single();
                  if (error || !run) { toast.error(error?.message ?? "Failed"); return; }
                  await supabase.from("campaigns").update({ status: "running" }).eq("id", selected.id);
                  navigate({ to: "/conversations/$runId", params: { runId: run.id } });
                }}
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Select or create a campaign on the left.
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls = status === "running" ? "bg-accent zen-pulse" : status === "paused" ? "bg-node-error" : "bg-muted-foreground/50";
  const label = status === "running" ? "Running" : status === "paused" ? "Paused" : "Draft";
  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} /> {label}
    </span>
  );
}

function CampaignEditor({
  campaign, personas, leads, attachedLeadIds, onChange, onDelete, onLeadsChanged, onLaunch,
}: {
  campaign: Campaign;
  personas: Persona[];
  leads: Lead[];
  attachedLeadIds: string[];
  onChange: (c: Campaign) => void;
  onDelete: () => void;
  onLeadsChanged: () => void;
  onLaunch: () => void;
}) {
  const [draft, setDraft] = useState(campaign);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const persona = personas.find((p) => p.id === draft.persona_id);

  useEffect(() => setDraft(campaign), [campaign.id]);

  const persist = async (patch: Partial<Campaign>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    const { error } = await supabase.from("campaigns").update({
      name: next.name, persona_id: next.persona_id, brief: next.brief,
      talking_points: next.talking_points, status: next.status,
    }).eq("id", campaign.id);
    if (error) { toast.error(error.message); return; }
    setSavedAt(new Date());
    onChange(next);
  };

  const attached = useMemo(() => leads.filter((l) => attachedLeadIds.includes(l.id)), [leads, attachedLeadIds]);
  const available = useMemo(() => leads.filter((l) => !attachedLeadIds.includes(l.id)), [leads, attachedLeadIds]);

  const attachLead = async (leadId: string) => {
    const { error } = await supabase.from("campaign_leads").insert({
      campaign_id: campaign.id, lead_id: leadId,
      user_id: (await supabase.auth.getUser()).data.user!.id,
    });
    if (error) { toast.error(error.message); return; }
    onLeadsChanged();
  };
  const detachLead = async (leadId: string) => {
    await supabase.from("campaign_leads").delete().eq("campaign_id", campaign.id).eq("lead_id", leadId);
    onLeadsChanged();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onBlur={() => persist({})}
            className="border-0 bg-transparent px-0 font-display !text-3xl shadow-none focus-visible:ring-0"
          />
          <div className="mt-2 flex items-center gap-3">
            <StatusDot status={draft.status} />
            {savedAt && <span className="text-xs text-muted-foreground">· Saved</span>}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>

      {/* Persona */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Voice</p>
        <div className="mt-3 flex items-center gap-4 rounded-xl border border-border/60 bg-background/40 p-4">
          {persona ? (
            <>
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${COLOR[persona.avatar_color] ?? COLOR.sage} font-display`}>
                {persona.name.slice(0, 1)}
              </div>
              <div className="flex-1">
                <div className="font-display text-lg">{persona.name}</div>
                <div className="text-xs italic text-muted-foreground">{persona.tagline}</div>
              </div>
            </>
          ) : (
            <div className="flex-1 text-sm text-muted-foreground">Pick a sales persona for this campaign.</div>
          )}
          <Select value={draft.persona_id ?? ""} onValueChange={(v) => persist({ persona_id: v })}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Choose persona…" /></SelectTrigger>
            <SelectContent>
              {personas.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} — {p.tagline}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Leads */}
      <div>
        <div className="flex items-end justify-between">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Leads ({attached.length})</p>
          {available.length > 0 && (
            <Select onValueChange={attachLead}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Add lead…" /></SelectTrigger>
              <SelectContent>
                {available.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name || "Untitled"} {l.company && `· ${l.company}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-background/40">
          {attached.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No leads yet — add one above.</div>
          ) : attached.map((l) => (
            <div key={l.id} className="flex items-center gap-4 border-b border-border/40 px-5 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm">{l.name || "Untitled"}</div>
                <div className="text-xs text-muted-foreground">{l.company || "—"}</div>
              </div>
              <div className="font-mono text-xs text-muted-foreground">{l.phone || "—"}</div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{l.status}</span>
              <button onClick={() => detachLead(l.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Brief */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Additional information & brief</p>
        <Textarea
          rows={4} className="mt-3"
          value={draft.brief}
          onChange={(e) => setDraft({ ...draft, brief: e.target.value })}
          onBlur={() => persist({})}
          placeholder="Anything the agent should know about this batch — context, recent news, what to avoid."
        />
      </div>

      {/* Talking points */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">What to talk about</p>
        <div className="mt-3 space-y-2">
          {draft.talking_points.map((tp, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <Input
                value={tp}
                onChange={(e) => {
                  const next = [...draft.talking_points];
                  next[i] = e.target.value;
                  setDraft({ ...draft, talking_points: next });
                }}
                onBlur={() => persist({})}
              />
              <button onClick={() => persist({ talking_points: draft.talking_points.filter((_, j) => j !== i) })}
                className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => persist({ talking_points: [...draft.talking_points, ""] })}>
            <Plus className="h-3.5 w-3.5" /> Add talking point
          </Button>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-6">
        <Button variant="ghost" size="sm" onClick={() => persist({ status: "draft" })}>Save as draft</Button>
        <div className="flex gap-2">
          <TestDialog onLaunch={onLaunch} />
          <Button onClick={onLaunch} className="rounded-md">
            <Mic className="h-4 w-4" /> Launch campaign
          </Button>
        </div>
      </div>
    </div>
  );
}

function TestDialog({ onLaunch }: { onLaunch: () => void }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Test with one number</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">Quick test</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Browser-only test — opens the live conversation right here. (No real outbound dialing.)
        </p>
        <div className="space-y-2 pt-2">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Label or number…" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { setOpen(false); onLaunch(); }}>Start conversation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}