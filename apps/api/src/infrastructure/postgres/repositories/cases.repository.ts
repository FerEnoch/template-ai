import { PoolClient } from "pg";

export class CasesRepository {
  constructor(private readonly client: PoolClient) {}

  /**
   * Archive all cases linked to a template.
   * STUB: returns 0 until migration 0009 (casos table) is applied.
   */
  async archiveByTemplateId(_templateId: string): Promise<number> {
    // TODO(migration-0009): UPDATE casos SET status='archivado' WHERE template_id=$1
    return 0;
  }
}
