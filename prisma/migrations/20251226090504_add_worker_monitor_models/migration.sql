-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('QUEUE_BACKLOG', 'HIGH_FAILURE_RATE', 'WORKER_DOWN', 'SLOW_PROCESSING');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'ACKNOWLEDGED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'QUEUE_PAUSE';
ALTER TYPE "AuditAction" ADD VALUE 'QUEUE_RESUME';
ALTER TYPE "AuditAction" ADD VALUE 'QUEUE_DRAIN';
ALTER TYPE "AuditAction" ADD VALUE 'QUEUE_CLEAN';
ALTER TYPE "AuditAction" ADD VALUE 'QUEUE_RETRY_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_RETRY';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_CANCEL';
ALTER TYPE "AuditAction" ADD VALUE 'WORKER_ONLINE';
ALTER TYPE "AuditAction" ADD VALUE 'WORKER_OFFLINE';
ALTER TYPE "AuditAction" ADD VALUE 'INCIDENT_ACKNOWLEDGE';
ALTER TYPE "AuditAction" ADD VALUE 'INCIDENT_RESOLVE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'QUEUE';
ALTER TYPE "EntityType" ADD VALUE 'WORKER';
ALTER TYPE "EntityType" ADD VALUE 'INCIDENT';

-- CreateTable
CREATE TABLE "queue_stats_snapshots" (
    "id" TEXT NOT NULL,
    "queue_name" TEXT NOT NULL,
    "waiting" INTEGER NOT NULL DEFAULT 0,
    "active" INTEGER NOT NULL DEFAULT 0,
    "delayed" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "jobs_per_min" INTEGER,
    "online_workers" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_stats_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "queue_name" TEXT,
    "affected_jobs" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "recommended_action" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'ACTIVE',
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "queue_stats_snapshots_queue_name_timestamp_idx" ON "queue_stats_snapshots"("queue_name", "timestamp");

-- CreateIndex
CREATE INDEX "queue_stats_snapshots_timestamp_idx" ON "queue_stats_snapshots"("timestamp");

-- CreateIndex
CREATE INDEX "incidents_status_started_at_idx" ON "incidents"("status", "started_at");

-- CreateIndex
CREATE INDEX "incidents_type_idx" ON "incidents"("type");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_type_queue_name_status_key" ON "incidents"("type", "queue_name", "status");
