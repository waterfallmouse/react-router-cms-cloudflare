import { z } from 'zod';

export const ContentIdSchema = z.string().uuid({
  message: 'Content ID must be a valid UUID'
});

export const ContentTitleSchema = z.string()
  .trim()
  .min(1, { message: 'Title is required' })
  .max(200, { message: 'Title must be at most 200 characters' });

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

export const MediaIdSchema = z.string().uuid({
  message: 'Media ID must be a valid UUID'
});

export const MediaFilenameSchema = z.string()
  .trim()
  .min(1, { message: 'Filename is required' })
  .max(255, { message: 'Filename must be at most 255 characters' })
  .regex(/^[^<>:"/\\|?*\x00-\x1F]+$/, {
    message: 'Filename contains invalid characters'
  });

export const MediaUrlSchema = z.string()
  .url({ message: 'Must be a valid URL' })
  .max(2048, { message: 'URL must be at most 2048 characters' })
  .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
    message: 'URL must use HTTP or HTTPS protocol'
  });

export const MediaSizeSchema = z.number()
  .int({ message: 'File size must be an integer' })
  .min(1, { message: 'File size must be greater than 0' })
  .max(100 * 1024 * 1024, { message: 'File size must be at most 100MB' });

export const MediaR2KeySchema = z.string()
  .trim()
  .min(1, { message: 'R2 key is required' })
  .max(1024, { message: 'R2 key must be at most 1024 characters' })
  .regex(/^[a-zA-Z0-9._/-]+$/, {
    message: 'R2 key must contain only letters, numbers, dots, underscores, hyphens, and forward slashes'
  });

export type ContentIdType = z.infer<typeof ContentIdSchema>;
export type ContentTitleType = z.infer<typeof ContentTitleSchema>;
export type ContentSlugType = z.infer<typeof ContentSlugSchema>;
export type ContentBodyType = z.infer<typeof ContentBodySchema>;
export type ContentStatusType = z.infer<typeof ContentStatusSchema>;
export type MediaIdType = z.infer<typeof MediaIdSchema>;
export type MediaFilenameType = z.infer<typeof MediaFilenameSchema>;
export type MediaUrlType = z.infer<typeof MediaUrlSchema>;
export type MediaSizeType = z.infer<typeof MediaSizeSchema>;
export type MediaR2KeyType = z.infer<typeof MediaR2KeySchema>;