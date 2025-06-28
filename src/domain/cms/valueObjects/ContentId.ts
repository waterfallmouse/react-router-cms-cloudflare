import { ContentIdSchema } from '../schemas/ValidationSchemas';

export class ContentId {
  constructor(private readonly value: string) {
    const result = ContentIdSchema.safeParse(value);
    if (!result.success) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error(`Invalid ContentId: ${result.error.issues[0].message}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ContentId): boolean {
    return this.value === other.value;
  }

  static generate(): ContentId {
    return new ContentId(crypto.randomUUID());
  }

  static fromString(value: string): ContentId {
    return new ContentId(value);
  }
}
