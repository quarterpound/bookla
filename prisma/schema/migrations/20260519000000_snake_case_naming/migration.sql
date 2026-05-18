-- Rename all tables, columns, enum types, indexes, and constraints to snake_case.
-- Pure rename migration — no data is dropped or recreated.

-- ---------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------
ALTER TYPE "UserRole"          RENAME TO "user_role";
ALTER TYPE "UserSubRole"       RENAME TO "user_sub_role";
ALTER TYPE "TenantStatus"      RENAME TO "tenant_status";
ALTER TYPE "BusinessPlan"      RENAME TO "business_plan";
ALTER TYPE "BookingStatus"     RENAME TO "booking_status";
ALTER TYPE "BookingSource"     RENAME TO "booking_source";
ALTER TYPE "NotificationType"  RENAME TO "notification_type";
ALTER TYPE "NotificationStatus" RENAME TO "notification_status";

-- ---------------------------------------------------------------------
-- Tenant -> tenants
-- ---------------------------------------------------------------------
ALTER TABLE "Tenant" RENAME COLUMN "avatarUrl" TO "avatar_url";
ALTER TABLE "Tenant" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "Tenant" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER INDEX "Tenant_slug_key"                   RENAME TO "tenants_slug_key";
ALTER TABLE "Tenant" RENAME CONSTRAINT "Tenant_pkey" TO "tenants_pkey";

ALTER TABLE "Tenant" RENAME TO "tenants";

-- ---------------------------------------------------------------------
-- TenantUser -> tenant_users
-- ---------------------------------------------------------------------
ALTER TABLE "TenantUser" RENAME COLUMN "tenantId"    TO "tenant_id";
ALTER TABLE "TenantUser" RENAME COLUMN "avatarUrl"   TO "avatar_url";
ALTER TABLE "TenantUser" RENAME COLUMN "subRole"     TO "sub_role";
ALTER TABLE "TenantUser" RENAME COLUMN "createdAt"   TO "created_at";
ALTER TABLE "TenantUser" RENAME COLUMN "updatedAt"   TO "updated_at";
ALTER TABLE "TenantUser" RENAME COLUMN "lastLoginAt" TO "last_login_at";

ALTER INDEX "TenantUser_phone_key" RENAME TO "tenant_users_phone_key";
ALTER INDEX "TenantUser_phone_idx" RENAME TO "tenant_users_phone_idx";
ALTER TABLE "TenantUser" RENAME CONSTRAINT "TenantUser_pkey"          TO "tenant_users_pkey";
ALTER TABLE "TenantUser" RENAME CONSTRAINT "TenantUser_tenantId_fkey" TO "tenant_users_tenant_id_fkey";

ALTER TABLE "TenantUser" RENAME TO "tenant_users";

-- ---------------------------------------------------------------------
-- Staff -> staff
-- ---------------------------------------------------------------------
ALTER TABLE "Staff" RENAME COLUMN "tenantId"  TO "tenant_id";
ALTER TABLE "Staff" RENAME COLUMN "userId"    TO "user_id";
ALTER TABLE "Staff" RENAME COLUMN "avatarUrl" TO "avatar_url";
ALTER TABLE "Staff" RENAME COLUMN "isActive"  TO "is_active";
ALTER TABLE "Staff" RENAME COLUMN "sortOrder" TO "sort_order";
ALTER TABLE "Staff" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "Staff" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER INDEX "Staff_tenantId_isActive_idx" RENAME TO "staff_tenant_id_is_active_idx";
ALTER TABLE "Staff" RENAME CONSTRAINT "Staff_pkey"          TO "staff_pkey";
ALTER TABLE "Staff" RENAME CONSTRAINT "Staff_tenantId_fkey" TO "staff_tenant_id_fkey";
ALTER TABLE "Staff" RENAME CONSTRAINT "Staff_userId_fkey"   TO "staff_user_id_fkey";

ALTER TABLE "Staff" RENAME TO "staff";

-- ---------------------------------------------------------------------
-- Service -> services
-- ---------------------------------------------------------------------
ALTER TABLE "Service" RENAME COLUMN "tenantId"        TO "tenant_id";
ALTER TABLE "Service" RENAME COLUMN "durationMinutes" TO "duration_minutes";
ALTER TABLE "Service" RENAME COLUMN "priceAmount"     TO "price_amount";
ALTER TABLE "Service" RENAME COLUMN "isActive"        TO "is_active";
ALTER TABLE "Service" RENAME COLUMN "sortOrder"       TO "sort_order";
ALTER TABLE "Service" RENAME COLUMN "createdAt"       TO "created_at";
ALTER TABLE "Service" RENAME COLUMN "updatedAt"       TO "updated_at";

ALTER INDEX "Service_tenantId_isActive_idx" RENAME TO "services_tenant_id_is_active_idx";
ALTER TABLE "Service" RENAME CONSTRAINT "Service_pkey"          TO "services_pkey";
ALTER TABLE "Service" RENAME CONSTRAINT "Service_tenantId_fkey" TO "services_tenant_id_fkey";

ALTER TABLE "Service" RENAME TO "services";

-- ---------------------------------------------------------------------
-- WorkingHours -> working_hours
-- ---------------------------------------------------------------------
ALTER TABLE "WorkingHours" RENAME COLUMN "staffId"        TO "staff_id";
ALTER TABLE "WorkingHours" RENAME COLUMN "dayOfWeek"      TO "day_of_week";
ALTER TABLE "WorkingHours" RENAME COLUMN "startTime"      TO "start_time";
ALTER TABLE "WorkingHours" RENAME COLUMN "endTime"        TO "end_time";
ALTER TABLE "WorkingHours" RENAME COLUMN "breakStartTime" TO "break_start_time";
ALTER TABLE "WorkingHours" RENAME COLUMN "breakEndTime"   TO "break_end_time";
ALTER TABLE "WorkingHours" RENAME COLUMN "createdAt"      TO "created_at";
ALTER TABLE "WorkingHours" RENAME COLUMN "updatedAt"      TO "updated_at";

ALTER INDEX "WorkingHours_staffId_dayOfWeek_key" RENAME TO "working_hours_staff_id_day_of_week_key";
ALTER TABLE "WorkingHours" RENAME CONSTRAINT "WorkingHours_pkey"         TO "working_hours_pkey";
ALTER TABLE "WorkingHours" RENAME CONSTRAINT "WorkingHours_staffId_fkey" TO "working_hours_staff_id_fkey";

ALTER TABLE "WorkingHours" RENAME TO "working_hours";

-- ---------------------------------------------------------------------
-- DayOff -> days_off
-- ---------------------------------------------------------------------
ALTER TABLE "DayOff" RENAME COLUMN "staffId"   TO "staff_id";
ALTER TABLE "DayOff" RENAME COLUMN "createdAt" TO "created_at";

ALTER INDEX "DayOff_staffId_date_key" RENAME TO "days_off_staff_id_date_key";
ALTER TABLE "DayOff" RENAME CONSTRAINT "DayOff_pkey"         TO "days_off_pkey";
ALTER TABLE "DayOff" RENAME CONSTRAINT "DayOff_staffId_fkey" TO "days_off_staff_id_fkey";

ALTER TABLE "DayOff" RENAME TO "days_off";

-- ---------------------------------------------------------------------
-- Booking -> bookings
-- ---------------------------------------------------------------------
ALTER TABLE "Booking" RENAME COLUMN "publicId"  TO "public_id";
ALTER TABLE "Booking" RENAME COLUMN "tenantId"  TO "tenant_id";
ALTER TABLE "Booking" RENAME COLUMN "staffId"   TO "staff_id";
ALTER TABLE "Booking" RENAME COLUMN "serviceId" TO "service_id";
ALTER TABLE "Booking" RENAME COLUMN "clientId"  TO "client_id";
ALTER TABLE "Booking" RENAME COLUMN "startTime" TO "start_time";
ALTER TABLE "Booking" RENAME COLUMN "endTime"   TO "end_time";
ALTER TABLE "Booking" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "Booking" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER INDEX "Booking_publicId_key"             RENAME TO "bookings_public_id_key";
ALTER INDEX "Booking_tenantId_date_idx"        RENAME TO "bookings_tenant_id_date_idx";
ALTER INDEX "Booking_staffId_date_status_idx"  RENAME TO "bookings_staff_id_date_status_idx";
ALTER TABLE "Booking" RENAME CONSTRAINT "Booking_pkey"           TO "bookings_pkey";
ALTER TABLE "Booking" RENAME CONSTRAINT "Booking_tenantId_fkey"  TO "bookings_tenant_id_fkey";
ALTER TABLE "Booking" RENAME CONSTRAINT "Booking_staffId_fkey"   TO "bookings_staff_id_fkey";
ALTER TABLE "Booking" RENAME CONSTRAINT "Booking_serviceId_fkey" TO "bookings_service_id_fkey";
ALTER TABLE "Booking" RENAME CONSTRAINT "Booking_clientId_fkey"  TO "bookings_client_id_fkey";

ALTER TABLE "Booking" RENAME TO "bookings";

-- ---------------------------------------------------------------------
-- Client -> clients
-- ---------------------------------------------------------------------
ALTER TABLE "Client" RENAME COLUMN "tenantId"  TO "tenant_id";
ALTER TABLE "Client" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "Client" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER INDEX "Client_tenantId_idx"       RENAME TO "clients_tenant_id_idx";
ALTER INDEX "Client_tenantId_phone_key" RENAME TO "clients_tenant_id_phone_key";
ALTER TABLE "Client" RENAME CONSTRAINT "Client_pkey"          TO "clients_pkey";
ALTER TABLE "Client" RENAME CONSTRAINT "Client_tenantId_fkey" TO "clients_tenant_id_fkey";

ALTER TABLE "Client" RENAME TO "clients";

-- ---------------------------------------------------------------------
-- Notification -> notifications
-- ---------------------------------------------------------------------
ALTER TABLE "Notification" RENAME COLUMN "bookingId" TO "booking_id";
ALTER TABLE "Notification" RENAME COLUMN "sentAt"    TO "sent_at";
ALTER TABLE "Notification" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "Notification" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER INDEX "Notification_status_createdAt_idx" RENAME TO "notifications_status_created_at_idx";
ALTER INDEX "Notification_bookingId_type_key"   RENAME TO "notifications_booking_id_type_key";
ALTER TABLE "Notification" RENAME CONSTRAINT "Notification_pkey"           TO "notifications_pkey";
ALTER TABLE "Notification" RENAME CONSTRAINT "Notification_bookingId_fkey" TO "notifications_booking_id_fkey";

ALTER TABLE "Notification" RENAME TO "notifications";

-- ---------------------------------------------------------------------
-- OtpChallenge -> otp_challenges
-- ---------------------------------------------------------------------
ALTER TABLE "OtpChallenge" RENAME COLUMN "codeHash"   TO "code_hash";
ALTER TABLE "OtpChallenge" RENAME COLUMN "expiresAt"  TO "expires_at";
ALTER TABLE "OtpChallenge" RENAME COLUMN "consumedAt" TO "consumed_at";
ALTER TABLE "OtpChallenge" RENAME COLUMN "createdAt"  TO "created_at";

ALTER INDEX "OtpChallenge_phone_createdAt_idx" RENAME TO "otp_challenges_phone_created_at_idx";
ALTER TABLE "OtpChallenge" RENAME CONSTRAINT "OtpChallenge_pkey" TO "otp_challenges_pkey";

ALTER TABLE "OtpChallenge" RENAME TO "otp_challenges";
