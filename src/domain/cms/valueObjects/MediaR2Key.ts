import { MediaR2KeySchema, type MediaR2KeyType } from '../schemas/ValidationSchemas';

export class MediaR2Key {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): MediaR2Key {
    const result = MediaR2KeySchema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid R2 key: ${result.error.errors[0].message}`);
    }
    return new MediaR2Key(result.data);
  }

  static fromFilename(filename: string, prefix?: string): MediaR2Key {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const key = prefix 
      ? `${prefix}/${timestamp}_${sanitizedFilename}`
      : `${timestamp}_${sanitizedFilename}`;
    
    return MediaR2Key.create(key);
  }

  static fromPath(path: string): MediaR2Key {
    const normalizedPath = path
      .replace(/^\/+/, '') // Remove leading slashes
      .replace(/\/+/g, '/') // Normalize multiple slashes
      .replace(/[^a-zA-Z0-9._/-]/g, '_'); // Sanitize invalid characters
    
    return MediaR2Key.create(normalizedPath);
  }

  static forContent(contentId: string, filename: string): MediaR2Key {
    return MediaR2Key.fromFilename(filename, `content/${contentId}`);
  }

  static forMedia(mediaId: string, filename: string): MediaR2Key {
    return MediaR2Key.fromFilename(filename, `media/${mediaId}`);
  }

  get value(): string {
    return this._value;
  }

  get length(): number {
    return this._value.length;
  }

  get filename(): string {
    const lastSlashIndex = this._value.lastIndexOf('/');
    return lastSlashIndex !== -1 ? this._value.substring(lastSlashIndex + 1) : this._value;
  }

  get directory(): string {
    const lastSlashIndex = this._value.lastIndexOf('/');
    return lastSlashIndex !== -1 ? this._value.substring(0, lastSlashIndex) : '';
  }

  get extension(): string {
    const filename = this.filename;
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  }

  hasPrefix(prefix: string): boolean {
    return this._value.startsWith(prefix);
  }

  isInDirectory(directory: string): boolean {
    const normalizedDir = directory.replace(/\/$/, ''); // Remove trailing slash
    return this._value.startsWith(`${normalizedDir}/`);
  }

  withPrefix(prefix: string): MediaR2Key {
    const normalizedPrefix = prefix.replace(/\/$/, ''); // Remove trailing slash
    const newKey = `${normalizedPrefix}/${this._value}`;
    return MediaR2Key.create(newKey);
  }

  withSuffix(suffix: string): MediaR2Key {
    const extension = this.extension;
    const filenameWithoutExt = this.filename.replace(extension, '');
    const directory = this.directory;
    
    const newFilename = `${filenameWithoutExt}${suffix}${extension}`;
    const newKey = directory ? `${directory}/${newFilename}` : newFilename;
    
    return MediaR2Key.create(newKey);
  }

  equals(other: MediaR2Key): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}