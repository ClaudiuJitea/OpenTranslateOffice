export interface DocumentPipelineService {
  enqueueExtraction(jobId: string, documentId: string): Promise<void>;
  enqueueDraftReconstruction(jobId: string, sourceDocumentId: string): Promise<void>;
  enqueueFinalExport(
    jobId: string,
    sourceFamily: "pdf" | "doc" | "docx"
  ): Promise<{ outputDocumentVersionId: string }>;
}
