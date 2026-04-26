import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  UserSquare2,
  Megaphone,
  FileText,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

type Counts = { transcripts: number; personas: number; campaigns: number };

function useSidebarCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>({ transcripts: 0, personas: 0, campaigns: 0 });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const [t, p, c] = await Promise.all([
        supabase
          .from("runs")
          .select("id", { count: "exact", head: true })
          .not("transcript", "is", null),
        supabase.from("sales_personas").select("id", { count: "exact", head: true }),
        supabase.from("campaigns").select("id", { count: "exact", head: true }),
      ]);
      if (cancelled) return;
      setCounts({
        transcripts: t.count ?? 0,
        personas: p.count ?? 0,
        campaigns: c.count ?? 0,
      });
    };
    load();
    const ch = supabase
      .channel("sidebar-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_personas" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return counts;
}

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; count?: number };

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const counts = useSidebarCounts();

  const workspace: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/personas", label: "Sales personas", icon: UserSquare2, count: counts.personas },
    { to: "/campaigns", label: "Campaigns", icon: Megaphone, count: counts.campaigns },
    { to: "/transcripts", label: "Transcripts", icon: FileText, count: counts.transcripts },
  ];
  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(to + "/");

  const renderItem = (item: NavItem) => {
    const active = isActive(item.to);
    const Icon = item.icon;
    return (
      <SidebarMenuItem key={item.to + item.label}>
        <SidebarMenuButton asChild isActive={active}>
          <Link
            to={item.to}
            className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
              active ? "bg-muted/70 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <span
              className={`h-1 w-1 rounded-full ${active ? "bg-accent" : "bg-border group-hover:bg-muted-foreground/60"}`}
              aria-hidden
            />
            <Icon className="h-3.5 w-3.5 opacity-70" />
            <span className="flex-1 truncate">{item.label}</span>
            {typeof item.count === "number" && item.count > 0 && (
              <span className="text-[10px] tabular-nums text-muted-foreground">{item.count}</span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-background/40 backdrop-blur">
      <SidebarHeader className="px-4 pt-5 pb-3">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <span className="font-display text-base tracking-tight">Stillwater</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{workspace.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/30 text-[10px] font-medium text-accent-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-foreground">{user?.email ?? "Signed in"}</div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            aria-label="Sign out"
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}