import {
  Home,
  FolderOpen,
  FileText,
  Archive,
  BarChart3,
  Settings,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  readonly activeItem?: string;
}

const navItems = [
  { label: "Inicio", icon: Home, href: "#" },
  { label: "Biblioteca", icon: FolderOpen, href: "#" },
  { label: "Plantillas", icon: FileText, href: "#" },
  { label: "Archivo", icon: Archive, href: "#" },
  { label: "Plan y uso", icon: BarChart3, href: "#" },
  { label: "Configuración", icon: Settings, href: "#" },
] as const;

export function Sidebar({ activeItem = "Biblioteca" }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-14 z-40 hidden h-[calc(100vh-3.5rem)] w-60 flex-col gap-y-4 overflow-y-auto border-r border-border bg-background p-4 md:flex">
      <div className="mb-2 px-2">
        <div className="font-headline text-lg font-semibold text-text-primary">
          Law Office
        </div>
        <div className="text-[10px] uppercase tracking-widest text-text-secondary">
          Senior Partner
        </div>
      </div>

      <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-label font-medium text-white transition-all duration-150 active:scale-95">
        <Plus className="h-4 w-4" />
        Nuevo Documento
      </button>

      <nav className="mt-2 flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.label === activeItem;
          return (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 active:scale-95",
                isActive
                  ? "bg-accent/10 font-semibold text-accent"
                  : "text-text-secondary hover:bg-background",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
