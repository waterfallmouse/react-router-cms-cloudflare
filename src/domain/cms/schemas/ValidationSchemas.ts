import { z } from 'zod';

export const ContentIdSchema = z.string().uuid({
  message: 'Content ID must be a valid UUID'
});

export const ContentTitleSchema = z.string()
  .trim()
  .min(1, { message: 'Title is required' })
  .max(200, { message: 'Title must be less than 200 characters' });

export const ContentSlugSchema = z.string()
  .min(1, { message: 'Slug is required' })
  .max(100, { message: 'Slug must be at most 100 characters' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens'
  });

export const ContentBodySchema = z.string()
  .min(1, { message: 'Content body is required' })
  .max(50000, { message: 'Content body must be at most 50,000 characters' });

export const ContentStatusSchema = z.enum(['draft', 'published', 'archived'], {
  errorMap: () => ({ message: 'Status must be draft, published, or archived' })
});

export type ContentIdType = z.infer<typeof ContentIdSchema>;
export type ContentTitleType = z.infer<typeof ContentTitleSchema>;
export type ContentSlugType = z.infer<typeof ContentSlugSchema>;
export type ContentBodyType = z.infer<typeof ContentBodySchema>;
export type ContentStatusType = z.infer<typeof ContentStatusSchema>;