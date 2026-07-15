import { apiFetch } from './client';
import type { Property, CreatePropertyInput } from '@/types/community';

export function listProperties(userId: string) {
  return apiFetch<Property[]>(`/api/properties?userId=${userId}`);
}

export function createProperty(input: CreatePropertyInput) {
  return apiFetch<Property>('/api/properties', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteProperty(id: string) {
  return apiFetch<{ deleted: true }>(`/api/properties/${id}`, { method: 'DELETE' });
}
