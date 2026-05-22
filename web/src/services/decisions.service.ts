/**
 * Decision-Making System API Client
 * Handles all API calls to /api/decisions endpoints
 */

import { apiFetch } from '@/lib/apiFetch';
import { refreshTokenRequest } from '@/services/auth.service';
import type { Decision, DecisionFilters, ReviewDecisionRequest, ReviewDecisionResponse, ListDecisionsResponse, AnalyzeDecisionsResponse } from './decisions-types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string;
const API_BASE = `${BACKEND_URL}/api/decisions`;

const TOKEN_KEY = 'auth_token';

function buildAuthHeaders(token?: string): { skipAuth: true; headers: { Authorization: string } } | {} {
  if (!token) return {};
  return { skipAuth: true, headers: { Authorization: `Bearer ${token}` } };
}

async function parseApiError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return `Lỗi ${response.status}`;

  try {
    const parsed = JSON.parse(text) as { message?: string };
    return parsed.message || `Lỗi ${response.status}`;
  } catch {
    return `Lỗi ${response.status}: ${text.slice(0, 200)}`;
  }
}

async function callWithAuthRetry(url: string, init: RequestInit, token?: string): Promise<Response> {
  const initialToken = token || localStorage.getItem(TOKEN_KEY) || undefined;

  let response = await apiFetch(url, {
    ...init,
    ...buildAuthHeaders(initialToken),
  });

  if (response.status !== 401) return response;

  // Token có thể đã hết hạn: thử refresh bằng cookie HttpOnly rồi retry 1 lần
  const newToken = await refreshTokenRequest();
  if (!newToken) return response;

  localStorage.setItem(TOKEN_KEY, newToken);

  response = await apiFetch(url, {
    ...init,
    ...buildAuthHeaders(newToken),
  });

  return response;
}

/**
 * Trigger analysis and get current recommendations
 */
export async function analyzeDecisions(filters?: {
  cameras?: string;
  time_window?: '24h' | '48h' | '7d';
  category?: string;
  limit?: number;
}): Promise<AnalyzeDecisionsResponse> {
  const params = new URLSearchParams();
  if (filters?.cameras) params.append('cameras', filters.cameras);
  if (filters?.time_window) params.append('time_window', filters.time_window);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const response = await apiFetch(`${API_BASE}/analyze?${params.toString()}`, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`Failed to analyze decisions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get list of decisions with pagination and filters
 */
export async function listDecisions(filters?: DecisionFilters): Promise<ListDecisionsResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.sort_by) params.append('sort_by', filters.sort_by);
  if (filters?.sort_order) params.append('sort_order', filters.sort_order);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const response = await apiFetch(`${API_BASE}?${params.toString()}`, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`Failed to list decisions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get single decision by ID
 */
export async function getDecisionById(id: string): Promise<Decision> {
  const response = await apiFetch(`${API_BASE}/${id}`, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`Failed to get decision: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get decision history for a specific camera
 */
export async function getDecisionHistory(cameraId: string, limit = 50): Promise<Decision[]> {
  const response = await apiFetch(`${API_BASE}/camera/${cameraId}?limit=${limit}`, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`Failed to get decision history: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Review a decision and provide feedback
 */
export async function reviewDecision(id: string, request: ReviewDecisionRequest, token?: string): Promise<ReviewDecisionResponse> {
  const response = await callWithAuthRetry(`${API_BASE}/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(request),
  }, token);

  if (!response.ok) {
    const message = await parseApiError(response);
    throw new Error(message);
  }

  return response.json();
}

/**
 * Mark a decision as implemented
 */
export async function implementDecision(id: string, implementation_details?: string, token?: string): Promise<ReviewDecisionResponse> {
  const response = await callWithAuthRetry(`${API_BASE}/${id}/implement`, {
    method: 'POST',
    body: JSON.stringify({ implementation_details }),
  }, token);

  if (!response.ok) {
    const message = await parseApiError(response);
    throw new Error(message);
  }

  return response.json();
}

/**
 * Dismiss a decision
 */
export async function dismissDecision(id: string, token?: string): Promise<ReviewDecisionResponse> {
  const response = await callWithAuthRetry(`${API_BASE}/${id}`, {
    method: 'DELETE',
  }, token);

  if (!response.ok) {
    const message = await parseApiError(response);
    throw new Error(message);
  }

  return response.json();
}

/**
 * Create a decision manually (technician only)
 */
export async function createDecision(decision: Partial<Decision>): Promise<ReviewDecisionResponse> {
  const response = await apiFetch(`${API_BASE}/create`, {
    method: 'POST',
    body: JSON.stringify(decision),
  });

  if (!response.ok) {
    throw new Error(`Failed to create decision: ${response.statusText}`);
  }

  return response.json();
}
