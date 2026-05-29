import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional()
});

export const OrganizationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  slug: z.string().min(2)
});

export const ShieldAssessmentSchema = z.object({
  organizationId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  overallRisk: z.enum(['LOW', 'MEDIUM', 'HIGH'])
});

export const CloudEnvironmentSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(['AWS', 'GCP', 'AZURE']),
  name: z.string().min(1),
  credentialsJson: z.string(),
  status: z.string()
});

export const FlowWorkflowSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  triggerType: z.string(),
  definitionJson: z.string()
});

export const BlogPostSchema = z.object({
  authorId: z.string().uuid(),
  title: z.string().min(5),
  slug: z.string(),
  content: z.string().min(10),
  summary: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT')
});

export type UserDTO = z.infer<typeof UserSchema>;
export type OrganizationDTO = z.infer<typeof OrganizationSchema>;
export type ShieldAssessmentDTO = z.infer<typeof ShieldAssessmentSchema>;
export type CloudEnvironmentDTO = z.infer<typeof CloudEnvironmentSchema>;
export type FlowWorkflowDTO = z.infer<typeof FlowWorkflowSchema>;
export type BlogPostDTO = z.infer<typeof BlogPostSchema>;
