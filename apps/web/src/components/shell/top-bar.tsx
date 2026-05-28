import Link from "next/link";
import { Search, Bell, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  readonly activeNav?: string;
}

const navItems = [
  { label: "Inicio", href: "/" },
  { label: "Biblioteca", href: "/biblioteca" },
  { label: "Plantillas", href: "#" },
  { label: "Archivo", href: "#" },
] as const;

export function TopBar({ activeNav }: TopBarProps) {
  return (
    <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-8">
        <Link
          href="/"
          className="font-headline text-xl font-bold text-accent hover:text-accent-hover transition-colors"
        >
          template-ai
        </Link>
        <nav className="hidden md:flex md:gap-8">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "pb-1 font-label text-sm font-medium transition-colors duration-200",
                activeNav === item.label
                  ? "border-b-2 border-accent font-bold text-text-primary"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-64 rounded-full bg-background py-1.5 pl-10 pr-4 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button className="rounded-full p-2 text-text-secondary transition-colors hover:bg-background">
          <Bell className="h-5 w-5" />
        </button>
        <button className="rounded-full p-2 text-text-secondary transition-colors hover:bg-background">
          <Settings className="h-5 w-5" />
        </button>
        <div className="h-8 w-8 overflow-hidden rounded-full bg-border">
          <div className="flex h-full w-full items-center justify-center bg-accent/20">
            <User className="h-5 w-5 text-accent" />
          </div>
        </div>
      </div>
    </header>
  );
}
