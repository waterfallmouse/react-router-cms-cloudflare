import { MediaSizeSchema, type MediaSizeType } from '../schemas/ValidationSchemas';

export class MediaSize {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  static create(value: number): MediaSize {
    const result = MediaSizeSchema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid media size: ${result.error.errors[0].message}`);
    }
    return new MediaSize(result.data);
  }

  static fromBytes(bytes: number): MediaSize {
    return MediaSize.create(bytes);
  }

  static fromKilobytes(kb: number): MediaSize {
    return MediaSize.create(Math.round(kb * 1024));
  }

  static fromMegabytes(mb: number): MediaSize {
    return MediaSize.create(Math.round(mb * 1024 * 1024));
  }

  get value(): number {
    return this._value;
  }

  get bytes(): number {
    return this._value;
  }

  get kilobytes(): number {
    return this._value / 1024;
  }

  get megabytes(): number {
    return this._value / (1024 * 1024);
  }

  get gigabytes(): number {
    return this._value / (1024 * 1024 * 1024);
  }

  isSmall(): boolean {
    return this._value < 1024 * 1024; // Less than 1MB
  }

  isMedium(): boolean {
    return this._value >= 1024 * 1024 && this._value < 10 * 1024 * 1024; // 1MB to 10MB
  }

  isLarge(): boolean {
    return this._value >= 10 * 1024 * 1024; // 10MB or more
  }

  isWithinLimit(maxBytes: number): boolean {
    return this._value <= maxBytes;
  }

  toHumanReadable(): string {
    if (this._value < 1024) {
      return `${this._value} B`;
    } else if (this._value < 1024 * 1024) {
      return `${Math.round(this.kilobytes * 10) / 10} KB`;
    } else if (this._value < 1024 * 1024 * 1024) {
      return `${Math.round(this.megabytes * 10) / 10} MB`;
    } else {
      return `${Math.round(this.gigabytes * 10) / 10} GB`;
    }
  }

  compare(other: MediaSize): number {
    if (this._value < other._value) return -1;
    if (this._value > other._value) return 1;
    return 0;
  }

  isLargerThan(other: MediaSize): boolean {
    return this._value > other._value;
  }

  isSmallerThan(other: MediaSize): boolean {
    return this._value < other._value;
  }

  equals(other: MediaSize): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this.toHumanReadable();
  }
}