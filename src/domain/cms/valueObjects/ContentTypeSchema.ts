import { ContentTypeSchemaSchema } from '../schemas/ValidationSchemas';

export class ContentTypeSchema {
  constructor(private readonly value: Record<string, any>) {
    const result = ContentTypeSchemaSchema.safeParse(value);
    if (!result.success) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error(`Invalid ContentTypeSchema: ${result.error.issues[0].message}`);
    }
  }

  getValue(): Record<string, any> {
    return this.value;
  }

  equals(other: ContentTypeSchema): boolean {
    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }

  static fromObject(value: Record<string, any>): ContentTypeSchema {
    return new ContentTypeSchema(value);
  }
}
