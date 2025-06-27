import { randomUUID } from 'crypto';
import { MediaIdSchema, type MediaIdType } from '../schemas/ValidationSchemas';

export class MediaId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(): MediaId {
    const id = randomUUID();
    return new MediaId(id);
  }

  static fromString(value: string): MediaId {
    const result = MediaIdSchema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid Media ID: ${result.error.errors[0].message}`);
    }
    return new MediaId(result.data);
  }

  get value(): string {
    return this._value;
  }

  equals(other: MediaId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}