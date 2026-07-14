import type { DocumentCategory } from './enums';

export interface CommunityDocument {
  id: string;
  title: string;
  description: string | null;
  category: DocumentCategory;
  fileUrl: string;
  fileName: string;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  uploadedBy: { id: string; firstName: string; lastName: string };
}

export interface DocumentsPage {
  documents: CommunityDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
