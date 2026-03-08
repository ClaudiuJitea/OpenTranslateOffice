export interface AIProvider {
  draftTranslation(input: {
    jobId: string;
    sourceDocVersionId: string;
  }): Promise<{ runId: string }>;

  qualityCheck(input: {
    jobId: string;
    draftDocVersionId: string;
  }): Promise<{ issues: number }>;

  extractTerminology(input: {
    jobId: string;
    docVersionId: string;
  }): Promise<{
    terms: Array<{ source: string; target?: string; confidence: number }>;
  }>;
}
