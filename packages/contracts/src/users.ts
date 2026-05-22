import { z } from 'zod';

export const UserRoleSchema = z.enum(['ADMIN', 'CLIENT', 'SUPPORT']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
