import { MediaFilenameSchema } from '../schemas/ValidationSchemas';

export class MediaFilename {
  constructor(private readonly value: string) {
    const result = MediaFilenameSchema.safeParse(value);
    if (!result.success) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error(`Invalid MediaFilename: ${result.error.issues[0].message}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: MediaFilename): boolean {
    return this.value === other.value;
  }

  getExtension(): string {
    return this.value.split('.').pop()?.toLowerCase() || '';
  }

  isMediaFile(): boolean {
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'pdf', 'doc', 'docx'];
    return validExtensions.includes(this.getExtension());
  }

  isImageFile(): boolean {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    return imageExtensions.includes(this.getExtension());
  }

  static fromString(value: string): MediaFilename {
    return new MediaFilename(value);
  }
}
