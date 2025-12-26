-- CreateEnum
CREATE TYPE "ScheduleRunType" AS ENUM ('IMMEDIATE', 'SCHEDULED');

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "schedule_type" "ScheduleRunType" NOT NULL DEFAULT 'SCHEDULED',
ALTER COLUMN "runTime" SET DEFAULT '09:00';
