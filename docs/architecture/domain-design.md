# CMS ドメインモデル設計

## 1. ドメイン分析

### 1.1 ユビキタス言語
- **コンテンツ (Content)**: CMSの管理対象となる情報（記事、ページ、プロダクト等）
- **コンテンツタイプ (ContentType)**: コンテンツの種類定義（ブログ記事、固定ページ等）
- **スラッグ (Slug)**: URL用のコンテンツ識別子
- **公開 (Publish)**: コンテンツを一般に公開する行為
- **下書き (Draft)**: 未公開状態のコンテンツ
- **アーカイブ (Archive)**: 非アクティブ状態のコンテンツ
- **メディア (Media)**: コンテンツに関連するファイルリソース（画像、動画等）
- **メタデータ (Metadata)**: コンテンツの付加情報
- **スキーマ (Schema)**: コンテンツタイプの構造定義

### 1.2 ドメインの境界
```
CMS Context (CMSコンテキスト)
├── Content Aggregate (コンテンツ集約)
├── ContentType Aggregate (コンテンツタイプ集約)
├── Media Aggregate (メディア集約)
├── Category Aggregate (分類集約) ※将来拡張
├── User Aggregate (ユーザー集約) ※将来拡張
└── Workflow Aggregate (ワークフロー集約) ※将来拡張
```

## 2. Zod Validation Schemas (Zodバリデーションスキーマ)

### 2.1 Domain Validation Schemas
```typescript
// domain/cms/schemas/ValidationSchemas.ts
import { z } from 'zod';

// Content Schemas
export const ContentIdSchema = z.string().uuid('ContentId must be a valid UUID');

export const ContentSlugSchema = z
  .string()
  .min(1, 'ContentSlug cannot be empty')
  .max(100, 'ContentSlug must be 100 characters or less')
  .regex(/^[a-z0-9-]+$/, 'ContentSlug must contain only lowercase letters, numbers, and hyphens');

export const ContentTitleSchema = z
  .string()
  .min(1, 'ContentTitle cannot be empty')
  .max(200, 'ContentTitle must be 200 characters or less');

export const ContentBodySchema = z
  .string()
  .max(100000, 'ContentBody must be 100,000 characters or less');

export const ContentStatusSchema = z.enum(['draft', 'published', 'archived'], {
  errorMap: () => ({ message: 'ContentStatus must be draft, published, or archived' }),
});

// ContentType Schemas
export const ContentTypeIdSchema = z.string().uuid('ContentTypeId must be a valid UUID');

export const ContentTypeNameSchema = z
  .string()
  .min(1, 'ContentType name cannot be empty')
  .max(50, 'ContentType name must be 50 characters or less')
  .regex(/^[a-z0-9_]+$/, 'ContentType name must contain only lowercase letters, numbers, and underscores');

export const ContentTypeDisplayNameSchema = z
  .string()
  .min(1, 'ContentType display name cannot be empty')
  .max(100, 'ContentType display name must be 100 characters or less');

// ContentType Schema定義（JSON Schema形式）
export const ContentTypeSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.object({
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    title: z.string().optional(),
    description: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    enum: z.array(z.any()).optional(),
    items: z.any().optional(), // array型の場合
    properties: z.any().optional(), // object型の場合
  })).optional(),
  required: z.array(z.string()).optional(),
  additionalProperties: z.boolean().default(false),
}).strict();

// Media Schemas
export const MediaIdSchema = z.string().uuid('MediaId must be a valid UUID');

export const MediaFilenameSchema = z
  .string()
  .min(1, 'Filename cannot be empty')
  .max(255, 'Filename must be 255 characters or less');

export const MediaUrlSchema = z.string().url('MediaUrl must be a valid URL');

export const MediaSizeSchema = z
  .number()
  .int('Size must be an integer')
  .min(1, 'Size must be greater than 0')
  .max(100 * 1024 * 1024, 'Size must be less than 100MB');

export const MediaMimeTypeSchema = z
  .string()
  .regex(/^[a-z]+\/[a-z0-9\-\+\.]+$/i, 'Invalid MIME type format');
```

## 3. Value Objects (値オブジェクト)

### 3.1 Value Object 統一パターン

すべてのValue Objectは以下の統一パターンに従います：

```typescript
// domain/cms/valueObjects/ValueObjectBase.ts
export abstract class ValueObjectBase<T> {
  constructor(protected readonly value: T) {
    this.validate();
  }

  abstract validate(): void;
  
  getValue(): T {
    return this.value;
  }

  equals(other: ValueObjectBase<T>): boolean {
    if (!(other instanceof this.constructor)) {
      return false;
    }
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}

// ID系Value Objectの基底クラス
export abstract class IdentifierValueObject extends ValueObjectBase<string> {
  validate(): void {
    if (!this.value || typeof this.value !== 'string') {
      throw new Error(`Invalid ${this.constructor.name}: value must be a non-empty string`);
    }
    if (!this.isValidFormat(this.value)) {
      throw new Error(`Invalid ${this.constructor.name}: ${this.value}`);
    }
  }

  abstract isValidFormat(value: string): boolean;

  static generateUUID(): string {
    return crypto.randomUUID();
  }
}

// 文字列系Value Objectの基底クラス  
export abstract class StringValueObject extends ValueObjectBase<string> {
  protected abstract readonly minLength: number;
  protected abstract readonly maxLength: number;
  protected abstract readonly pattern?: RegExp;

  validate(): void {
    if (typeof this.value !== 'string') {
      throw new Error(`Invalid ${this.constructor.name}: must be a string`);
    }
    if (this.value.length < this.minLength) {
      throw new Error(`Invalid ${this.constructor.name}: must be at least ${this.minLength} characters`);
    }
    if (this.value.length > this.maxLength) {
      throw new Error(`Invalid ${this.constructor.name}: must be at most ${this.maxLength} characters`);
    }
    if (this.pattern && !this.pattern.test(this.value)) {
      throw new Error(`Invalid ${this.constructor.name}: does not match required pattern`);
    }
  }
}
```

### 3.2 ContentId
```typescript
// domain/cms/valueObjects/ContentId.ts
export class ContentId extends IdentifierValueObject {
  isValidFormat(value: string): boolean {
    // UUID v4 形式の検証
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidV4Regex.test(value);
  }

  // 統一されたファクトリーメソッド
  static create(): ContentId {
    return new ContentId(this.generateUUID());
  }

  static from(value: string): ContentId {
    return new ContentId(value);
  }
}
```

### 3.3 ContentSlug
```typescript
// domain/cms/valueObjects/ContentSlug.ts
export class ContentSlug extends StringValueObject {
  protected readonly minLength = 1;
  protected readonly maxLength = 100;
  protected readonly pattern = /^[a-z0-9-]+$/;

  // 統一されたファクトリーメソッド
  static from(value: string): ContentSlug {
    return new ContentSlug(value);
  }

  static fromTitle(title: string): ContentSlug {
    const normalized = this.normalizeTitle(title);
    return new ContentSlug(normalized);
  }

  private static normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .trim()
      // 日本語文字を除去（必要に応じてtransliterationライブラリを使用）
      .replace(/[^\w\s-]/g, '')
      // 連続する空白をハイフンに変換
      .replace(/\s+/g, '-')
      // 連続するハイフンを単一に
      .replace(/-+/g, '-')
      // 先頭・末尾のハイフンを除去
      .replace(/^-|-$/g, '')
      // 最大長制限
      .substring(0, 100);
  }
}
```

### 3.4 ContentTitle
```typescript
// domain/cms/valueObjects/ContentTitle.ts
export class ContentTitle extends StringValueObject {
  protected readonly minLength = 1;
  protected readonly maxLength = 200;
  protected readonly pattern?: RegExp; // パターン制限なし

  // 統一されたファクトリーメソッド
  static from(value: string): ContentTitle {
    return new ContentTitle(value);
  }

  /**
   * タイトルからスラッグを生成
   * 責務: ContentTitle → ContentSlug の変換
   */
  toSlug(): ContentSlug {
    return ContentSlug.fromTitle(this.value);
  }

  /**
   * 表示用の短縮タイトル
   */
  truncate(maxLength: number = 50): string {
    if (this.value.length <= maxLength) {
      return this.value;
    }
    return this.value.substring(0, maxLength - 3) + '...';
  }
}
```

### 3.5 ContentBody
```typescript
// domain/cms/valueObjects/ContentBody.ts
export class ContentBody extends StringValueObject {
  protected readonly minLength = 0; // 空のコンテンツを許可
  protected readonly maxLength = 100000;
  protected readonly pattern?: RegExp; // パターン制限なし

  // 統一されたファクトリーメソッド
  static from(content: string): ContentBody {
    return new ContentBody(content);
  }

  /**
   * マークダウンからプレーンテキストの抜粋を生成
   */
  toExcerpt(maxLength: number = 200): string {
    const plainText = this.removeMarkdownSyntax(this.value);
    return plainText.length > maxLength 
      ? plainText.substring(0, maxLength) + '...'
      : plainText;
  }

  private removeMarkdownSyntax(content: string): string {
    return content
      // ヘッダー記法除去
      .replace(/#{1,6}\s+/g, '')
      // Bold記法除去
      .replace(/\*\*(.*?)\*\*/g, '$1')
      // Italic記法除去
      .replace(/\*(.*?)\*/g, '$1')
      // リンク記法除去
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // インラインコード記法除去
      .replace(/`([^`]+)`/g, '$1')
      // コードブロック記法除去
      .replace(/```[\s\S]*?```/g, '')
      // 複数の改行を単一に
      .replace(/\n+/g, ' ')
      // 余分な空白を除去
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * コンテンツが空かどうか
   */
  isEmpty(): boolean {
    return this.value.trim().length === 0;
  }

  /**
   * 推定読了時間（分）を計算
   * 一般的な読書速度: 200-300語/分を基準
   */
  estimatedReadingTime(): number {
    const wordsPerMinute = 250;
    const wordCount = this.value.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * 文字数カウント
   */
  getCharacterCount(): number {
    return this.value.length;
  }

  /**
   * 単語数カウント（英語基準）
   */
  getWordCount(): number {
    return this.value.split(/\s+/).filter(word => word.length > 0).length;
  }
}
```

### 3.5 Media Value Objects
```typescript
// domain/cms/valueObjects/MediaId.ts
import { MediaIdSchema } from '../schemas/ValidationSchemas';

export class MediaId {
  constructor(private readonly value: string) {
    const result = MediaIdSchema.safeParse(value);
    if (!result.success) {
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

// domain/cms/valueObjects/MediaFilename.ts
import { MediaFilenameSchema } from '../schemas/ValidationSchemas';

export class MediaFilename {
  constructor(private readonly value: string) {
    const result = MediaFilenameSchema.safeParse(value);
    if (!result.success) {
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

// domain/cms/valueObjects/MediaUrl.ts
import { MediaUrlSchema } from '../schemas/ValidationSchemas';

export class MediaUrl {
  constructor(private readonly value: string) {
    const result = MediaUrlSchema.safeParse(value);
    if (!result.success) {
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

// domain/cms/valueObjects/MediaSize.ts
import { MediaSizeSchema } from '../schemas/ValidationSchemas';

export class MediaSize {
  constructor(private readonly bytes: number) {
    const result = MediaSizeSchema.safeParse(bytes);
    if (!result.success) {
      throw new Error(`Invalid MediaSize: ${result.error.issues[0].message}`);
    }
  }

  getBytes(): number {
    return this.bytes;
  }

  getKilobytes(): number {
    return Math.round(this.bytes / 1024);
  }

  getMegabytes(): number {
    return Math.round(this.bytes / (1024 * 1024) * 100) / 100;
  }

  equals(other: MediaSize): boolean {
    return this.bytes === other.bytes;
  }

  static fromBytes(bytes: number): MediaSize {
    return new MediaSize(bytes);
  }
}

// domain/cms/valueObjects/MediaR2Key.ts
export class MediaR2Key extends StringValueObject {
  protected readonly minLength = 1;
  protected readonly maxLength = 1024; // R2のキー最大長
  protected readonly pattern?: RegExp; // パターン制限なし（S3互換）

  // 統一されたファクトリーメソッド
  static from(value: string): MediaR2Key {
    return new MediaR2Key(value);
  }

  static forMedia(filename: MediaFilename): MediaR2Key {
    const key = this.generateKey(filename);
    return new MediaR2Key(key);
  }

  private static generateKey(filename: MediaFilename): string {
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().substring(0, 8);
    const extension = filename.getExtension();
    
    // シンプルな時系列ベースのキー生成
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // フォルダ構造: media/YYYY/MM/timestamp-randomId.ext
    return `media/${year}/${month}/${timestamp}-${randomId}.${extension}`;
  }

  /**
   * R2キーからファイル名を抽出
   */
  extractFilename(): string {
    const parts = this.value.split('/');
    return parts[parts.length - 1];
  }

  /**
   * R2キーから拡張子を抽出
   */
  extractExtension(): string {
    const filename = this.extractFilename();
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex > 0 ? filename.substring(dotIndex + 1) : '';
  }
}
```

### 3.6 ContentType Value Objects
```typescript
// domain/cms/valueObjects/ContentTypeSchema.ts
import { ContentTypeSchemaSchema } from '../schemas/ValidationSchemas';

export class ContentTypeSchema {
  constructor(private readonly schema: any) {
    const result = ContentTypeSchemaSchema.safeParse(schema);
    if (!result.success) {
      throw new Error(`Invalid ContentTypeSchema: ${result.error.issues[0].message}`);
    }
  }

  getSchema(): any {
    return this.schema;
  }

  equals(other: ContentTypeSchema): boolean {
    return JSON.stringify(this.schema) === JSON.stringify(other.schema);
  }

  /**
   * 標準的なブログ記事スキーマ
   */
  static createBlogPostSchema(): ContentTypeSchema {
    return new ContentTypeSchema({
      type: 'object',
      properties: {
        excerpt: {
          type: 'string',
          title: 'Excerpt',
          description: 'Brief summary of the blog post',
          maxLength: 500,
        },
        tags: {
          type: 'array',
          title: 'Tags',
          description: 'Tags for categorization',
          items: { type: 'string' },
        },
        featured: {
          type: 'boolean',
          title: 'Featured',
          description: 'Whether this post is featured',
        },
      },
      required: [],
      additionalProperties: false,
    });
  }

  /**
   * 標準的なページスキーマ
   */
  static createPageSchema(): ContentTypeSchema {
    return new ContentTypeSchema({
      type: 'object',
      properties: {
        template: {
          type: 'string',
          title: 'Template',
          description: 'Page template to use',
          enum: ['default', 'landing', 'contact'],
        },
        showInNavigation: {
          type: 'boolean',
          title: 'Show in Navigation',
          description: 'Whether to show this page in navigation menu',
        },
      },
      required: ['template'],
      additionalProperties: false,
    });
  }

  /**
   * カスタムスキーマ作成
   */
  static fromObject(schema: any): ContentTypeSchema {
    return new ContentTypeSchema(schema);
  }

  /**
   * フィールド追加
   */
  addField(fieldName: string, fieldSchema: any): ContentTypeSchema {
    const newSchema = { ...this.schema };
    if (!newSchema.properties) {
      newSchema.properties = {};
    }
    newSchema.properties[fieldName] = fieldSchema;
    return new ContentTypeSchema(newSchema);
  }

  /**
   * 必須フィールド追加
   */
  addRequiredField(fieldName: string): ContentTypeSchema {
    const newSchema = { ...this.schema };
    if (!newSchema.required) {
      newSchema.required = [];
    }
    if (!newSchema.required.includes(fieldName)) {
      newSchema.required.push(fieldName);
    }
    return new ContentTypeSchema(newSchema);
  }

  /**
   * スキーマの妥当性チェック
   */
  isValidForContent(contentData: any): boolean {
    try {
      // 必須フィールドチェック
      if (this.schema.required) {
        for (const requiredField of this.schema.required) {
          if (!(requiredField in contentData)) {
            return false;
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}

// domain/cms/valueObjects/ContentTypeName.ts
import { ContentTypeNameSchema } from '../schemas/ValidationSchemas';

export class ContentTypeName {
  constructor(private readonly value: string) {
    const result = ContentTypeNameSchema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid ContentTypeName: ${result.error.issues[0].message}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ContentTypeName): boolean {
    return this.value === other.value;
  }

  static fromString(value: string): ContentTypeName {
    return new ContentTypeName(value);
  }

  // 標準的なコンテンツタイプ名
  static BLOG_POST = new ContentTypeName('blog_post');
  static PAGE = new ContentTypeName('page');
  static PRODUCT = new ContentTypeName('product');
  static NEWS = new ContentTypeName('news');
}

// domain/cms/valueObjects/ContentTypeDisplayName.ts
import { ContentTypeDisplayNameSchema } from '../schemas/ValidationSchemas';

export class ContentTypeDisplayName {
  constructor(private readonly value: string) {
    const result = ContentTypeDisplayNameSchema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid ContentTypeDisplayName: ${result.error.issues[0].message}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ContentTypeDisplayName): boolean {
    return this.value === other.value;
  }

  static fromString(value: string): ContentTypeDisplayName {
    return new ContentTypeDisplayName(value);
  }
}
```

## 4. Application DTOs (アプリケーションDTO)

### 4.1 Request DTOs with Zod Validation
```typescript
// application/dto/CreateContentRequest.ts
import { z } from 'zod';
import { ContentTitleSchema, ContentBodySchema, ContentSlugSchema, ContentTypeIdSchema } from '../../domain/cms/schemas/ValidationSchemas';

export const CreateContentRequestSchema = z.object({
  title: ContentTitleSchema,
  body: ContentBodySchema,
  slug: ContentSlugSchema.optional(),
  contentTypeId: ContentTypeIdSchema,
});

export type CreateContentRequest = z.infer<typeof CreateContentRequestSchema>;

// application/dto/UpdateContentRequest.ts
export const UpdateContentRequestSchema = z.object({
  title: ContentTitleSchema.optional(),
  body: ContentBodySchema.optional(),
  slug: ContentSlugSchema.optional(),
});

export type UpdateContentRequest = z.infer<typeof UpdateContentRequestSchema>;

// application/dto/UploadMediaRequest.ts
export const UploadMediaRequestSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  size: z.number().int().min(1).max(100 * 1024 * 1024), // 100MB
  contentType: z.string().regex(/^(image|video|application)\/.+$/, 'Invalid media type'),
});

export type UploadMediaRequest = z.infer<typeof UploadMediaRequestSchema>;
```

### 4.2 Response DTOs
```typescript
// application/dto/ContentResponse.ts
export interface ContentResponse {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contentType: {
    id: string;
    name: string;
    displayName: string;
  };
}

// application/dto/MediaResponse.ts
export interface MediaResponse {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  sizeKb: number;
  sizeMb: number;
  alt?: string;
  contentId: string | null;
  createdAt: string;
}

// application/dto/ContentListResponse.ts
export interface ContentListResponse {
  contents: ContentResponse[];
  totalCount: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// application/dto/ContentTypeResponse.ts
export interface ContentTypeResponse {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  schema: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## 5. Entities (エンティティ)

### 5.1 Content Entity
```typescript
// domain/cms/entities/Content.ts
export class Content {
  constructor(
    private readonly id: ContentId,
    private title: ContentTitle,
    private slug: ContentSlug,
    private body: ContentBody,
    private status: ContentStatus,
    private readonly contentTypeId: ContentTypeId,
    private publishedAt: Date | null = null,
    private readonly createdAt: Date = new Date(),
    private updatedAt: Date = new Date()
  ) {}

  // Getters
  getId(): ContentId {
    return this.id;
  }

  getTitle(): ContentTitle {
    return this.title;
  }

  getSlug(): ContentSlug {
    return this.slug;
  }

  getBody(): ContentBody {
    return this.body;
  }

  getStatus(): ContentStatus {
    return this.status;
  }

  getContentTypeId(): ContentTypeId {
    return this.contentTypeId;
  }

  getPublishedAt(): Date | null {
    return this.publishedAt;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  // Business Logic
  isPublished(): boolean {
    return this.status === 'published' && this.publishedAt !== null;
  }

  isDraft(): boolean {
    return this.status === 'draft';
  }

  isArchived(): boolean {
    return this.status === 'archived';
  }

  publish(): void {
    if (this.isPublished()) {
      throw new Error('Content is already published');
    }
    
    if (this.body.isEmpty()) {
      throw new Error('Cannot publish empty content');
    }

    this.status = 'published';
    this.publishedAt = new Date();
    this.updatedAt = new Date();
  }

  unpublish(): void {
    if (this.isDraft()) {
      throw new Error('Content is already unpublished');
    }

    this.status = 'draft';
    this.publishedAt = null;
    this.updatedAt = new Date();
  }

  archive(): void {
    this.status = 'archived';
    this.updatedAt = new Date();
  }

  updateTitle(title: ContentTitle): void {
    this.title = title;
    // タイトル変更時は自動でスラッグも更新
    this.slug = title.generateSlug();
    this.updatedAt = new Date();
  }

  updateBody(body: ContentBody): void {
    this.body = body;
    this.updatedAt = new Date();
  }

  updateSlug(slug: ContentSlug): void {
    this.slug = slug;
    this.updatedAt = new Date();
  }

  generateExcerpt(): string {
    return this.body.generateExcerpt();
  }

  // Factory method
  static create(title: ContentTitle, body: ContentBody, contentTypeId: ContentTypeId): Content {
    const id = ContentId.generate();
    const slug = title.generateSlug();
    const status = 'draft';
    
    return new Content(id, title, slug, body, status, contentTypeId);
  }

  static reconstruct(
    id: ContentId,
    title: ContentTitle,
    slug: ContentSlug,
    body: ContentBody,
    status: ContentStatus,
    contentTypeId: ContentTypeId,
    publishedAt: Date | null,
    createdAt: Date,
    updatedAt: Date
  ): Content {
    return new Content(id, title, slug, body, status, contentTypeId, publishedAt, createdAt, updatedAt);
  }
}
```

### 5.2 Media Entity
```typescript
// domain/cms/entities/Media.ts
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
    private readonly createdAt: Date = new Date()
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
    mimeType: string
  ): Media {
    const id = MediaId.generate();
    return new Media(id, filename, r2Key, url, size, mimeType);
  }
}
```

### 5.3 ContentType Entity (Aggregate Root強化版)
```typescript
// domain/cms/entities/ContentType.ts
export class ContentType {
  constructor(
    private readonly id: ContentTypeId,
    private name: ContentTypeName,
    private displayName: ContentTypeDisplayName,
    private description: string | null,
    private schema: ContentTypeSchema,
    private isActive: boolean = true,
    private readonly createdAt: Date = new Date(),
    private updatedAt: Date = new Date()
  ) {}

  // === Getters ===
  getId(): ContentTypeId {
    return this.id;
  }

  getName(): ContentTypeName {
    return this.name;
  }

  getDisplayName(): ContentTypeDisplayName {
    return this.displayName;
  }

  getDescription(): string | null {
    return this.description;
  }

  getSchema(): ContentTypeSchema {
    return this.schema;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  // === Core Business Logic (Aggregate Root) ===
  
  /**
   * ContentType主導でのContent作成
   * スキーマ検証もここで実行
   */
  createContent(data: ContentCreationData): Content {
    // 1. アクティブ状態チェック
    if (!this.isActive) {
      throw new Error(`ContentType '${this.name.getValue()}' is not active`);
    }

    // 2. スキーマ検証
    this.validateContentData(data);

    // 3. Value Objects作成
    const title = ContentTitle.fromString(data.title);
    const body = ContentBody.fromString(data.body);

    // 4. Content Entity作成
    const content = Content.create(title, body, this.id);

    // 5. カスタムスラッグ設定（指定された場合）
    if (data.slug) {
      const customSlug = ContentSlug.fromString(data.slug);
      content.updateSlug(customSlug);
    }

    return content;
  }

  /**
   * スキーマに基づくコンテンツデータ検証
   */
  validateContentData(data: ContentCreationData): void {
    const schemaObject = this.schema.getSchema();
    
    // 必須フィールドチェック
    if (schemaObject.required) {
      for (const requiredField of schemaObject.required) {
        if (!data.customFields || !(requiredField in data.customFields)) {
          throw new ContentValidationError(
            `Required field '${requiredField}' is missing for ContentType '${this.name.getValue()}'`
          );
        }
      }
    }

    // フィールドタイプ検証
    if (data.customFields && schemaObject.properties) {
      for (const [fieldName, fieldValue] of Object.entries(data.customFields)) {
        const fieldSchema = schemaObject.properties[fieldName];
        if (fieldSchema) {
          this.validateFieldValue(fieldName, fieldValue, fieldSchema);
        }
      }
    }

    // コンテンツタイプ固有のビジネスルール
    this.validateBusinessRules(data);
  }

  private validateFieldValue(fieldName: string, value: any, schema: any): void {
    switch (schema.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new ContentValidationError(`Field '${fieldName}' must be a string`);
        }
        if (schema.minLength && value.length < schema.minLength) {
          throw new ContentValidationError(`Field '${fieldName}' must be at least ${schema.minLength} characters`);
        }
        if (schema.maxLength && value.length > schema.maxLength) {
          throw new ContentValidationError(`Field '${fieldName}' must be at most ${schema.maxLength} characters`);
        }
        break;
        
      case 'number':
        if (typeof value !== 'number') {
          throw new ContentValidationError(`Field '${fieldName}' must be a number`);
        }
        if (schema.minimum !== undefined && value < schema.minimum) {
          throw new ContentValidationError(`Field '${fieldName}' must be at least ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          throw new ContentValidationError(`Field '${fieldName}' must be at most ${schema.maximum}`);
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new ContentValidationError(`Field '${fieldName}' must be a boolean`);
        }
        break;
        
      case 'array':
        if (!Array.isArray(value)) {
          throw new ContentValidationError(`Field '${fieldName}' must be an array`);
        }
        break;
        
      default:
        // カスタムバリデーション拡張ポイント
        break;
    }
  }

  private validateBusinessRules(data: ContentCreationData): void {
    // コンテンツタイプ固有のビジネスルール
    // 例: blog_post タイプでは excerpt が推奨、product タイプでは price が必須など
    
    if (this.name.getValue() === 'blog_post') {
      // ブログ記事固有のルール
      if (data.body.length < 100) {
        throw new ContentValidationError('Blog post content should be at least 100 characters');
      }
    }
    
    if (this.name.getValue() === 'product') {
      // プロダクト固有のルール
      if (!data.customFields?.price) {
        throw new ContentValidationError('Product must have a price');
      }
    }
  }

  /**
   * 既存Contentの更新検証
   */
  validateContentUpdate(content: Content, updateData: ContentUpdateData): void {
    // ContentTypeが変更されている場合は拒否
    if (!content.getContentTypeId().equals(this.id)) {
      throw new Error('Cannot update content with different ContentType');
    }

    // アクティブ状態チェック
    if (!this.isActive) {
      throw new Error(`ContentType '${this.name.getValue()}' is not active`);
    }

    // 更新データのスキーマ検証
    if (updateData.customFields) {
      const schemaObject = this.schema.getSchema();
      if (schemaObject.properties) {
        for (const [fieldName, fieldValue] of Object.entries(updateData.customFields)) {
          const fieldSchema = schemaObject.properties[fieldName];
          if (fieldSchema) {
            this.validateFieldValue(fieldName, fieldValue, fieldSchema);
          }
        }
      }
    }
  }

  // === Entity管理メソッド ===
  
  updateDisplayName(displayName: ContentTypeDisplayName): void {
    this.displayName = displayName;
    this.updatedAt = new Date();
  }

  updateDescription(description: string | null): void {
    this.description = description;
    this.updatedAt = new Date();
  }

  updateSchema(schema: ContentTypeSchema): void {
    this.schema = schema;
    this.updatedAt = new Date();
  }

  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  static create(
    name: ContentTypeName, 
    displayName: ContentTypeDisplayName,
    schema: ContentTypeSchema,
    description?: string
  ): ContentType {
    const id = ContentTypeId.generate();
    return new ContentType(id, name, displayName, description || null, schema);
  }
}

// === 関連データ型定義 ===

export interface ContentCreationData {
  title: string;
  body: string;
  slug?: string;
  customFields?: Record<string, any>;
}

export interface ContentUpdateData {
  title?: string;
  body?: string;
  slug?: string;
  customFields?: Record<string, any>;
}

export class ContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentValidationError';
  }
}
```

## 6. Domain Services (ドメインサービス)

### 6.1 ContentDomainService
```typescript
// domain/cms/services/ContentDomainService.ts
export class ContentDomainService {
  constructor(private contentRepository: ContentRepositoryInterface) {}

  async ensureSlugUniqueness(slug: ContentSlug, excludeContentId?: ContentId): Promise<void> {
    const existingContent = await this.contentRepository.findBySlug(slug);
    
    if (existingContent && (!excludeContentId || !existingContent.getId().equals(excludeContentId))) {
      throw new Error(`Content with slug "${slug.getValue()}" already exists`);
    }
  }

  async generateUniqueSlug(baseSlug: ContentSlug): Promise<ContentSlug> {
    let counter = 1;
    let candidateSlug = baseSlug;

    while (await this.contentRepository.findBySlug(candidateSlug)) {
      candidateSlug = ContentSlug.fromString(`${baseSlug.getValue()}-${counter}`);
      counter++;
    }

    return candidateSlug;
  }
}

### 6.2 MediaDomainService
```typescript
// domain/cms/services/MediaDomainService.ts
export class MediaDomainService {
  constructor(private mediaRepository: MediaRepositoryInterface) {}

  async findUnattachedMedia(): Promise<Media[]> {
    return await this.mediaRepository.findUnattachedMedia();
  }

  async cleanupUnattachedMedia(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const unattachedMedia = await this.mediaRepository.findUnattachedMediaOlderThan(cutoffDate);
    
    for (const media of unattachedMedia) {
      await this.mediaRepository.delete(media.getId());
    }
  }
}
```

## 7. Repository Interfaces (リポジトリインターフェース)

### 7.1 CQRS分離設計

Repository パターンを **Command/Query Responsibility Segregation (CQRS)** に従って分離し、責務を明確にします。

#### Command Repository Interface (書き込み操作)
```typescript
// domain/cms/repositories/ContentRepositoryInterface.ts
export interface ContentRepositoryInterface {
  // 基本的なCRUD操作
  save(content: Content): Promise<void>;
  delete(id: ContentId): Promise<void>;
  
  // 個別取得（Command側でも必要な最小限のクエリ）
  findById(id: ContentId): Promise<Content | null>;
  findBySlug(slug: ContentSlug): Promise<Content | null>;
}
```

#### Query Service Interface (読み込み操作)
```typescript
// domain/cms/services/ContentQueryServiceInterface.ts
export interface ContentQueryServiceInterface {
  // 検索・一覧取得
  findByContentType(
    contentTypeId: ContentTypeId, 
    criteria: PaginationCriteria
  ): Promise<ContentListResult>;
  
  findPublishedContents(criteria: ContentSearchCriteria): Promise<ContentListResult>;
  
  findByStatus(
    status: ContentStatus, 
    criteria: PaginationCriteria
  ): Promise<ContentListResult>;
  
  // 集計処理
  countByStatus(status: ContentStatus): Promise<number>;
  countByContentType(contentTypeId: ContentTypeId): Promise<number>;
  countAll(): Promise<number>;
  
  // 高度な検索
  searchByKeyword(keyword: string, criteria: SearchCriteria): Promise<ContentListResult>;
  findSimilarContents(contentId: ContentId, limit: number): Promise<Content[]>;
}

// 検索条件定義
export interface ContentSearchCriteria extends PaginationCriteria {
  contentTypeId?: ContentTypeId;
  status?: ContentStatus;
  publishedAfter?: Date;
  publishedBefore?: Date;
  authorId?: string;
}

export interface PaginationCriteria {
  page: number;
  limit: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'publishedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchCriteria extends PaginationCriteria {
  includeUnpublished?: boolean;
  fuzzySearch?: boolean;
}

// クエリ結果型
export interface ContentListResult {
  contents: Content[];
  totalCount: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### 7.2 Media Repository & Query Service

#### Media Command Repository
```typescript
// domain/cms/repositories/MediaRepositoryInterface.ts
export interface MediaRepositoryInterface {
  save(media: Media): Promise<void>;
  delete(id: MediaId): Promise<void>;
  findById(id: MediaId): Promise<Media | null>;
}
```

#### Media Query Service
```typescript
// domain/cms/services/MediaQueryServiceInterface.ts
export interface MediaQueryServiceInterface {
  findByContentId(contentId: ContentId): Promise<Media[]>;
  findUnattachedMedia(): Promise<Media[]>;
  findUnattachedMediaOlderThan(date: Date): Promise<Media[]>;
  findByMimeType(mimeType: string, criteria: PaginationCriteria): Promise<MediaListResult>;
  findBySizeRange(minSize: number, maxSize: number): Promise<Media[]>;
  getTotalStorageUsage(): Promise<number>;
}

export interface MediaListResult {
  media: Media[];
  totalCount: number;
  totalSize: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### 7.3 ContentType Repository & Query Service

#### ContentType Command Repository
```typescript
// domain/cms/repositories/ContentTypeRepositoryInterface.ts
export interface ContentTypeRepositoryInterface {
  save(contentType: ContentType): Promise<void>;
  delete(id: ContentTypeId): Promise<void>;
  findById(id: ContentTypeId): Promise<ContentType | null>;
  findByName(name: ContentTypeName): Promise<ContentType | null>;
}
```

#### ContentType Query Service
```typescript
// domain/cms/services/ContentTypeQueryServiceInterface.ts
export interface ContentTypeQueryServiceInterface {
  findAllActive(): Promise<ContentType[]>;
  findAll(): Promise<ContentType[]>;
  findWithContentCount(): Promise<ContentTypeWithCount[]>;
  findMostUsed(limit: number): Promise<ContentType[]>;
}

export interface ContentTypeWithCount {
  contentType: ContentType;
  contentCount: number;
  publishedCount: number;
}
```

## 8. Domain Events (ドメインイベント)

```typescript
// domain/cms/events/ContentPublishedEvent.ts
export class ContentPublishedEvent {
  constructor(
    public readonly contentId: ContentId,
    public readonly publishedAt: Date
  ) {}
}

// domain/cms/events/ContentCreatedEvent.ts
export class ContentCreatedEvent {
  constructor(
    public readonly contentId: ContentId,
    public readonly title: ContentTitle,
    public readonly contentTypeId: ContentTypeId,
    public readonly createdAt: Date
  ) {}
}

// domain/cms/events/ContentArchivedEvent.ts
export class ContentArchivedEvent {
  constructor(
    public readonly contentId: ContentId,
    public readonly archivedAt: Date
  ) {}
}

// domain/cms/events/MediaUploadedEvent.ts
export class MediaUploadedEvent {
  constructor(
    public readonly mediaId: MediaId,
    public readonly filename: MediaFilename,
    public readonly uploadedAt: Date
  ) {}
}

// domain/cms/events/ContentTypeCreatedEvent.ts
export class ContentTypeCreatedEvent {
  constructor(
    public readonly contentTypeId: ContentTypeId,
    public readonly name: ContentTypeName,
    public readonly createdAt: Date
  ) {}
}
```

---

これでCMSドメインモデルの設計が完了です。次はアプリケーションサービス層の設計に進みましょうか？

## 関連ドキュメント
- `blog-design-document.md` - モダンCMS設計書
- `application-service-design.md` - CMSアプリケーションサービス層設計
- `test-strategy-design.md` - DORAテスト戦略
- `ddd-development-tickets.md` - CMS開発チケット分割
- `biome-configuration.md` - Biome v2設定ガイド
