import { MediaFilename } from './MediaFilename';

export class MediaR2Key {
  constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error('MediaR2Key cannot be empty');
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: MediaR2Key): boolean {
    return this.value === other.value;
  }

  static fromString(value: string): MediaR2Key {
    return new MediaR2Key(value);
  }

  static generate(filename: MediaFilename): MediaR2Key {
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().substring(0, 8);
    const extension = filename.getExtension();

    // コンテンツタイプに応じてフォルダを分ける
    const folder = filename.isImageFile() ? 'images' : 'files';
    return new MediaR2Key(`${folder}/${timestamp}-${randomId}.${extension}`);
  }
}
