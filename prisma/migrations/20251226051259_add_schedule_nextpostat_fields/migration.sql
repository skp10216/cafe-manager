-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "next_post_at" TIMESTAMP(3),
ADD COLUMN     "today_posted_count" INTEGER NOT NULL DEFAULT 0;
