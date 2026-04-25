import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: (search.mode === "signup" ? "signup" : "signin") as "signin" | "signup",
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, signIn, signUp, loading } = useAuth();
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setIsSignup(mode === "signup"), [mode]);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) {
        await signUp(email, password);
        toast.success("Welcome.");
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-up">
        <Link to="/" className="mb-12 flex items-center justify-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span className="font-display text-lg tracking-tight">Stillwater</span>
        </Link>

        <div className="rounded-xl border border-border/60 bg-card/60 p-8 backdrop-blur" style={{ boxShadow: "var(--shadow-zen-lg)" }}>
          <h1 className="font-display text-2xl text-foreground">
            {isSignup ? "Create your space" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup ? "A quiet place for loud conversations." : "Sign in to your flows."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full h-10">
              {busy ? "…" : isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-foreground underline-offset-4 hover:underline"
            >
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
