import { ContentBodySchema } from '../schemas/ValidationSchemas';

export class ContentBody {
  constructor(private readonly content: string) {
    const result = ContentBodySchema.safeParse(content);
    if (!result.success) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error(`Invalid ContentBody: ${result.error.issues[0].message}`);
    }
  }

  getContent(): string {
    return this.content;
  }

  generateExcerpt(maxLength: number = 200): string {
    // マークダウン記法を除去して抜粋を生成
    const plainText = this.content
      .replace(/#{1,6}\s+/g, '') // ヘッダー
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/`([^`]+)`/g, '$1') // Inline code
      .replace(/```[\s\S]*?```/g, '') // Code blocks
      .trim();

    return plainText.length > maxLength ? `${plainText.substring(0, maxLength)}...` : plainText;
  }

  isEmpty(): boolean {
    return this.content.trim().length === 0;
  }

  equals(other: ContentBody): boolean {
    return this.content === other.content;
  }

  static fromString(content: string): ContentBody {
    return new ContentBody(content);
  }
}
