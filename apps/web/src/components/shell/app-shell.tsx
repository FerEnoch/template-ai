import type { ReactNode } from "react";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";
import { cn } from "@/lib/utils";

interface AppShellProps {
  readonly children: ReactNode;
  readonly sidebar?: boolean;
  readonly footer?: boolean;
  readonly activeSidebarItem?: string;
}

export function AppShell({
  children,
  sidebar = true,
  footer = true,
  activeSidebarItem,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className={cn("flex flex-1 pt-14", sidebar && "md:ml-60")}>
        {sidebar && <Sidebar activeItem={activeSidebarItem} />}
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
      {footer && <Footer />}
    </div>
  );
}
