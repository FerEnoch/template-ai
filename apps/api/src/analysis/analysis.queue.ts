export const ANALYSIS_QUEUE = "analysis-queue";

export interface AnalysisJobPayload {
  analysisResultId: string;
  documentId: string;
  ownerId: number;
  filePath: string | null;
  contentHash?: string;
}
