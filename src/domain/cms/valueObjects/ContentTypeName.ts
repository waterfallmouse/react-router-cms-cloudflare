import { ContentTypeNameSchema } from '../schemas/ValidationSchemas';

export class ContentTypeName {
  constructor(private readonly value: string) {
    const result = ContentTypeNameSchema.safeParse(value);
    if (!result.success) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error(`Invalid ContentTypeName: ${result.error.issues[0].message}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ContentTypeName): boolean {
    return this.value === other.value;
  }

  static fromString(value: string): ContentTypeName {
    return new ContentTypeName(value);
  }
}
