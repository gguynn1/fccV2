import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavigationItem {
  to: string;
  label: string;
  end?: boolean;
}

const navigationItems: NavigationItem[] = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/entities", label: "Entities" },
  { to: "/threads", label: "Threads" },
  { to: "/topics", label: "Topics" },
  { to: "/budget", label: "Budget" },
  { to: "/scheduler", label: "Scheduler" },
  { to: "/queue", label: "Queue" },
  { to: "/activity", label: "Activity" },
];

export interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Admin UI</p>
            <h1 className="text-xl font-semibold">Family Command Center</h1>
          </div>
          <nav className="overflow-x-auto">
            <div className="flex min-w-max items-center gap-2">
              {navigationItems.map((item) => (
                <NavLink key={item.label} to={item.to} end={item.end}>
                  {({ isActive }) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "text-muted-foreground",
                        isActive && "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {item.label}
                    </Button>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6">{children}</main>
    </div>
  );
}
