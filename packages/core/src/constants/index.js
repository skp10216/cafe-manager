"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NAVER_CAFE_URLS = exports.HTTP_STATUS = exports.DEFAULT_PAGINATION = exports.MANAGED_POST_STATUS = exports.DEFAULT_MAX_POSTS_PER_DAY = exports.SCHEDULE_STATUS = exports.NAVER_SESSION_STATUS = exports.QUEUE_NAMES = exports.DEFAULT_JOB_MAX_ATTEMPTS = exports.JOB_STATUS = exports.JOB_TYPES = void 0;
exports.JOB_TYPES = {
    INIT_SESSION: 'INIT_SESSION',
    CREATE_POST: 'CREATE_POST',
    SYNC_POSTS: 'SYNC_POSTS',
    DELETE_POST: 'DELETE_POST',
};
exports.JOB_STATUS = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
};
exports.DEFAULT_JOB_MAX_ATTEMPTS = 3;
exports.QUEUE_NAMES = {
    CAFE_JOBS: 'cafe-jobs',
};
exports.NAVER_SESSION_STATUS = {
    PENDING: 'PENDING',
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
    ERROR: 'ERROR',
};
exports.SCHEDULE_STATUS = {
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    ERROR: 'ERROR',
};
exports.DEFAULT_MAX_POSTS_PER_DAY = 10;
exports.MANAGED_POST_STATUS = {
    ACTIVE: 'ACTIVE',
    DELETED: 'DELETED',
    UNKNOWN: 'UNKNOWN',
};
exports.DEFAULT_PAGINATION = {
    PAGE: 1,
    LIMIT: 20,
    MAX_LIMIT: 100,
};
exports.HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
};
exports.NAVER_CAFE_URLS = {
    BASE: 'https://cafe.naver.com',
    LOGIN: 'https://nid.naver.com/nidlogin.login',
    MY_POSTS: (cafeId) => `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles/mine`,
    WRITE: (cafeId, boardId) => `https://cafe.naver.com/ca-fe/cafes/${cafeId}/menus/${boardId}/articles/write`,
};
//# sourceMappingURL=index.js.map