import { z } from 'zod';
import {
  IsoDateTimeSchema,
  MembershipIdSchema,
  OrganizationIdSchema,
  SlugSchema,
  UserIdSchema,
} from './common.js';

export const IdentityProviderSchema = z.enum([
  'entra_external_id',
  'local_demo',
]);

export const UserSummarySchema = z
  .object({
    id: UserIdSchema,
    subjectId: z.string().min(3).max(255),
    displayName: z.string().min(1).max(160),
    email: z.string().email().max(320).optional(),
    provider: IdentityProviderSchema,
  })
  .strict();

export const OrganizationSummarySchema = z
  .object({
    id: OrganizationIdSchema,
    slug: SlugSchema,
    name: z.string().min(2).max(160),
  })
  .strict();

export const MembershipRoleSchema = z.enum([
  'applicant',
  'organization_admin',
  'demo_admin',
]);

export const OrganizationMembershipSchema = z
  .object({
    id: MembershipIdSchema,
    organization: OrganizationSummarySchema,
    user: UserSummarySchema,
    role: MembershipRoleSchema,
    createdAt: IsoDateTimeSchema,
  })
  .strict();

export const AuthenticatedIdentitySchema = z
  .object({
    user: UserSummarySchema,
    memberships: z.array(OrganizationMembershipSchema).min(1),
    activeOrganizationId: OrganizationIdSchema,
  })
  .strict()
  .superRefine((identity, context) => {
    if (
      !identity.memberships.some(
        (membership) =>
          membership.organization.id === identity.activeOrganizationId,
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['activeOrganizationId'],
        message: 'Active organization must be one of the user memberships.',
      });
    }
  });

export type UserSummary = z.infer<typeof UserSummarySchema>;
export type OrganizationSummary = z.infer<typeof OrganizationSummarySchema>;
export type OrganizationMembership = z.infer<
  typeof OrganizationMembershipSchema
>;
