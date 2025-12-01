# 카페매니저 (CafeManager)

네이버 카페 자동 포스팅 & 게시글 관리 SaaS 솔루션

## 프로젝트 개요

- **Frontend**: Next.js 14 (App Router) + MUI + TypeScript
- **Backend**: NestJS + Prisma + PostgreSQL
- **Worker**: Node.js + BullMQ + Playwright
- **공통**: Monorepo (pnpm workspace)

## 주요 기능 (MVP)

1. **네이버 계정 연동**: Playwright 기반 세션 관리
2. **템플릿 관리**: 게시글 템플릿 CRUD, 변수 치환
3. **스케줄 포스팅**: cron/간격 기반 자동 포스팅
4. **게시글 동기화**: "내가 쓴 글" 목록 크롤링
5. **작업 로그**: Job 실행 내역 및 에러 확인

## 폴더 구조

```
cafe-manager/
├── apps/
│   ├── api/          # NestJS 백엔드 API
│   ├── web/          # Next.js 프론트엔드
│   └── worker/       # Playwright 워커
├── packages/
│   └── core/         # 공통 타입, DTO, 상수
├── prisma/
│   └── schema.prisma # 데이터베이스 스키마
└── README.md
```

## 로컬 개발 환경 설정

### 1. 사전 요구사항

- Node.js 18+
- pnpm 8+
- PostgreSQL 15+
- Redis 7+

### 2. 의존성 설치

```bash
pnpm install
```

### 3. 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성하세요:

```env
# 데이터베이스
DATABASE_URL="postgresql://postgres:password@localhost:5432/cafe_manager?schema=public"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"

# JWT
JWT_SECRET="your-jwt-secret-key"
JWT_EXPIRES_IN="1d"
JWT_REFRESH_SECRET="your-refresh-secret-key"
JWT_REFRESH_EXPIRES_IN="7d"

# API
API_PORT="3001"
API_PREFIX="/api"

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3001/api"

# Worker
NAVER_PROFILE_DIR="./playwright-profiles"
SCREENSHOT_DIR="./screenshots"
PLAYWRIGHT_HEADLESS="false"
```

### 4. 데이터베이스 설정

```bash
# Prisma 클라이언트 생성
pnpm db:generate

# 데이터베이스 마이그레이션
pnpm db:push
```

### 5. 개발 서버 실행

각각 별도의 터미널에서 실행:

```bash
# API 서버 (포트 3001)
pnpm dev:api

# 프론트엔드 (포트 3000)
pnpm dev:web

# Worker (Job 처리)
pnpm dev:worker
```

## API 엔드포인트

### 인증 (Auth)
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/refresh` - 토큰 갱신
- `GET /api/auth/me` - 현재 사용자 정보

### 템플릿 (Templates)
- `GET /api/templates` - 목록 조회
- `GET /api/templates/:id` - 상세 조회
- `POST /api/templates` - 생성
- `PATCH /api/templates/:id` - 수정
- `DELETE /api/templates/:id` - 삭제
- `POST /api/templates/:id/post-now` - 즉시 게시

### 스케줄 (Schedules)
- `GET /api/schedules` - 목록 조회
- `GET /api/schedules/:id` - 상세 조회
- `POST /api/schedules` - 생성
- `PATCH /api/schedules/:id` - 수정
- `DELETE /api/schedules/:id` - 삭제
- `PATCH /api/schedules/:id/toggle` - 활성화/비활성화

### 게시글 (ManagedPosts)
- `GET /api/managed-posts` - 목록 조회
- `GET /api/managed-posts/:id` - 상세 조회
- `POST /api/managed-posts/sync` - 동기화 요청
- `GET /api/managed-posts/stats/summary` - 통계

### 작업 (Jobs)
- `GET /api/jobs` - 목록 조회
- `GET /api/jobs/:id` - 상세 조회
- `GET /api/jobs/:id/logs` - 로그 조회
- `GET /api/jobs/summary/recent` - 최근 요약

### 네이버 세션 (NaverSessions)
- `GET /api/naver-sessions` - 목록 조회
- `POST /api/naver-sessions` - 연동 시작
- `DELETE /api/naver-sessions/:id` - 연동 해제
- `POST /api/naver-sessions/:id/reconnect` - 재연동

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14, React 18, MUI 5, react-hook-form, Zod |
| Backend | NestJS 10, Prisma 5, PostgreSQL, JWT |
| Worker | BullMQ, Playwright, Redis |
| 공통 | TypeScript, pnpm workspace |

## 라이선스

Private - All rights reserved

