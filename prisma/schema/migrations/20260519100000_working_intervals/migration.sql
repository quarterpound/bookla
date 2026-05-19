-- Replace `working_hours` (single start/end + one optional break) with
-- `working_intervals` (multiple work windows per (staff, day_of_week)).
-- Pre-production change: only seed/onboarding rows exist; we drop & recreate.

DROP TABLE IF EXISTS "working_hours" CASCADE;

CREATE TABLE "working_intervals" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "working_intervals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "working_intervals_staff_id_day_of_week_idx" ON "working_intervals"("staff_id", "day_of_week");

ALTER TABLE "working_intervals" ADD CONSTRAINT "working_intervals_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
