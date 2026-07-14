import { SEED_GROUPS } from "@template-ai/contracts";
import type { Entity } from "@template-ai/contracts";

export const GROUP_ORDER: string[] = [...SEED_GROUPS];

export function groupEntities(
  entities: Entity[]
): Array<[string, Entity[]]> {
  const byGroup = new Map<string, Entity[]>();
  for (const entity of entities) {
    const list = byGroup.get(entity.group) ?? [];
    list.push(entity);
    byGroup.set(entity.group, list);
  }

  const result: Array<[string, Entity[]]> = GROUP_ORDER.map((group) => [
    group,
    byGroup.get(group) ?? [],
  ]);

  // Append dynamic groups (not in seed order) in first-seen order.
  for (const [group, items] of byGroup.entries()) {
    if (!GROUP_ORDER.includes(group)) {
      result.push([group, items]);
    }
  }

  return result;
}
