import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* soft drifting orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 h-[480px] w-[480px] rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute top-1/2 right-1/4 h-[360px] w-[360px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span className="font-display text-lg tracking-tight">Stillwater</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-md px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Button asChild size="sm" className="rounded-md">
            <Link to="/login" search={{ mode: "signup" }}>
              Get started
            </Link>
          </Button>
        </nav>
      </header>

      {/* hero */}
      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-24 text-center md:pt-40">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur animate-fade-up">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Berlin AI Hackathon · 2026
        </div>

        <h1 className="font-display text-5xl leading-[1.05] text-foreground md:text-7xl animate-fade-up" style={{ animationDelay: "60ms" }}>
          Cold calls that<br />
          <span className="italic text-muted-foreground">close themselves.</span>
        </h1>

        <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg animate-fade-up" style={{ animationDelay: "180ms" }}>
          Compose a quiet workflow. An agent trained on Hermozi's offer
          frameworks dials your list, speaks with studio-clean audio, and
          hangs up before the second minute.
        </p>

        <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row animate-fade-up" style={{ animationDelay: "300ms" }}>
          <Button asChild size="lg" className="h-12 px-8 text-base rounded-md">
            <Link to="/login" search={{ mode: "signup" }}>Begin</Link>
          </Button>
          <Link
            to="/login"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            I already have an account
          </Link>
        </div>

        {/* node trail */}
        <div className="mt-32 flex w-full max-w-2xl items-center justify-between gap-2 opacity-70 animate-fade-up" style={{ animationDelay: "480ms" }}>
          {["Context", "Numbers", "Hermozi", "Call", "Result"].map((n, i) => (
            <div key={n} className="flex flex-1 items-center gap-2">
              <div className="flex flex-col items-center gap-2">
                <div className="h-3 w-3 rounded-full border border-border bg-card" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{n}</span>
              </div>
              {i < 4 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>
      </main>

      <footer className="mx-auto mt-32 max-w-6xl border-t border-border/40 px-6 py-8 text-center text-xs text-muted-foreground">
        Built with Lovable AI · Telli · ai-coustics
      </footer>
    </div>
  );
}
