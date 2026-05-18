import { z } from 'zod';
import { emailValidator, passwordValidator } from './utils';

export const registerDto = z.object({
  tenantName: z.string().trim().min(2, 'Tenant name is required'),
  tenantSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and dashes'),
  name: z.string().trim().min(1).optional(),
  email: emailValidator,
  password: passwordValidator,
});

export const loginDto = z.object({
  email: emailValidator,
  password: z.string().min(1, 'Password is required'),
  tenantSlug: z.string().trim().toLowerCase().optional(),
});

export const meResponseDto = z.object({
  user: z.object({
    id: z.number(),
    email: z.string(),
    name: z.string().nullable(),
    role: z.string(),
    subRole: z.string(),
  }),
  tenant: z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
  }),
});

export type RegisterDto = z.infer<typeof registerDto>;
export type LoginDto = z.infer<typeof loginDto>;
export type MeResponseDto = z.infer<typeof meResponseDto>;
