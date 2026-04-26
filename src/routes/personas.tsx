import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/personas")({
  component: () => <AuthGuard><PersonasPage /></AuthGuard>,
});

type Persona = {
  id: string; key: string; name: string; tagline: string;
  description: string; best_for: string[]; prompt: string;
  avatar_color: string; sort_order: number;
};

const COLOR: Record<string, string> = {
  sage: "bg-accent/30 text-accent-foreground",
  stone: "bg-muted text-foreground",
  rose: "bg-node-error/30 text-foreground",
};

function PersonasPage() {
  const { user } = useAuth();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.from("sales_personas")
        .select("*").order("sort_order", { ascending: true });
      if (error) { toast.error(error.message); return; }
      setPersonas((data ?? []) as Persona[]);
      setLoading(false);
    })();
  }, [user]);

  const savePrompt = async (p: Persona) => {
    setSavingId(p.id);
    const newPrompt = drafts[p.id] ?? p.prompt;
    const { error } = await supabase.from("sales_personas")
      .update({ prompt: newPrompt }).eq("id", p.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    setPersonas((prev) => prev.map((x) => x.id === p.id ? { ...x, prompt: newPrompt } : x));
    toast.success("Prompt saved");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-8 py-12">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Workspace</p>
            <h1 className="mt-2 font-display text-4xl">Sales personas</h1>
            <p className="mt-2 text-sm text-muted-foreground">Eight voices, one calm system. Pick one for each campaign.</p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground italic">Issue 04 · Spring '26</span>
        </div>

        <div className="mt-10 space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : personas.map((p) => {
            const isOpen = expanded === p.id;
            return (
              <article key={p.id}
                className={`rounded-xl border transition-all ${
                  isOpen ? "border-accent/40 bg-accent/5" : "border-border/60 bg-card/50 hover:border-border"
                }`}
                style={{ boxShadow: "var(--shadow-zen)" }}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : p.id)}
                  className="flex w-full items-start gap-5 p-6 text-left"
                >
                  <div className={`flex h-14 w-14 flex-none items-center justify-center rounded-full ${COLOR[p.avatar_color] ?? COLOR.sage} font-display text-lg`}>
                    {p.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <h2 className="font-display text-2xl">{p.name}</h2>
                      <span className="text-sm italic text-muted-foreground">{p.tagline}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/90">{p.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Best for</span>
                      {p.best_for.map((b) => (
                        <span key={b} className="rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[10px] text-muted-foreground">{b}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-muted-foreground">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border/40 px-6 pb-6 pt-5">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">System prompt</p>
                    <Textarea
                      rows={8}
                      className="mt-3 font-mono text-xs"
                      value={drafts[p.id] ?? p.prompt}
                      onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })}
                    />
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={() => savePrompt(p)} disabled={savingId === p.id}>
                        <Save className="h-3.5 w-3.5" /> {savingId === p.id ? "Saving…" : "Save prompt"}
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}