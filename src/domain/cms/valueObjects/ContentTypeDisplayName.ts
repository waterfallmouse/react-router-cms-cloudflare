import { ContentTypeDisplayNameSchema } from '../schemas/ValidationSchemas';

export class ContentTypeDisplayName {
  constructor(private readonly value: string) {
    const result = ContentTypeDisplayNameSchema.safeParse(value);
    if (!result.success) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error(`Invalid ContentTypeDisplayName: ${result.error.issues[0].message}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ContentTypeDisplayName): boolean {
    return this.value === other.value;
  }

  static fromString(value: string): ContentTypeDisplayName {
    return new ContentTypeDisplayName(value);
  }
}
