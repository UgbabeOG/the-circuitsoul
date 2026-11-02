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
  organizationId: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).default('DRAFT'),
  triggerType: z.string(),
  definitionJson: z.string(),
  externalWorkflowId: z.string().optional()
});

export const AutomationCategorySchema = z.enum([
  'SECURITY',
  'COMPLIANCE',
  'DEVOPS',
  'MARKETING',
  'FINTECH'
]);

export const AutomationTemplateSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: AutomationCategorySchema,
  description: z.string(),
  triggerType: z.string(),
  icon: z.string(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(['trigger', 'action', 'filter', 'transformer']),
    name: z.string(),
    service: z.string(),
    config: z.record(z.any())
  })),
  estimatedRuntimeMs: z.number(),
  defaultPayload: z.record(z.any()),
  popular: z.boolean().default(false)
});

export const WorkflowExecutionRequestSchema = z.object({
  workflowId: z.string(),
  organizationId: z.string().optional(),
  payload: z.record(z.any()).default({}),
  triggerSource: z.string().default('MANUAL_CONSOLE')
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
export type AutomationCategory = z.infer<typeof AutomationCategorySchema>;
export type AutomationTemplate = z.infer<typeof AutomationTemplateSchema>;
export type WorkflowExecutionRequest = z.infer<typeof WorkflowExecutionRequestSchema>;
export type BlogPostDTO = z.infer<typeof BlogPostSchema>;

