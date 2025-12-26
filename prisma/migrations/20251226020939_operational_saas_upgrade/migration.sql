/*
  Warnings:

  - The `status` column on the `naver_sessions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING', 'HEALTHY', 'EXPIRING', 'EXPIRED', 'CHALLENGE_REQUIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('NEEDS_REVIEW', 'APPROVED', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "BlockCode" AS ENUM ('USER_DISABLED', 'ADMIN_NOT_APPROVED', 'ADMIN_SUSPENDED', 'ADMIN_BANNED', 'SESSION_EXPIRED', 'SESSION_CHALLENGE', 'SESSION_ERROR', 'DAILY_LIMIT', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "RunMode" AS ENUM ('HEADLESS', 'DEBUG');

-- CreateEnum
CREATE TYPE "ErrorCode" AS ENUM ('AUTH_EXPIRED', 'AUTH_INVALID', 'CHALLENGE_REQUIRED', 'LOGIN_FAILED', 'PERMISSION_DENIED', 'CAFE_NOT_FOUND', 'RATE_LIMIT', 'DAILY_LIMIT', 'UI_CHANGED', 'UPLOAD_FAILED', 'NETWORK_ERROR', 'TIMEOUT', 'BROWSER_ERROR', 'VALIDATION_ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('ADMIN', 'USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('USER', 'SCHEDULE', 'SESSION', 'TEMPLATE', 'JOB', 'POLICY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('SCHEDULE_APPROVE', 'SCHEDULE_SUSPEND', 'SCHEDULE_BAN', 'SCHEDULE_UNSUSPEND', 'SCHEDULE_TOGGLE', 'USER_SUSPEND', 'USER_BAN', 'USER_UNSUSPEND', 'SESSION_INVALIDATE', 'SESSION_RECONNECT', 'POLICY_UPDATE', 'AUTO_SUSPEND');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobStatus" ADD VALUE 'QUEUED';
ALTER TYPE "JobStatus" ADD VALUE 'SKIPPED';
ALTER TYPE "JobStatus" ADD VALUE 'BLOCKED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RunStatus" ADD VALUE 'QUEUED';
ALTER TYPE "RunStatus" ADD VALUE 'SKIPPED';
ALTER TYPE "RunStatus" ADD VALUE 'BLOCKED';

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "error_code" "ErrorCode",
ADD COLUMN     "html_path" TEXT,
ADD COLUMN     "run_mode" "RunMode" NOT NULL DEFAULT 'HEADLESS',
ADD COLUMN     "screenshot_path" TEXT;

-- AlterTable
ALTER TABLE "naver_sessions" ADD COLUMN     "error_code" "ErrorCode",
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "last_checked_at" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "SessionStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "schedule_runs" ADD COLUMN     "block_code" "BlockCode",
ADD COLUMN     "block_reason" TEXT,
ADD COLUMN     "skipped_jobs" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "admin_reason" TEXT,
ADD COLUMN     "admin_status" "AdminStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by" TEXT,
ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
ADD COLUMN     "user_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- DropEnum
DROP TYPE "NaverSessionStatus";

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_type" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actor_email" TEXT,
    "target_user_id" TEXT,
    "target_email" TEXT,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "reason" TEXT,
    "previous_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_user_id_idx" ON "audit_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "policies_key_key" ON "policies"("key");

-- CreateIndex
CREATE INDEX "jobs_error_code_idx" ON "jobs"("error_code");

-- CreateIndex
CREATE INDEX "naver_sessions_status_idx" ON "naver_sessions"("status");

-- CreateIndex
CREATE INDEX "schedule_runs_status_idx" ON "schedule_runs"("status");

-- CreateIndex
CREATE INDEX "schedules_user_enabled_admin_status_idx" ON "schedules"("user_enabled", "admin_status");
