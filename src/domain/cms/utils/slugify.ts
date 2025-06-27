/**
 * Converts a title string into a URL-friendly slug.
 * 
 * @param title - The title string to convert
 * @returns A URL-friendly slug string
 * 
 * @example
 * ```typescript
 * slugifyTitle('My Blog Post!') // 'my-blog-post'
 * slugifyTitle('Hello   World & More') // 'hello-world-more'
 * ```
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}