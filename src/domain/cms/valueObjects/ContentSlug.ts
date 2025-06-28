import { ContentSlugSchema } from '../schemas/ValidationSchemas';

export class ContentSlug {
  constructor(private readonly value: string) {
    const result = ContentSlugSchema.safeParse(value);
    if (!result.success) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error(`Invalid ContentSlug: ${result.error.issues[0].message}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ContentSlug): boolean {
    return this.value === other.value;
  }

  static fromTitle(title: string): ContentSlug {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return new ContentSlug(slug.substring(0, 100));
  }

  static fromString(value: string): ContentSlug {
    return new ContentSlug(value);
  }
}
