import { ContentId } from '../valueObjects/ContentId';
import { MediaFilename } from '../valueObjects/MediaFilename';
import { MediaId } from '../valueObjects/MediaId';
import { MediaR2Key } from '../valueObjects/MediaR2Key';
import { MediaSize } from '../valueObjects/MediaSize';
import { MediaUrl } from '../valueObjects/MediaUrl';

export class Media {
  constructor(
    private readonly id: MediaId,
    private readonly filename: MediaFilename,
    private readonly r2Key: MediaR2Key,
    private url: MediaUrl,
    private readonly size: MediaSize,
    private readonly mimeType: string,
    private alt: string | null = null,
    private contentId: ContentId | null = null,
    private readonly createdAt: Date = new Date(),
  ) {}

  getId(): MediaId {
    return this.id;
  }

  getFilename(): MediaFilename {
    return this.filename;
  }

  getR2Key(): MediaR2Key {
    return this.r2Key;
  }

  getUrl(): MediaUrl {
    return this.url;
  }

  getSize(): MediaSize {
    return this.size;
  }

  getMimeType(): string {
    return this.mimeType;
  }

  getAlt(): string | null {
    return this.alt;
  }

  getContentId(): ContentId | null {
    return this.contentId;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  attachToContent(contentId: ContentId): void {
    this.contentId = contentId;
  }

  detachFromContent(): void {
    this.contentId = null;
  }

  isAttachedToContent(): boolean {
    return this.contentId !== null;
  }

  updateUrl(url: MediaUrl): void {
    this.url = url;
  }

  updateAlt(alt: string | null): void {
    this.alt = alt;
  }

  isImage(): boolean {
    return this.filename.isImageFile();
  }

  static create(
    filename: MediaFilename,
    r2Key: MediaR2Key,
    url: MediaUrl,
    size: MediaSize,
    mimeType: string,
  ): Media {
    const id = MediaId.generate();
    return new Media(id, filename, r2Key, url, size, mimeType);
  }
}
