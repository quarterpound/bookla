import { HTTPException } from 'hono/http-exception';
import { getPrismaClient } from '../../db';
import { AppError } from '../../utils/errors';
import { hashOtpCode, verifyOtpCode } from '../../utils/password';
import { signToken } from '../../utils/jwt';
import { env } from '../../env';
import { getSmsProvider } from '@bookla/messaging';
import type { OnboardingDto, SendOtpDto, VerifyOtpDto } from '@bookla/dto/auth';
import type { AuthUser } from '../../middleware/auth.middleware';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_HOUR = 3;
const DEV_BYPASS_CODE = '000000';

const isProd = env.NODE_ENV === 'production';

const generateOtpCode = (): string => {
  // 0-padded 6 digits. Math.random is fine here — the security boundary is
  // the bcrypt-hashed challenge row + 5-attempt cap + 5-minute TTL.
  return Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
};

interface AuthSessionPayload {
  token: string;
  user: {
    id: number;
    phone: string;
    name: string | null;
    avatarUrl: string | null;
    role: string;
    subRole: string;
  };
  tenant: {
    id: number;
    name: string;
    slug: string;
    plan: string;
    timezone: string;
  } | null;
}

export const sendOtp = async (dto: SendOtpDto): Promise<{ ok: true }> => {
  const db = await getPrismaClient();
  const phone = dto.phone;

  // Rate-limit: max 3 active (non-consumed, non-expired) challenges per phone per hour.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.otpChallenge.count({
    where: {
      phone,
      createdAt: { gte: oneHourAgo },
      consumedAt: null,
    },
  });
  if (recent >= OTP_MAX_PER_HOUR) {
    throw new AppError('Too many OTP requests, try again later', 'OTP_RATE_LIMITED', 429);
  }

  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.otpChallenge.create({
    data: { phone, codeHash, expiresAt },
  });

  const sms = getSmsProvider();
  const body = `Bookla kodu: ${code}. Heç kimə verməyin.`;
  await sms.sendSms(phone, body);

  if (!isProd) {
    console.log(`[auth] OTP for ${phone}: ${code} (dev bypass: ${DEV_BYPASS_CODE})`);
  }

  return { ok: true };
};

export const verifyOtp = async (dto: VerifyOtpDto): Promise<AuthSessionPayload> => {
  const db = await getPrismaClient();
  const phone = dto.phone;
  const code = dto.code;

  const useDevBypass = !isProd && code === DEV_BYPASS_CODE;

  if (!useDevBypass) {
    const challenge = await db.otpChallenge.findFirst({
      where: {
        phone,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new HTTPException(401, { message: 'Code expired or never requested' });
    }

    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      // Burn the challenge so subsequent attempts must request a new code.
      await db.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new HTTPException(401, { message: 'Too many attempts — request a new code' });
    }

    const ok = await verifyOtpCode(code, challenge.codeHash);
    if (!ok) {
      const next = challenge.attempts + 1;
      await db.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: next,
          ...(next >= OTP_MAX_ATTEMPTS ? { consumedAt: new Date() } : {}),
        },
      });
      throw new HTTPException(401, { message: 'Invalid code' });
    }

    await db.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
  }

  // Find-or-create the TenantUser. New users have no tenant until onboarding.
  let user = await db.tenantUser.findUnique({
    where: { phone },
    include: { tenant: true },
  });

  if (!user) {
    // Stand up a placeholder tenant so the FK stays NOT NULL. The onboarding
    // step renames/completes it. The slug is a temp value; onboarding overwrites it.
    const created = await db.$transaction(async (tx) => {
      const placeholderSlug = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const tenant = await tx.tenant.create({
        data: {
          name: 'Pending business',
          slug: placeholderSlug,
        },
      });
      const u = await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          phone,
          role: 'owner',
          subRole: 'admin',
        },
        include: { tenant: true },
      });
      return u;
    });
    user = created;
  }

  await db.tenantUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = await signToken({ userId: user.id, tenantId: user.tenantId });

  const onboarded = isTenantOnboarded(user.tenant);
  return {
    token,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      subRole: user.subRole,
    },
    tenant: onboarded
      ? {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug,
          plan: user.tenant.plan,
          timezone: user.tenant.timezone,
        }
      : null,
  };
};

const isTenantOnboarded = (tenant: { slug: string }): boolean => !tenant.slug.startsWith('pending-');

export const completeOnboarding = async (
  authUser: AuthUser,
  dto: OnboardingDto,
): Promise<AuthSessionPayload> => {
  const db = await getPrismaClient();

  const user = await db.tenantUser.findUnique({
    where: { id: authUser.userId },
    include: { tenant: true },
  });
  if (!user) {
    throw new HTTPException(401, { message: 'User not found' });
  }

  if (isTenantOnboarded(user.tenant)) {
    throw new AppError('Tenant has already been onboarded', 'ALREADY_ONBOARDED', 409);
  }

  const slugClash = await db.tenant.findFirst({
    where: { slug: dto.slug, NOT: { id: user.tenantId } },
    select: { id: true },
  });
  if (slugClash) {
    throw new AppError('Slug already taken', 'SLUG_TAKEN', 409);
  }

  const updated = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.update({
      where: { id: user.tenantId },
      data: {
        name: dto.businessName,
        slug: dto.slug,
      },
    });

    if (dto.ownerName && !user.name) {
      await tx.tenantUser.update({
        where: { id: user.id },
        data: { name: dto.ownerName },
      });
    }

    const staff = await tx.staff.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        name: dto.ownerName ?? user.name ?? tenant.name,
        phone: user.phone,
        isActive: true,
        sortOrder: 0,
      },
    });

    await tx.service.create({
      data: {
        tenantId: tenant.id,
        name: dto.firstService.name,
        durationMinutes: dto.firstService.durationMinutes,
        priceAmount: dto.firstService.priceAmount,
        sortOrder: 0,
      },
    });

    if (dto.workingHours.length > 0) {
      // Onboarding produces one work interval per selected day. Split-shift
      // editing happens later in the Schedule screen, which writes directly
      // to working_intervals via /schedule/:staffId/intervals.
      await tx.workingInterval.createMany({
        data: dto.workingHours.map((w) => ({
          staffId: staff.id,
          dayOfWeek: w.dayOfWeek,
          startTime: w.startTime,
          endTime: w.endTime,
        })),
      });
    }

    const refreshedUser = await tx.tenantUser.findUniqueOrThrow({
      where: { id: user.id },
      include: { tenant: true },
    });
    return refreshedUser;
  });

  const token = await signToken({ userId: updated.id, tenantId: updated.tenantId });
  return {
    token,
    user: {
      id: updated.id,
      phone: updated.phone,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      role: updated.role,
      subRole: updated.subRole,
    },
    tenant: {
      id: updated.tenant.id,
      name: updated.tenant.name,
      slug: updated.tenant.slug,
      plan: updated.tenant.plan,
      timezone: updated.tenant.timezone,
    },
  };
};

export const getMe = async (authUser: AuthUser) => {
  const db = await getPrismaClient();
  const user = await db.tenantUser.findUnique({
    where: { id: authUser.userId },
    include: { tenant: true },
  });
  if (!user) {
    throw new HTTPException(401, { message: 'User not found' });
  }
  const onboarded = isTenantOnboarded(user.tenant);
  return {
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      subRole: user.subRole,
    },
    tenant: onboarded
      ? {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug,
          plan: user.tenant.plan,
          timezone: user.tenant.timezone,
        }
      : null,
  };
};
