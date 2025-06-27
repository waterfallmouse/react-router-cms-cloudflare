import { randomUUID } from 'crypto';
import { ContentIdSchema } from '../schemas/ValidationSchemas';

export class ContentId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value?: string): ContentId {
    const id = value ?? randomUUID();
    const validatedId = ContentIdSchema.parse(id);
    return new ContentId(validatedId);
  }

  static fromString(value: string): ContentId {
    const validatedId = ContentIdSchema.parse(value);
    return new ContentId(validatedId);
  }

  get value(): string {
    return this._value;
  }

  equals(other: ContentId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}