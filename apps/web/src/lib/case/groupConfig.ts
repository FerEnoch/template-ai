import {
  Users,
  Building2,
  Calendar,
  Paperclip,
  LayoutGrid,
  Folder,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { SEED_GROUPS, GENERAL, OTROS } from "@template-ai/contracts";

export interface GroupConfig {
  label: string;
  icon: LucideIcon;
  isSeed: boolean;
}

const SEED_GROUP_CONFIG: Record<
  (typeof SEED_GROUPS)[number],
  Omit<GroupConfig, "isSeed">
> = {
  PARTES: { label: "Partes", icon: Users },
  INMUEBLE: { label: "Inmueble", icon: Building2 },
  FECHAS: { label: "Fechas", icon: Calendar },
  ANEXOS: { label: "Anexos", icon: Paperclip },
  GENERAL: { label: "General", icon: LayoutGrid },
  OTROS: { label: "Otros", icon: Folder },
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function isSeedGroup(group: string): boolean {
  return (SEED_GROUPS as readonly string[]).includes(group);
}

export function getGroupConfig(group: string): GroupConfig {
  const seed = SEED_GROUP_CONFIG[group as keyof typeof SEED_GROUP_CONFIG];
  if (seed) {
    return { ...seed, isSeed: true };
  }

  return {
    label: titleCase(group),
    icon: Tag,
    isSeed: false,
  };
}
