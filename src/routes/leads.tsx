import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leads")({
  component: () => <AuthGuard><LeadsPage /></AuthGuard>,
});

type Lead = {
  id: string; name: string; company: string; phone: string;
  status: "new" | "called" | "scheduled"; notes: string; created_at: string;
};
type Filter = "all" | "new" | "called" | "scheduled";

const STATUS_LABEL: Record<Lead["status"], string> = {
  new: "New", called: "Called", scheduled: "Scheduled",
};

function statusPillClass(s: Lead["status"]) {
  if (s === "called") return "bg-node-done/40 text-foreground";
  if (s === "scheduled") return "bg-node-running/40 text-foreground";
  return "bg-muted text-muted-foreground";
}

function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);

  const refresh = async () => {
    const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setLeads((data ?? []) as Lead[]);
    setLoading(false);
  };

  useEffect(() => { if (user) refresh(); }, [user]);

  const counts = useMemo(() => ({
    all: leads.length,
    new: leads.filter((l) => l.status === "new").length,
    called: leads.filter((l) => l.status === "called").length,
    scheduled: leads.filter((l) => l.status === "scheduled").length,
  }), [leads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q)
      );
    });
  }, [leads, filter, query]);

  const deleteLead = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setSelected(null);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Workspace</p>
            <h1 className="mt-2 font-display text-4xl">Leads</h1>
            <p className="mt-2 text-sm text-muted-foreground">The list of people you'd like to talk to.</p>
          </div>
          <AddLeadDialog open={open} setOpen={setOpen} onAdded={refresh} userId={user?.id} />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, company, phone…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "new", "called", "scheduled"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                  filter === f
                    ? "border-accent/60 bg-accent/15 text-foreground"
                    : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "All" : STATUS_LABEL[f]} <span className="opacity-60">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-card/40">
          {loading ? (
            <div className="px-6 py-12 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-display text-lg">No leads here yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">Add one to start a campaign.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-6 py-3 font-normal w-12">#</th>
                  <th className="px-6 py-3 font-normal">Name</th>
                  <th className="px-6 py-3 font-normal">Company</th>
                  <th className="px-6 py-3 font-normal">Phone</th>
                  <th className="px-6 py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr
                    key={l.id}
                    onClick={() => setSelected(l)}
                    className="cursor-pointer border-b border-border/30 last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="px-6 py-4">{l.name || <span className="text-muted-foreground">Untitled</span>}</td>
                    <td className="px-6 py-4 text-muted-foreground">{l.company || "—"}</td>
                    <td className="px-6 py-4 font-mono text-xs">{l.phone || "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${statusPillClass(l.status)}`}>
                        {STATUS_LABEL[l.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl">{selected.name || "Untitled"}</SheetTitle>
              </SheetHeader>
              <LeadEditor lead={selected} onSaved={async (l) => { await refresh(); setSelected(l); }} onDelete={() => deleteLead(selected.id)} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function LeadEditor({ lead, onSaved, onDelete }: {
  lead: Lead; onSaved: (l: Lead) => void; onDelete: () => void;
}) {
  const [draft, setDraft] = useState(lead);
  useEffect(() => setDraft(lead), [lead.id]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.from("leads").update({
      name: draft.name, company: draft.company, phone: draft.phone, status: draft.status, notes: draft.notes,
    }).eq("id", lead.id).select("*").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    onSaved(data as Lead);
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Company</Label>
        <Input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <div className="flex gap-2">
          {(["new", "called", "scheduled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setDraft({ ...draft, status: s })}
              className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                draft.status === s ? "border-accent/60 bg-accent/20" : "border-border/60 hover:bg-muted/50"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea rows={5} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      </div>
      <div className="flex justify-between pt-4">
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}

function AddLeadDialog({ open, setOpen, onAdded, userId }: {
  open: boolean; setOpen: (b: boolean) => void; onAdded: () => void; userId?: string;
}) {
  const [draft, setDraft] = useState({ name: "", company: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("leads").insert({
      user_id: userId, ...draft, status: "new",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setDraft({ name: "", company: "", phone: "", notes: "" });
    setOpen(false);
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-md"><Plus className="h-4 w-4" /> Add lead</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">New lead</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2"><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Company</Label><Input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+49 ..." /></div>
          <div className="space-y-2"><Label>Notes</Label><Textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Add lead"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}