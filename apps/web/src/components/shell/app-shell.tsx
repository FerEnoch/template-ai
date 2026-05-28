import type { ReactNode } from "react";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";
import { cn } from "@/lib/utils";

interface AppShellProps {
  readonly children: ReactNode;
  readonly sidebar?: boolean;
  readonly footer?: boolean;
}

export function AppShell({
  children,
  sidebar = true,
  footer = true,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className={cn("flex flex-1 pt-14", sidebar && "md:ml-60")}>
        {sidebar && <Sidebar />}
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
      {footer && <Footer />}
    </div>
  );
}
