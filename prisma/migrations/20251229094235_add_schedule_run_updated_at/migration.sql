/*
  Warnings:

  - Added the required column `updated_at` to the `schedule_runs` table.
  - For existing rows, `updated_at` will be set to `triggered_at` value.

*/
-- AlterTable: Add column with default value first for existing rows
ALTER TABLE "schedule_runs" ADD COLUMN "updated_at" TIMESTAMP(3);

-- Update existing rows: set updated_at to triggered_at (or finished_at if available)
UPDATE "schedule_runs" 
SET "updated_at" = COALESCE("finished_at", "started_at", "triggered_at", NOW());

-- Now make the column NOT NULL
ALTER TABLE "schedule_runs" ALTER COLUMN "updated_at" SET NOT NULL;
