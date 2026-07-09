import type { Entity } from "@template-ai/contracts";

export const GROUP_ORDER: Entity["group"][] = [
  "PARTES",
  "INMUEBLE",
  "FECHAS",
  "ANEXOS",
];

export function groupEntities(
  entities: Entity[]
): Array<[Entity["group"], Entity[]]> {
  const byGroup = new Map<Entity["group"], Entity[]>();
  for (const entity of entities) {
    const list = byGroup.get(entity.group) ?? [];
    list.push(entity);
    byGroup.set(entity.group, list);
  }
  return GROUP_ORDER.map((group) => [group, byGroup.get(group) ?? []]);
}
