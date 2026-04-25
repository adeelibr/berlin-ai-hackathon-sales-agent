import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mic, Save, Building2, Bot } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/flows/$flowId")({
  component: () => (
    <AuthGuard>
      <FlowBuilder />
    </AuthGuard>
  ),
});

const PERSONA_DEFAULT = `You are a calm, curious sales rep.

Keep replies to 1–3 short sentences. Ask one open question at a time.
Listen first, then reflect back what you heard before suggesting anything.
Never push. Be warm.`;

const NODES = [
  { key: "context", label: "Who we are", icon: Building2, sub: "Company context" },
  { key: "agent", label: "Agent", icon: Bot, sub: "Persona & instructions" },
  { key: "talk", label: "Talk", icon: Mic, sub: "Live conversation" },
] as const;

type NodeKey = typeof NODES[number]["key"];

function FlowBuilder() {
  const { flowId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [selected, setSelected] = useState<NodeKey>("context");

  const [name, setName] = useState("");
  const [whoWeAre, setWhoWeAre] = useState("");
  const [whatWeDo, setWhatWeDo] = useState("");
  const [agentPersona, setAgentPersona] = useState(PERSONA_DEFAULT);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.from("flows").select("*").eq("id", flowId).maybeSingle();
      if (error) { toast.error(error.message); return; }
      if (!data) { toast.error("Flow not found"); navigate({ to: "/dashboard" }); return; }
      setName(data.name);
      setWhoWeAre(data.who_we_are);
      setWhatWeDo(data.what_we_do);
      setAgentPersona(data.agent_persona || PERSONA_DEFAULT);
      setLoading(false);
    })();
  }, [flowId, user, navigate]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("flows").update({
      name, who_we_are: whoWeAre, what_we_do: whatWeDo, agent_persona: agentPersona,
    }).eq("id", flowId);
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    toast.success("Saved");
    return true;
  };

  const startConversation = async () => {
    if (!whoWeAre.trim() || !whatWeDo.trim()) {
      toast.error("Tell the agent who we are and what we do first");
      setSelected("context");
      return;
    }
    setStarting(true);
    const ok = await save();
    if (!ok) { setStarting(false); return; }
    const { data, error } = await supabase
      .from("runs")
      .insert({ user_id: user!.id, flow_id: flowId, status: "active" })
      .select("id")
      .single();
    setStarting(false);
    if (error || !data) { toast.error(error?.message ?? "Could not start"); return; }
    navigate({ to: "/conversations/$runId", params: { runId: data.id } });
  };

  if (loading) return <AppShell><div className="p-12 text-sm text-muted-foreground">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate({ to: "/dashboard" })} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={save} disabled={saving} size="sm">
              <Save className="h-4 w-4" />{saving ? "Saving" : "Save"}
            </Button>
            <Button onClick={startConversation} disabled={starting} size="sm">
              <Mic className="h-4 w-4" />{starting ? "Starting" : "Start talking"}
            </Button>
          </div>
        </div>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-6 border-0 bg-transparent px-0 font-display !text-3xl shadow-none focus-visible:ring-0"
          placeholder="Flow name"
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="rounded-xl border border-border/60 bg-card/30 p-8">
            <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4">
              {NODES.map((node, i) => {
                const Icon = node.icon;
                const isSelected = selected === node.key;
                return (
                  <div key={node.key} className="flex items-center">
                    <button
                      onClick={() => setSelected(node.key)}
                      className={`flex w-40 flex-col items-center gap-2 rounded-xl border p-5 transition-all ${
                        isSelected
                          ? "border-accent/60 bg-accent/10 shadow-[var(--shadow-zen)]"
                          : "border-border/60 bg-card/60 hover:border-accent/30"
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isSelected ? "text-accent-foreground" : "text-muted-foreground"}`} />
                      <span className="text-xs font-medium">{node.label}</span>
                      <span className="text-[10px] text-muted-foreground">{node.sub}</span>
                    </button>
                    {i < NODES.length - 1 && <div className="mx-3 h-px w-10 bg-border" />}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="rounded-xl border border-border/60 bg-card/60 p-6" style={{ boxShadow: "var(--shadow-zen)" }}>
            {selected === "context" && (
              <div className="space-y-4">
                <h3 className="font-display text-lg">Who we are</h3>
                <div className="space-y-2">
                  <Label>Who we are</Label>
                  <Textarea rows={3} value={whoWeAre} onChange={(e) => setWhoWeAre(e.target.value)} placeholder="A 2-person AI studio in Berlin..." />
                </div>
                <div className="space-y-2">
                  <Label>What we do</Label>
                  <Textarea rows={4} value={whatWeDo} onChange={(e) => setWhatWeDo(e.target.value)} placeholder="We help SaaS founders book 10 demos a week without hiring an SDR..." />
                </div>
              </div>
            )}
            {selected === "agent" && (
              <div className="space-y-4">
                <h3 className="font-display text-lg">Agent</h3>
                <p className="text-xs text-muted-foreground">Define how the agent should sound and behave.</p>
                <Textarea rows={16} value={agentPersona} onChange={(e) => setAgentPersona(e.target.value)} className="font-mono text-xs" />
              </div>
            )}
            {selected === "talk" && (
              <div className="space-y-4">
                <h3 className="font-display text-lg">Talk</h3>
                <p className="text-sm text-muted-foreground">
                  When you're ready, hit <span className="font-medium text-foreground">Start talking</span>. We'll open your mic, the agent will speak first using Gradium voice, and we'll record the full transcript to your dashboard.
                </p>
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  Voice: <span className="font-mono text-foreground">Emma</span> · Powered by <span className="text-foreground">Gradium</span>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}