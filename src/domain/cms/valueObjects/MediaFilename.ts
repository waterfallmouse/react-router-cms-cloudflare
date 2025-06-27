import { MediaFilenameSchema, type MediaFilenameType } from '../schemas/ValidationSchemas';

export class MediaFilename {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): MediaFilename {
    const result = MediaFilenameSchema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid filename: ${result.error.errors[0].message}`);
    }
    return new MediaFilename(result.data);
  }

  static fromOriginalName(originalName: string, contentId?: string): MediaFilename {
    const sanitized = originalName
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .trim();
    
    if (sanitized.length === 0 || sanitized === '_'.repeat(sanitized.length)) {
      throw new Error('Filename cannot be empty after sanitization');
    }

    const extension = this.getExtension(sanitized);
    const nameWithoutExt = this.getNameWithoutExtension(sanitized);
    
    const timestamp = Date.now();
    const prefix = contentId ? `${contentId}_` : '';
    const filename = `${prefix}${timestamp}_${nameWithoutExt}${extension}`;
    
    return MediaFilename.create(filename);
  }

  get value(): string {
    return this._value;
  }

  get extension(): string {
    return MediaFilename.getExtension(this._value);
  }

  get nameWithoutExtension(): string {
    return MediaFilename.getNameWithoutExtension(this._value);
  }

  get length(): number {
    return this._value.length;
  }

  hasExtension(ext: string): boolean {
    return this.extension.toLowerCase() === ext.toLowerCase();
  }

  isImage(): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    return imageExtensions.includes(this.extension.toLowerCase());
  }

  equals(other: MediaFilename): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  private static getExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  }

  private static getNameWithoutExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;
  }
}