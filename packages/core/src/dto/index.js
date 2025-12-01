"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagedPostListQuerySchema = exports.JobListQuerySchema = exports.PaginationQuerySchema = exports.SyncPostsRequestSchema = exports.PostNowRequestSchema = exports.CreateNaverSessionRequestSchema = exports.ToggleScheduleRequestSchema = exports.UpdateScheduleRequestSchema = exports.CreateScheduleRequestSchema = exports.UpdateTemplateRequestSchema = exports.CreateTemplateRequestSchema = exports.AuthResponseSchema = exports.RegisterRequestSchema = exports.LoginRequestSchema = void 0;
const zod_1 = require("zod");
exports.LoginRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email('올바른 이메일 형식을 입력하세요'),
    password: zod_1.z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
});
exports.RegisterRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email('올바른 이메일 형식을 입력하세요'),
    password: zod_1.z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
    name: zod_1.z.string().min(2, '이름은 최소 2자 이상이어야 합니다').optional(),
});
exports.AuthResponseSchema = zod_1.z.object({
    accessToken: zod_1.z.string(),
    refreshToken: zod_1.z.string(),
    user: zod_1.z.object({
        id: zod_1.z.string(),
        email: zod_1.z.string(),
        name: zod_1.z.string().nullable(),
    }),
});
exports.CreateTemplateRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '템플릿 이름을 입력하세요').max(100),
    cafeId: zod_1.z.string().min(1, '카페 ID를 입력하세요'),
    boardId: zod_1.z.string().min(1, '게시판 ID를 입력하세요'),
    cafeName: zod_1.z.string().optional(),
    boardName: zod_1.z.string().optional(),
    subjectTemplate: zod_1.z.string().min(1, '제목 템플릿을 입력하세요').max(200),
    contentTemplate: zod_1.z.string().min(1, '본문 템플릿을 입력하세요'),
});
exports.UpdateTemplateRequestSchema = exports.CreateTemplateRequestSchema.partial();
exports.CreateScheduleRequestSchema = zod_1.z.object({
    templateId: zod_1.z.string().min(1, '템플릿을 선택하세요'),
    name: zod_1.z.string().min(1, '스케줄 이름을 입력하세요').max(100),
    cronExpr: zod_1.z.string().optional(),
    intervalMinutes: zod_1.z.number().min(1).optional(),
    maxPostsPerDay: zod_1.z.number().min(1).max(100).default(10),
});
exports.UpdateScheduleRequestSchema = exports.CreateScheduleRequestSchema.partial();
exports.ToggleScheduleRequestSchema = zod_1.z.object({
    status: zod_1.z.enum(['ACTIVE', 'PAUSED']),
});
exports.CreateNaverSessionRequestSchema = zod_1.z.object({
    naverId: zod_1.z.string().optional(),
});
exports.PostNowRequestSchema = zod_1.z.object({
    templateId: zod_1.z.string().min(1),
    variables: zod_1.z.record(zod_1.z.string()).optional(),
});
exports.SyncPostsRequestSchema = zod_1.z.object({
    cafeId: zod_1.z.string().min(1),
});
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().min(1).default(1),
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
});
exports.JobListQuerySchema = exports.PaginationQuerySchema.extend({
    type: zod_1.z.enum(['INIT_SESSION', 'CREATE_POST', 'SYNC_POSTS', 'DELETE_POST']).optional(),
    status: zod_1.z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
});
exports.ManagedPostListQuerySchema = exports.PaginationQuerySchema.extend({
    cafeId: zod_1.z.string().optional(),
    boardId: zod_1.z.string().optional(),
    status: zod_1.z.enum(['ACTIVE', 'DELETED', 'UNKNOWN']).optional(),
});
//# sourceMappingURL=index.js.map