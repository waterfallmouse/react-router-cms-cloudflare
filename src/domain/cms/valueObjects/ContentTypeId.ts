import { ContentTypeIdSchema } from '../schemas/ValidationSchemas';

export class ContentTypeId {
  constructor(private readonly value: string) {
    const result = ContentTypeIdSchema.safeParse(value);
    if (!result.success) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error(`Invalid ContentTypeId: ${result.error.issues[0].message}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ContentTypeId): boolean {
    return this.value === other.value;
  }

  static generate(): ContentTypeId {
    return new ContentTypeId(crypto.randomUUID());
  }

  static fromString(value: string): ContentTypeId {
    return new ContentTypeId(value);
  }
}
