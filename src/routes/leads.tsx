import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, Pencil, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leads")({
  component: () => <AuthGuard><LeadsPage /></AuthGuard>,
});

type Lead = {
  id: string;
  name: string;
  company: string;
  phone: string;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const STATUSES = ["new", "called", "scheduled"] as const;

const STATUS_TONE: Record<string, string> = {
  new: "bg-muted/60 text-foreground border-border",
  called: "bg-accent/15 text-accent-foreground border-accent/30",
  scheduled: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setLeads((data ?? []) as Lead[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const ch = supabase
      .channel("leads-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        l.notes.toLowerCase().includes(q)
      );
    });
  }, [leads, query, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const s of STATUSES) c[s] = 0;
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const onSaveNew = async (payload: Partial<Lead>) => {
    if (!user) return;
    const { error } = await supabase.from("leads").insert({
      user_id: user.id,
      name: payload.name ?? "",
      company: payload.company ?? "",
      phone: payload.phone ?? "",
      notes: payload.notes ?? "",
      status: payload.status ?? "new",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Lead added");
    setCreateOpen(false);
    refresh();
  };

  const onSaveEdit = async (payload: Partial<Lead>) => {
    if (!editing) return;
    const { error } = await supabase.from("leads").update({
      name: payload.name ?? "",
      company: payload.company ?? "",
      phone: payload.phone ?? "",
      notes: payload.notes ?? "",
      status: payload.status ?? "new",
    }).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead updated");
    setEditing(null);
    refresh();
  };

  const onDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("leads").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead removed");
    setDeleteId(null);
    refresh();
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pipeline</p>
            <h1 className="mt-2 font-display text-4xl text-foreground">Leads</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your active list. Add prospects, track status, hand them to a campaign.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-md"><Plus className="mr-1.5 h-4 w-4" />Add lead</Button>
            </DialogTrigger>
            <LeadFormDialog
              title="Add lead"
              initial={null}
              onSubmit={onSaveNew}
              onCancel={() => setCreateOpen(false)}
            />
          </Dialog>
        </div>

        {/* Filter chips */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {(["all", ...STATUSES] as const).map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? "border-accent/60 bg-accent/15 text-foreground"
                    : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s} <span className="ml-1 tabular-nums opacity-70">{counts[s] ?? 0}</span>
              </button>
            );
          })}
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, company, phone…"
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div
          className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-card/40"
          style={{ boxShadow: "var(--shadow-zen)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Added</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Users className="h-6 w-6 opacity-50" />
                      <div className="text-sm">
                        {leads.length === 0
                          ? "No leads yet. Add your first prospect."
                          : "No leads match these filters."}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium text-foreground">{l.name || <span className="text-muted-foreground">Unnamed</span>}</td>
                    <td className="px-5 py-3 text-muted-foreground">{l.company || "—"}</td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{l.phone || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${STATUS_TONE[l.status] ?? STATUS_TONE.new}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(l)}
                          aria-label="Edit lead"
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(l.id)}
                          aria-label="Delete lead"
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <LeadFormDialog
            title="Edit lead"
            initial={editing}
            onSubmit={onSaveEdit}
            onCancel={() => setEditing(null)}
          />
        )}
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the lead and detaches it from any campaign.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function LeadFormDialog({
  title,
  initial,
  onSubmit,
  onCancel,
}: {
  title: string;
  initial: Lead | null;
  onSubmit: (payload: Partial<Lead>) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState(initial?.status ?? "new");
  const [saving, setSaving] = useState(false);

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-display text-xl">{title}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="lead-name">Name</Label>
          <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lead-company">Company</Label>
          <Input id="lead-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lead-phone">Phone</Label>
          <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" />
        </div>
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lead-notes">Notes</Label>
          <Textarea
            id="lead-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Context, last touch, what to mention…"
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onSubmit({ name, company, phone, notes, status });
            setSaving(false);
          }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}