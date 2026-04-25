import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Play, Save, Building2, Phone, BookOpen, PhoneOutgoing, ClipboardList } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/flows/$flowId")({
  component: () => (
    <AuthGuard>
      <FlowBuilder />
    </AuthGuard>
  ),
});

const HERMOZI_DEFAULT = `You embody Alex Hermozi's sales philosophy.

Core principles:
- Grand Slam Offer: make an offer so good people feel stupid saying no.
- Value Equation: (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort & Sacrifice).
- Hooks open with a clear pain or curiosity gap, never with "How are you today?"
- Stack value before price. Frame price as small relative to outcome.
- Use specific numbers, not vague claims.
- Always ask for the next concrete micro-commitment, not the full sale.
- Stay calm, low-pressure, conversational. Curiosity > persuasion.

On a 2-minute cold call:
1. 10s pattern interrupt + permission ("got 30 seconds?")
2. 30s problem + outcome reframe specific to their world
3. 40s offer with risk reversal
4. 30s clear CTA — book a 15-min slot`;

const NODES = [
  { id: 1, key: "context", label: "Who we are", icon: Building2, sub: "Company context" },
  { id: 2, key: "numbers", label: "Phone numbers", icon: Phone, sub: "Comma-separated" },
  { id: 3, key: "knowledge", label: "Hermozi skills", icon: BookOpen, sub: "Knowledge base" },
  { id: 4, key: "call", label: "Make the call", icon: PhoneOutgoing, sub: "Telli + ai-coustics" },
  { id: 5, key: "log", label: "Log result", icon: ClipboardList, sub: "Save to dashboard" },
] as const;

type NodeKey = typeof NODES[number]["key"];

function FlowBuilder() {
  const { flowId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<NodeKey>("context");

  const [name, setName] = useState("");
  const [whoWeAre, setWhoWeAre] = useState("");
  const [whatWeDo, setWhatWeDo] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [hermoziKnowledge, setHermoziKnowledge] = useState(HERMOZI_DEFAULT);
  const [acPreEnhance, setAcPreEnhance] = useState(true);
  const [voice, setVoice] = useState("default");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.from("flows").select("*").eq("id", flowId).maybeSingle();
      if (error) { toast.error(error.message); return; }
      if (!data) { toast.error("Flow not found"); navigate({ to: "/dashboard" }); return; }
      setName(data.name);
      setWhoWeAre(data.who_we_are);
      setWhatWeDo(data.what_we_do);
      setPhoneNumbers(data.phone_numbers);
      setHermoziKnowledge(data.hermozi_knowledge || HERMOZI_DEFAULT);
      setAcPreEnhance(data.ac_pre_enhance);
      setVoice(data.voice);
      setLoading(false);
    })();
  }, [flowId, user, navigate]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("flows").update({
      name, who_we_are: whoWeAre, what_we_do: whatWeDo,
      phone_numbers: phoneNumbers, hermozi_knowledge: hermoziKnowledge,
      ac_pre_enhance: acPreEnhance, voice,
    }).eq("id", flowId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  const run = async () => {
    const numbers = phoneNumbers.split(",").map((s) => s.trim()).filter(Boolean);
    if (numbers.length === 0) { toast.error("Add at least one phone number"); return; }
    if (!whoWeAre.trim() || !whatWeDo.trim()) { toast.error("Fill in who/what we do"); return; }

    setRunning(true);
    await save();
    // Create one pending run per number — server pipeline will pick them up
    const rows = numbers.map((n) => ({
      user_id: user!.id, flow_id: flowId, phone_number: n, status: "pending",
    }));
    const { data, error } = await supabase.from("runs").insert(rows).select("id");
    setRunning(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Queued ${data?.length ?? 0} call${data?.length === 1 ? "" : "s"}`);
    navigate({ to: "/dashboard" });
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
            <Button variant="outline" onClick={save} disabled={saving} size="sm"><Save className="h-4 w-4" />{saving ? "Saving" : "Save"}</Button>
            <Button onClick={run} disabled={running} size="sm"><Play className="h-4 w-4" />{running ? "Running" : "Run flow"}</Button>
          </div>
        </div>

        <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-6 border-0 bg-transparent px-0 font-display !text-3xl shadow-none focus-visible:ring-0" placeholder="Flow name" />

        {/* canvas */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="rounded-xl border border-border/60 bg-card/30 p-8">
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
              {NODES.map((node, i) => {
                const Icon = node.icon;
                const isSelected = selected === node.key;
                return (
                  <div key={node.id} className="flex items-center">
                    <button
                      onClick={() => setSelected(node.key)}
                      className={`flex w-32 flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                        isSelected
                          ? "border-accent/60 bg-accent/10 shadow-[var(--shadow-zen)]"
                          : "border-border/60 bg-card/60 hover:border-accent/30"
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isSelected ? "text-accent-foreground" : "text-muted-foreground"}`} />
                      <span className="text-xs font-medium">{node.label}</span>
                      <span className="text-[10px] text-muted-foreground">{node.sub}</span>
                    </button>
                    {i < NODES.length - 1 && <div className="mx-2 h-px w-6 bg-border" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* config panel */}
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
            {selected === "numbers" && (
              <div className="space-y-4">
                <h3 className="font-display text-lg">Phone numbers</h3>
                <div className="space-y-2">
                  <Label>Comma-separated, E.164 format</Label>
                  <Textarea rows={6} value={phoneNumbers} onChange={(e) => setPhoneNumbers(e.target.value)} placeholder="+4915112345678, +4915198765432" className="font-mono text-xs" />
                </div>
                <p className="text-xs text-muted-foreground">{phoneNumbers.split(",").map((s) => s.trim()).filter(Boolean).length} number(s) ready</p>
              </div>
            )}
            {selected === "knowledge" && (
              <div className="space-y-4">
                <h3 className="font-display text-lg">Hermozi skills</h3>
                <p className="text-xs text-muted-foreground">Edit the knowledge that flavours the agent's voice.</p>
                <Textarea rows={20} value={hermoziKnowledge} onChange={(e) => setHermoziKnowledge(e.target.value)} className="font-mono text-xs" />
              </div>
            )}
            {selected === "call" && (
              <div className="space-y-4">
                <h3 className="font-display text-lg">Make the call</h3>
                <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                  <div>
                    <Label className="text-sm">ai-coustics pre-enhance</Label>
                    <p className="text-xs text-muted-foreground">Clean TTS before dialing</p>
                  </div>
                  <Switch checked={acPreEnhance} onCheckedChange={setAcPreEnhance} />
                </div>
                <div className="space-y-2">
                  <Label>Voice</Label>
                  <Input value={voice} onChange={(e) => setVoice(e.target.value)} />
                </div>
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  Hard cap: <span className="font-mono text-foreground">120s</span> per call.
                  Recording is cleaned with ai-coustics post-call.
                </div>
              </div>
            )}
            {selected === "log" && (
              <div className="space-y-4">
                <h3 className="font-display text-lg">Log result</h3>
                <p className="text-sm text-muted-foreground">
                  Each call's outcome — transcript, cleaned audio, duration — is saved to your dashboard automatically.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
