import { ContentBodySchema } from '../schemas/ValidationSchemas';

export class ContentBody {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): ContentBody {
    const validatedBody = ContentBodySchema.parse(value);
    return new ContentBody(validatedBody);
  }

  get value(): string {
    return this._value;
  }

  get length(): number {
    return this._value.length;
  }

  get wordCount(): number {
    return this._value.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  isEmpty(): boolean {
    return this._value.trim().length === 0;
  }

  equals(other: ContentBody): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  getExcerpt(maxLength: number = 200): string {
    if (this._value.length <= maxLength) {
      return this._value;
    }
    
    const truncated = this._value.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > 0) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
  }

  hasMarkdown(): boolean {
    const markdownPatterns = [
      /#+\s/,
      /\*\*.*\*\*/,
      /\*.*\*/,
      /```[\s\S]*?```/,
      /`.*`/,
      /\[.*\]\(.*\)/,
      /^\s*[-*+]\s/m,
      /^\s*\d+\.\s/m
    ];
    
    return markdownPatterns.some(pattern => pattern.test(this._value));
  }
}