import { apiFetch } from './client';
import type { CommunityDocument, DocumentsPage } from '@/types/documents';

export function listDocuments(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<DocumentsPage>(`/api/documents${qs}`);
}

export function getDocument(id: string) {
  return apiFetch<CommunityDocument>(`/api/documents/${id}`);
}

export function getDocumentDownloadUrl(id: string) {
  return apiFetch<{ url: string; fileName: string }>(`/api/documents/${id}/download`);
}
