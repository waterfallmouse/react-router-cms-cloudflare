import { MediaUrlSchema } from '../schemas/ValidationSchemas';

export class MediaUrl {
  constructor(private readonly value: string) {
    const result = MediaUrlSchema.safeParse(value);
    if (!result.success) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error(`Invalid MediaUrl: ${result.error.issues[0].message}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: MediaUrl): boolean {
    return this.value === other.value;
  }

  static fromString(value: string): MediaUrl {
    return new MediaUrl(value);
  }
}
