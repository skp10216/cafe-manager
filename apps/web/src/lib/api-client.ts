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
 * Refresh 토큰 가져오기
 */
function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
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
 * Refresh 동시 호출 방지용(한 번에 하나만 갱신)
 */
let refreshInFlight: Promise<AuthResponse> | null = null;

function getErrorMessageFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const maybe = body as { message?: unknown };
  return typeof maybe.message === 'string' ? maybe.message : undefined;
}

/**
 * 토큰 갱신
 * - 401 발생 시 자동으로 refresh 후 원요청을 1회 재시도하기 위해 사용
 */
async function refreshTokens(): Promise<AuthResponse> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new ApiError(401, '인증이 필요합니다');
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = (await res.json()) as AuthResponse;
      if (!res.ok) {
        throw new ApiError(res.status, getErrorMessageFromBody(data) || '인증이 만료되었습니다');
      }

      setAuthToken(data.accessToken, data.refreshToken);
      return data;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

/**
 * API 요청 함수
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
  retryOnce = true
): Promise<T> {
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

  // 일부 에러 응답/프록시 문제로 JSON 파싱이 실패할 수 있어 방어적으로 처리
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    // 인증 만료/토큰 누락 케이스: refresh 후 원요청 1회 재시도
    // - 로그인/회원가입/리프레시는 예외로 둔다(무한 루프 방지)
    const isAuthEndpoint =
      endpoint.startsWith('/auth/login') ||
      endpoint.startsWith('/auth/register') ||
      endpoint.startsWith('/auth/refresh');

    if (response.status === 401 && retryOnce && !isAuthEndpoint) {
      try {
        await refreshTokens();
        return request<T>(endpoint, options, false);
      } catch (refreshErr) {
        // refresh 실패 시 토큰 정리(다음 동작에서 로그인 유도)
        clearAuthToken();
        if (refreshErr instanceof ApiError) throw refreshErr;
        throw new ApiError(401, '인증이 만료되었습니다. 다시 로그인해주세요.');
      }
    }

    const body = data as { message?: unknown; error?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message : '요청 실패';
    const errorCode = typeof body?.error === 'string' ? body.error : undefined;
    throw new ApiError(response.status, message, errorCode);
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

  delete: (id: string) => request<void>(`/templates/${id}`, { method: 'DELETE' }),

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

  delete: (id: string) => request<void>(`/schedules/${id}`, { method: 'DELETE' }),

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
  type: 'INIT_SESSION' | 'VERIFY_SESSION' | 'CREATE_POST' | 'SYNC_POSTS' | 'DELETE_POST';
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
// NaverAccount API (네이버 계정 - 로그인 자격 증명)
// ============================================

export interface NaverAccount {
  id: string;
  loginId: string;
  displayName: string | null;
  status: 'ACTIVE' | 'LOGIN_FAILED' | 'DISABLED';
  lastLoginAt: string | null;
  lastLoginStatus: string | null;
  lastLoginError: string | null;
  createdAt: string;
  sessions?: Array<{
    id: string;
    status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'ERROR';
    lastVerifiedAt: string | null;
  }>;
}

export const naverAccountApi = {
  /** 내 네이버 계정 목록 조회 */
  list: () => request<NaverAccount[]>('/naver-accounts'),

  /** 네이버 계정 상세 조회 */
  get: (id: string) => request<NaverAccount>(`/naver-accounts/${id}`),

  /** 새 네이버 계정 등록 */
  create: (data: { loginId: string; password: string; displayName?: string }) =>
    request<NaverAccount>('/naver-accounts', {
      method: 'POST',
      body: data,
    }),

  /** 네이버 계정 수정 */
  update: (id: string, data: { password?: string; displayName?: string }) =>
    request<NaverAccount>(`/naver-accounts/${id}`, {
      method: 'PATCH',
      body: data,
    }),

  /** 네이버 계정 삭제 */
  delete: (id: string) => request<void>(`/naver-accounts/${id}`, { method: 'DELETE' }),
};

// ============================================
// NaverSession API (브라우저 세션)
// ============================================

export interface NaverSession {
  id: string;
  naverAccountId: string;
  profileDir: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'ERROR';
  lastVerifiedAt: string | null;
  errorMessage: string | null;
  naverNickname: string | null; // 검증된 네이버 닉네임
  createdAt: string;
  naverAccount?: {
    id: string;
    loginId: string;
    displayName: string | null;
    status: string;
  };
}

export const naverSessionApi = {
  /** 내 네이버 세션 목록 조회 */
  list: () => request<NaverSession[]>('/naver-sessions'),

  /** 네이버 세션 상세 조회 */
  get: (id: string) => request<NaverSession>(`/naver-sessions/${id}`),

  /** 새 네이버 세션 연동 시작 (NaverAccount ID 필수) */
  create: (naverAccountId: string) =>
    request<NaverSession>('/naver-sessions', {
      method: 'POST',
      body: { naverAccountId },
    }),

  /** 네이버 세션 삭제 */
  delete: (id: string) => request<void>(`/naver-sessions/${id}`, { method: 'DELETE' }),

  /** 네이버 세션 재연동 */
  reconnect: (id: string) =>
    request<NaverSession>(`/naver-sessions/${id}/reconnect`, {
      method: 'POST',
    }),

  /** 네이버 세션 검증 (로그인 상태 + 닉네임 확인) */
  verify: (id: string) =>
    request<{ message: string; sessionId: string }>(`/naver-sessions/${id}/verify`, {
      method: 'POST',
    }),
};

// ============================================
// Naver OAuth API (공식 네이버 로그인 기반 연결)
// ============================================

export interface NaverOAuthAccount {
  id: string;
  naverUserId: string;
  email: string | null;
  nickname: string | null;
  name: string | null;
  profileImageUrl: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string;
  updatedAt: string;
}

export const naverOauthApi = {
  /** OAuth 연결 시작을 위한 authorize URL 가져오기 */
  authorizeUrl: () => request<{ url: string }>('/naver-oauth/authorize-url'),

  /** 내 OAuth 연결 계정 목록 */
  list: () => request<NaverOAuthAccount[]>('/naver-oauth/accounts'),

  /** 토큰 갱신 (refresh_token grant) */
  refresh: (id: string) =>
    request<{ ok: boolean; tokenExpiresAt: string | null }>(`/naver-oauth/accounts/${id}/refresh`, {
      method: 'POST',
    }),

  /** 프로필 동기화 (닉네임/이메일 최신화) */
  syncProfile: (id: string) =>
    request<{ ok: boolean }>(`/naver-oauth/accounts/${id}/sync-profile`, {
      method: 'POST',
    }),

  /** 연결 해제 */
  disconnect: (id: string) =>
    request<{ ok: boolean }>(`/naver-oauth/accounts/${id}`, { method: 'DELETE' }),
};
