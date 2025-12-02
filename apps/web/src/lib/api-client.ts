/**
 * API 클라이언트
 * 백엔드 API 호출을 위한 래퍼
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/** API 에러 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public error?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 요청 옵션 */
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * 인증 토큰 가져오기
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

/**
 * 인증 토큰 저장
 */
export function setAuthToken(accessToken: string, refreshToken: string): void {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

/**
 * 인증 토큰 삭제
 */
export function clearAuthToken(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

/**
 * API 요청 함수
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const token = getAuthToken();
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.message || '요청 실패', data.error);
  }

  return data as T;
}

// ============================================
// Auth API
// ============================================

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  register: (email: string, password: string, name?: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password, name },
    }),

  refresh: (refreshToken: string) =>
    request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    }),

  me: () => request<AuthResponse['user']>('/auth/me'),
};

// ============================================
// Template API
// ============================================

export interface Template {
  id: string;
  name: string;
  cafeId: string;
  boardId: string;
  cafeName: string | null;
  boardName: string | null;
  subjectTemplate: string;
  contentTemplate: string;
  isActive: boolean;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const templateApi = {
  list: (page = 1, limit = 20) =>
    request<PaginatedResponse<Template>>(`/templates?page=${page}&limit=${limit}`),

  get: (id: string) => request<Template>(`/templates/${id}`),

  create: (data: Partial<Template>) =>
    request<Template>('/templates', { method: 'POST', body: data }),

  update: (id: string, data: Partial<Template>) =>
    request<Template>(`/templates/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) =>
    request<void>(`/templates/${id}`, { method: 'DELETE' }),

  postNow: (id: string, variables?: Record<string, string>) =>
    request<{ message: string; jobId: string }>(`/templates/${id}/post-now`, {
      method: 'POST',
      body: { variables },
    }),
};

// ============================================
// Schedule API
// ============================================

export interface Schedule {
  id: string;
  name: string;
  templateId: string;
  cronExpr: string | null;
  intervalMinutes: number | null;
  maxPostsPerDay: number;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  lastRunAt: string | null;
  nextRunAt: string | null;
  todayPostCount: number;
  createdAt: string;
  template?: {
    id: string;
    name: string;
    cafeId: string;
    boardId: string;
  };
}

export const scheduleApi = {
  list: (page = 1, limit = 20) =>
    request<PaginatedResponse<Schedule>>(`/schedules?page=${page}&limit=${limit}`),

  get: (id: string) => request<Schedule>(`/schedules/${id}`),

  create: (data: Partial<Schedule>) =>
    request<Schedule>('/schedules', { method: 'POST', body: data }),

  update: (id: string, data: Partial<Schedule>) =>
    request<Schedule>(`/schedules/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) =>
    request<void>(`/schedules/${id}`, { method: 'DELETE' }),

  toggle: (id: string, status: 'ACTIVE' | 'PAUSED') =>
    request<Schedule>(`/schedules/${id}/toggle`, {
      method: 'PATCH',
      body: { status },
    }),
};

// ============================================
// ManagedPost API
// ============================================

export interface ManagedPost {
  id: string;
  cafeId: string;
  boardId: string;
  articleId: string;
  articleUrl: string;
  title: string;
  status: 'ACTIVE' | 'DELETED' | 'UNKNOWN';
  createdAtRemote: string | null;
  lastSyncedAt: string;
  createdAt: string;
}

export const managedPostApi = {
  list: (params?: { page?: number; limit?: number; cafeId?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.cafeId) query.set('cafeId', params.cafeId);
    if (params?.status) query.set('status', params.status);
    return request<PaginatedResponse<ManagedPost>>(`/managed-posts?${query}`);
  },

  get: (id: string) => request<ManagedPost>(`/managed-posts/${id}`),

  sync: () =>
    request<{ message: string; jobId: string }>('/managed-posts/sync', {
      method: 'POST',
    }),

  stats: () =>
    request<{
      total: number;
      active: number;
      deleted: number;
      byCafe: Array<{ cafeId: string; count: number }>;
    }>('/managed-posts/stats/summary'),
};

// ============================================
// Job API
// ============================================

export interface Job {
  id: string;
  type: 'INIT_SESSION' | 'CREATE_POST' | 'SYNC_POSTS' | 'DELETE_POST';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface JobLog {
  id: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export const jobApi = {
  list: (params?: { page?: number; limit?: number; type?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.type) query.set('type', params.type);
    if (params?.status) query.set('status', params.status);
    return request<PaginatedResponse<Job>>(`/jobs?${query}`);
  },

  get: (id: string) => request<Job>(`/jobs/${id}`),

  logs: (id: string) => request<JobLog[]>(`/jobs/${id}/logs`),

  recentSummary: () =>
    request<{
      todayCount: number;
      recentJobs: Job[];
      byStatus: {
        pending: number;
        processing: number;
        completed: number;
        failed: number;
      };
    }>('/jobs/summary/recent'),
};

// ============================================
// NaverSession API
// ============================================

export interface NaverSession {
  id: string;
  naverId: string | null;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'ERROR';
  lastVerifiedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export const naverSessionApi = {
  list: () => request<NaverSession[]>('/naver-sessions'),

  get: (id: string) => request<NaverSession>(`/naver-sessions/${id}`),

  create: (naverId?: string) =>
    request<NaverSession>('/naver-sessions', {
      method: 'POST',
      body: { naverId },
    }),

  delete: (id: string) =>
    request<void>(`/naver-sessions/${id}`, { method: 'DELETE' }),

  reconnect: (id: string) =>
    request<NaverSession>(`/naver-sessions/${id}/reconnect`, {
      method: 'POST',
    }),
};




