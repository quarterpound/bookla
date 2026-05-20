-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "blocked_phones" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "blocked_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_phones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blocked_phones_tenant_id_idx" ON "blocked_phones"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_phones_tenant_id_phone_key" ON "blocked_phones"("tenant_id", "phone");

-- AddForeignKey
ALTER TABLE "blocked_phones" ADD CONSTRAINT "blocked_phones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_phones" ADD CONSTRAINT "blocked_phones_blocked_by_user_id_fkey" FOREIGN KEY ("blocked_by_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
