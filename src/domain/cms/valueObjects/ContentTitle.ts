import { ContentTitleSchema } from '../schemas/ValidationSchemas';
import { slugifyTitle } from '../utils/slugify';

export class ContentTitle {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): ContentTitle {
    const validatedTitle = ContentTitleSchema.parse(value);
    return new ContentTitle(validatedTitle);
  }

  get value(): string {
    return this._value;
  }

  get length(): number {
    return this._value.length;
  }

  isEmpty(): boolean {
    return this._value.length === 0;
  }

  equals(other: ContentTitle): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  toSlugSuggestion(): string {
    return slugifyTitle(this._value);
  }
}