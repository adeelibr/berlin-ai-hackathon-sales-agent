import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/company")({
  component: () => <AuthGuard><CompanyPage /></AuthGuard>,
});

type Profile = {
  name: string; tagline: string; industry: string;
  website: string; linkedin: string; twitter: string;
  what_we_do: string; value_prop: string; target_customer: string;
  logo_url: string | null;
};

const EMPTY: Profile = {
  name: "", tagline: "", industry: "", website: "", linkedin: "", twitter: "",
  what_we_do: "", value_prop: "", target_customer: "", logo_url: null,
};

function CompanyPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("company_profile").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setProfile({
        name: data.name, tagline: data.tagline, industry: data.industry,
        website: data.website, linkedin: data.linkedin, twitter: data.twitter,
        what_we_do: data.what_we_do, value_prop: data.value_prop, target_customer: data.target_customer,
        logo_url: data.logo_url,
      });
      setLoading(false);
    })();
  }, [user]);

  const persist = async (next: Partial<Profile>) => {
    if (!user) return;
    const merged = { ...profile, ...next };
    setProfile(merged);
    const { error } = await supabase.from("company_profile").upsert({
      user_id: user.id, ...merged,
    }, { onConflict: "user_id" });
    if (error) { toast.error(error.message); return; }
    setSavedAt(new Date());
  };

  const onLogo = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("company-logos").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: signed } = await supabase.storage.from("company-logos").createSignedUrl(path, 60 * 60 * 24 * 365);
    await persist({ logo_url: signed?.signedUrl ?? path });
    setUploading(false);
  };

  if (loading) return <AppShell><div className="p-12 text-sm text-muted-foreground">Loading…</div></AppShell>;

  const update = (key: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setProfile({ ...profile, [key]: e.target.value });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-8 py-12">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Workspace</p>
            <h1 className="mt-2 font-display text-4xl">Company</h1>
            <p className="mt-2 text-sm text-muted-foreground">The story your agent tells, in your words.</p>
          </div>
          {savedAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-accent" /> Saved · just now
            </div>
          )}
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_280px]">
          <div className="space-y-10">
            <section className="space-y-5">
              <h2 className="font-display text-xl">Identity</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name"><Input value={profile.name} onChange={update("name")} onBlur={() => persist({})} /></Field>
                <Field label="Tagline"><Input value={profile.tagline} onChange={update("tagline")} onBlur={() => persist({})} /></Field>
                <Field label="Industry"><Input value={profile.industry} onChange={update("industry")} onBlur={() => persist({})} /></Field>
                <Field label="Website"><Input value={profile.website} onChange={update("website")} onBlur={() => persist({})} placeholder="https://" /></Field>
                <Field label="LinkedIn"><Input value={profile.linkedin} onChange={update("linkedin")} onBlur={() => persist({})} /></Field>
                <Field label="Twitter / X"><Input value={profile.twitter} onChange={update("twitter")} onBlur={() => persist({})} /></Field>
              </div>
            </section>

            <section className="space-y-5">
              <h2 className="font-display text-xl">What we do</h2>
              <Textarea rows={5} value={profile.what_we_do} onChange={update("what_we_do")} onBlur={() => persist({})}
                placeholder="In one paragraph, what your team makes and who it's for." />
            </section>

            <section className="space-y-5">
              <h2 className="font-display text-xl">Value & customer</h2>
              <Field label="Value prop">
                <Textarea rows={3} value={profile.value_prop} onChange={update("value_prop")} onBlur={() => persist({})}
                  placeholder="The result you reliably create, in plain language." />
              </Field>
              <Field label="Target customer">
                <Textarea rows={3} value={profile.target_customer} onChange={update("target_customer")} onBlur={() => persist({})}
                  placeholder="Who you serve best — role, company size, situation." />
              </Field>
            </section>
          </div>

          <aside className="space-y-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Logo</p>
              <div className="mt-3 flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/40 overflow-hidden">
                {profile.logo_url ? (
                  <img src={profile.logo_url} alt="Logo" className="h-full w-full object-contain p-4" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])}
              />
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload logo"}
              </Button>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Quick links</p>
              <div className="mt-3 space-y-2 text-xs">
                {profile.website && <LinkRow label="Website" href={profile.website} />}
                {profile.linkedin && <LinkRow label="LinkedIn" href={profile.linkedin} />}
                {profile.twitter && <LinkRow label="Twitter" href={profile.twitter} />}
                {!profile.website && !profile.linkedin && !profile.twitter && (
                  <p className="text-muted-foreground">Add links above to see them here.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function LinkRow({ label, href }: { label: string; href: string }) {
  return (
    <a href={href.startsWith("http") ? href : `https://${href}`} target="_blank" rel="noreferrer"
      className="flex items-center justify-between rounded-md border border-border/40 bg-card/40 px-3 py-2 text-muted-foreground hover:text-foreground">
      <span>{label}</span>
      <span className="truncate text-[10px] opacity-60">{href}</span>
    </a>
  );
}