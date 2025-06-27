import { MediaUrlSchema, type MediaUrlType } from '../schemas/ValidationSchemas';

export class MediaUrl {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): MediaUrl {
    const result = MediaUrlSchema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid media URL: ${result.error.errors[0].message}`);
    }
    return new MediaUrl(result.data);
  }

  static fromR2(bucketName: string, r2Key: string, domain?: string): MediaUrl {
    const baseUrl = domain || `https://${bucketName}.r2.cloudflarestorage.com`;
    const normalizedR2Key = r2Key.replace(/^\/+/, '');
    const url = `${baseUrl}/${normalizedR2Key}`;
    return MediaUrl.create(url);
  }

  static fromCloudflareImages(accountId: string, imageId: string, variant: string = 'public'): MediaUrl {
    const url = `https://imagedelivery.net/${accountId}/${imageId}/${variant}`;
    return MediaUrl.create(url);
  }

  get value(): string {
    return this._value;
  }

  get domain(): string {
    try {
      const url = new URL(this._value);
      return url.hostname;
    } catch {
      return '';
    }
  }

  get protocol(): string {
    try {
      const url = new URL(this._value);
      return url.protocol;
    } catch {
      return '';
    }
  }

  get path(): string {
    try {
      const url = new URL(this._value);
      return url.pathname;
    } catch {
      return '';
    }
  }

  get filename(): string {
    const path = this.path;
    const lastSlashIndex = path.lastIndexOf('/');
    return lastSlashIndex !== -1 ? path.substring(lastSlashIndex + 1) : path;
  }

  isSecure(): boolean {
    return this.protocol === 'https:';
  }

  isCloudflareR2(): boolean {
    return this.domain.endsWith('.r2.cloudflarestorage.com') || 
           this.domain === 'r2.dev' ||
           this.domain.endsWith('.r2.dev');
  }

  isCloudflareImages(): boolean {
    return this.domain === 'imagedelivery.net';
  }

  withVariant(variant: string): MediaUrl {
    if (!this.isCloudflareImages()) {
      throw new Error('URL variant can only be applied to Cloudflare Images URLs');
    }
    
    const pathParts = this.path.split('/');
    if (pathParts.length >= 4) {
      pathParts[3] = variant;
      const newPath = pathParts.join('/');
      const newUrl = `${this.protocol}//${this.domain}${newPath}`;
      return MediaUrl.create(newUrl);
    }
    
    throw new Error('Invalid Cloudflare Images URL format');
  }

  equals(other: MediaUrl): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}