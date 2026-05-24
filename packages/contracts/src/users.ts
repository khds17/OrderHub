import { z } from 'zod';

export const UserRoleSchema = z.enum(['ADMIN', 'CLIENT', 'SUPPORT']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  // surname / address landed in migration 004. Both are nullable in DB and
  // arrive as `null` (not `undefined`) over the wire when unset.
  surname: z.string().nullable(),
  address: z.string().nullable(),
  role: UserRoleSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

// `null` is meaningful for surname/address (explicit clear); `undefined`
// means "leave as is". We model both by accepting `.nullable().optional()`.
export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  surname: z.string().min(1).max(255).nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  })
  // Block the silly no-op case at the schema layer so the service doesn't
  // need a guard for it.
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must differ from current password',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
