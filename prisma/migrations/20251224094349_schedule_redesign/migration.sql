-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "NaverAccountStatus" AS ENUM ('ACTIVE', 'LOGIN_FAILED', 'DISABLED');

-- CreateEnum
CREATE TYPE "NaverSessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "TradeMethod" AS ENUM ('DIRECT', 'DELIVERY', 'BOTH');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ManagedPostStatus" AS ENUM ('ACTIVE', 'DELETED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('INIT_SESSION', 'VERIFY_SESSION', 'CREATE_POST', 'SYNC_POSTS', 'DELETE_POST');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobLogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "PostRuleType" AS ENUM ('MAX_COUNT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "plan_type" "PlanType",
    "expire_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naver_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "login_id" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "display_name" TEXT,
    "status" "NaverAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "last_login_status" TEXT,
    "last_login_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naver_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naver_sessions" (
    "id" TEXT NOT NULL,
    "naver_account_id" TEXT NOT NULL,
    "profile_dir" TEXT NOT NULL,
    "status" "NaverSessionStatus" NOT NULL DEFAULT 'PENDING',
    "last_verified_at" TIMESTAMP(3),
    "error_message" TEXT,
    "naver_nickname" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naver_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naver_oauth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "naver_user_id" TEXT NOT NULL,
    "email" TEXT,
    "nickname" TEXT,
    "name" TEXT,
    "profile_image_url" TEXT,
    "access_token_encrypted" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT,
    "token_type" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naver_oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naver_oauth_states" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "naver_oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cafe_id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "cafe_name" TEXT,
    "board_name" TEXT,
    "subject_template" TEXT NOT NULL,
    "content_template" TEXT NOT NULL,
    "variables" JSONB DEFAULT '[]',
    "price" INTEGER,
    "trade_method" "TradeMethod",
    "trade_location" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_images" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "runTime" TEXT NOT NULL,
    "daily_post_count" INTEGER NOT NULL DEFAULT 10,
    "post_interval_minutes" INTEGER NOT NULL DEFAULT 5,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PAUSED',
    "last_run_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_runs" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "run_date" TIMESTAMP(3) NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "total_jobs" INTEGER NOT NULL DEFAULT 0,
    "completed_jobs" INTEGER NOT NULL DEFAULT 0,
    "failed_jobs" INTEGER NOT NULL DEFAULT 0,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "schedule_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managed_posts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cafe_id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "article_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ManagedPostStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at_remote" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managed_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "user_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "schedule_run_id" TEXT,
    "sequence_number" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_logs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "level" "JobLogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cafe_id" TEXT NOT NULL,
    "board_id" TEXT,
    "type" "PostRuleType" NOT NULL,
    "value" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "naver_accounts_user_id_idx" ON "naver_accounts"("user_id");

-- CreateIndex
CREATE INDEX "naver_sessions_naver_account_id_idx" ON "naver_sessions"("naver_account_id");

-- CreateIndex
CREATE INDEX "naver_oauth_accounts_user_id_idx" ON "naver_oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "naver_oauth_accounts_user_id_naver_user_id_key" ON "naver_oauth_accounts"("user_id", "naver_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "naver_oauth_states_state_key" ON "naver_oauth_states"("state");

-- CreateIndex
CREATE INDEX "naver_oauth_states_user_id_idx" ON "naver_oauth_states"("user_id");

-- CreateIndex
CREATE INDEX "naver_oauth_states_expires_at_idx" ON "naver_oauth_states"("expires_at");

-- CreateIndex
CREATE INDEX "templates_user_id_idx" ON "templates"("user_id");

-- CreateIndex
CREATE INDEX "templates_cafe_id_board_id_idx" ON "templates"("cafe_id", "board_id");

-- CreateIndex
CREATE INDEX "template_images_template_id_idx" ON "template_images"("template_id");

-- CreateIndex
CREATE INDEX "template_images_template_id_order_idx" ON "template_images"("template_id", "order");

-- CreateIndex
CREATE INDEX "schedules_user_id_idx" ON "schedules"("user_id");

-- CreateIndex
CREATE INDEX "schedules_template_id_idx" ON "schedules"("template_id");

-- CreateIndex
CREATE INDEX "schedules_status_runTime_idx" ON "schedules"("status", "runTime");

-- CreateIndex
CREATE INDEX "schedule_runs_user_id_idx" ON "schedule_runs"("user_id");

-- CreateIndex
CREATE INDEX "schedule_runs_run_date_idx" ON "schedule_runs"("run_date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_runs_schedule_id_run_date_key" ON "schedule_runs"("schedule_id", "run_date");

-- CreateIndex
CREATE INDEX "managed_posts_user_id_idx" ON "managed_posts"("user_id");

-- CreateIndex
CREATE INDEX "managed_posts_cafe_id_board_id_idx" ON "managed_posts"("cafe_id", "board_id");

-- CreateIndex
CREATE INDEX "managed_posts_status_idx" ON "managed_posts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "managed_posts_cafe_id_article_id_key" ON "managed_posts"("cafe_id", "article_id");

-- CreateIndex
CREATE INDEX "jobs_user_id_idx" ON "jobs"("user_id");

-- CreateIndex
CREATE INDEX "jobs_type_status_idx" ON "jobs"("type", "status");

-- CreateIndex
CREATE INDEX "jobs_created_at_idx" ON "jobs"("created_at");

-- CreateIndex
CREATE INDEX "jobs_schedule_run_id_idx" ON "jobs"("schedule_run_id");

-- CreateIndex
CREATE INDEX "job_logs_job_id_idx" ON "job_logs"("job_id");

-- CreateIndex
CREATE INDEX "job_logs_created_at_idx" ON "job_logs"("created_at");

-- CreateIndex
CREATE INDEX "post_rules_user_id_idx" ON "post_rules"("user_id");

-- CreateIndex
CREATE INDEX "post_rules_cafe_id_board_id_idx" ON "post_rules"("cafe_id", "board_id");

-- AddForeignKey
ALTER TABLE "naver_accounts" ADD CONSTRAINT "naver_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "naver_sessions" ADD CONSTRAINT "naver_sessions_naver_account_id_fkey" FOREIGN KEY ("naver_account_id") REFERENCES "naver_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "naver_oauth_accounts" ADD CONSTRAINT "naver_oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "naver_oauth_states" ADD CONSTRAINT "naver_oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_images" ADD CONSTRAINT "template_images_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_runs" ADD CONSTRAINT "schedule_runs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_runs" ADD CONSTRAINT "schedule_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managed_posts" ADD CONSTRAINT "managed_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_schedule_run_id_fkey" FOREIGN KEY ("schedule_run_id") REFERENCES "schedule_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
