import { ContentSlugSchema } from '../schemas/ValidationSchemas';
import { slugifyTitle } from '../utils/slugify';

export class ContentSlug {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): ContentSlug {
    const validatedSlug = ContentSlugSchema.parse(value);
    return new ContentSlug(validatedSlug);
  }

  static fromTitle(title: string): ContentSlug {
    const slug = slugifyTitle(title);
    return ContentSlug.create(slug);
  }

  get value(): string {
    return this._value;
  }

  get length(): number {
    return this._value.length;
  }

  equals(other: ContentSlug): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  isValid(): boolean {
    try {
      ContentSlugSchema.parse(this._value);
      return true;
    } catch {
      return false;
    }
  }

  withSuffix(suffix: string): ContentSlug {
    const newSlug = `${this._value}-${suffix}`;
    return ContentSlug.create(newSlug);
  }
}