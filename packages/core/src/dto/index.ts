/**
 * 공통 DTO (Data Transfer Object) 정의
 * Zod 스키마를 사용하여 프론트엔드/백엔드 검증 공유
 */

import { z } from 'zod';

// ============================================
// 인증 관련 DTO
// ============================================

/** 로그인 요청 */
export const LoginRequestSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력하세요'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** 회원가입 요청 */
export const RegisterRequestSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력하세요'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다').optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/** 인증 응답 */
export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
  }),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ============================================
// 템플릿 관련 DTO
// ============================================

/** 템플릿 생성 요청 */
export const CreateTemplateRequestSchema = z.object({
  name: z.string().min(1, '템플릿 이름을 입력하세요').max(100),
  cafeId: z.string().min(1, '카페 ID를 입력하세요'),
  boardId: z.string().min(1, '게시판 ID를 입력하세요'),
  cafeName: z.string().optional(),
  boardName: z.string().optional(),
  subjectTemplate: z.string().min(1, '제목 템플릿을 입력하세요').max(200),
  contentTemplate: z.string().min(1, '본문 템플릿을 입력하세요'),
});
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;

/** 템플릿 수정 요청 */
export const UpdateTemplateRequestSchema = CreateTemplateRequestSchema.partial();
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequestSchema>;

// ============================================
// 스케줄 관련 DTO
// ============================================

/** 스케줄 생성 요청 */
export const CreateScheduleRequestSchema = z.object({
  templateId: z.string().min(1, '템플릿을 선택하세요'),
  name: z.string().min(1, '스케줄 이름을 입력하세요').max(100),
  cronExpr: z.string().optional(),
  intervalMinutes: z.number().min(1).optional(),
  maxPostsPerDay: z.number().min(1).max(100).default(10),
});
export type CreateScheduleRequest = z.infer<typeof CreateScheduleRequestSchema>;

/** 스케줄 수정 요청 */
export const UpdateScheduleRequestSchema = CreateScheduleRequestSchema.partial();
export type UpdateScheduleRequest = z.infer<typeof UpdateScheduleRequestSchema>;

/** 스케줄 상태 토글 요청 */
export const ToggleScheduleRequestSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED']),
});
export type ToggleScheduleRequest = z.infer<typeof ToggleScheduleRequestSchema>;

// ============================================
// 네이버 세션 관련 DTO
// ============================================

/** 네이버 세션 생성 요청 */
export const CreateNaverSessionRequestSchema = z.object({
  naverId: z.string().optional(),
});
export type CreateNaverSessionRequest = z.infer<typeof CreateNaverSessionRequestSchema>;

// ============================================
// Job 관련 DTO
// ============================================

/** 즉시 게시 요청 */
export const PostNowRequestSchema = z.object({
  templateId: z.string().min(1),
  variables: z.record(z.string()).optional(),
});
export type PostNowRequest = z.infer<typeof PostNowRequestSchema>;

/** 게시글 동기화 요청 */
export const SyncPostsRequestSchema = z.object({
  cafeId: z.string().min(1),
});
export type SyncPostsRequest = z.infer<typeof SyncPostsRequestSchema>;

// ============================================
// 공통 쿼리 DTO
// ============================================

/** 페이지네이션 쿼리 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/** Job 목록 쿼리 */
export const JobListQuerySchema = PaginationQuerySchema.extend({
  type: z.enum(['INIT_SESSION', 'CREATE_POST', 'SYNC_POSTS', 'DELETE_POST']).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
});
export type JobListQuery = z.infer<typeof JobListQuerySchema>;

/** 게시글 목록 쿼리 */
export const ManagedPostListQuerySchema = PaginationQuerySchema.extend({
  cafeId: z.string().optional(),
  boardId: z.string().optional(),
  status: z.enum(['ACTIVE', 'DELETED', 'UNKNOWN']).optional(),
});
export type ManagedPostListQuery = z.infer<typeof ManagedPostListQuerySchema>;

