// types/file.ts
export type FileType = 'document' | 'image';

// Server-side file interface matching backend WorkflowFile
export interface WorkflowFile {
  id: string;
  fileName: string;
  originalFileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  workflowId: string;
  workflow?: {
    id: string;
    name: string;
  };
  createdUser?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

// Client-side file interface for upload preview (before server upload)
export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: FileType;
  fileType: string; // e.g., "application/pdf", "image/png"
  url: string;      // data URL or blob URL for preview
  uploadedAt: string;
}