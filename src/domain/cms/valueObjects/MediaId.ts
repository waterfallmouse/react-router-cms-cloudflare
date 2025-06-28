import { MediaIdSchema } from '../schemas/ValidationSchemas';

export class MediaId {
  constructor(private readonly value: string) {
    const result = MediaIdSchema.safeParse(value);
    if (!result.success) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error(`Invalid MediaId: ${result.error.issues[0].message}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: MediaId): boolean {
    return this.value === other.value;
  }

  static generate(): MediaId {
    return new MediaId(crypto.randomUUID());
  }

  static fromString(value: string): MediaId {
    return new MediaId(value);
  }
}
