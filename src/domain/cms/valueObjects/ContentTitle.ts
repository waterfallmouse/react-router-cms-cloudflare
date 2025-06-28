import { ContentTitleSchema } from '../schemas/ValidationSchemas';
import { ContentSlug } from './ContentSlug';

export class ContentTitle {
  constructor(private readonly value: string) {
    const result = ContentTitleSchema.safeParse(value);
    if (!result.success) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error(`Invalid ContentTitle: ${result.error.issues[0].message}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ContentTitle): boolean {
    return this.value === other.value;
  }

  generateSlug(): ContentSlug {
    return ContentSlug.fromTitle(this.value);
  }

  static fromString(value: string): ContentTitle {
    return new ContentTitle(value);
  }
}
