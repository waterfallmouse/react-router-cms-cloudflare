# CMSアプリケーションサービス層設計書

## 1. Application Layer概要

### 1.1 責務
- ドメインロジックのオーケストレーション
- トランザクション境界の管理
- ドメインイベントの発行
- 外部サービスとの連携
- DTOとドメインオブジェクトの変換

### 1.2 設計原則
- **CQRS (Command Query Responsibility Segregation)**: 書き込み操作と読み込み操作の分離
- **Single Responsibility**: 1つのUseCaseは1つの責務のみ
- **Dependency Inversion**: インフラ層への依存をインターフェースで抽象化
- **Testability**: ドメイン層とは独立してテスト可能

## 2. Use Case設計

### 2.1 Command Use Cases (書き込み操作)

#### CreateContentUseCase (ContentType主導版)
```typescript
// application/usecases/CreateContentUseCase.ts
export class CreateContentUseCase {
  constructor(
    private contentRepository: ContentRepositoryInterface,
    private contentDomainService: ContentDomainService,
    private contentTypeRepository: ContentTypeRepositoryInterface,
    private transactionManager: TransactionManager
  ) {}

  async execute(request: CreateContentRequest): Promise<ContentResponse> {
    return await this.transactionManager.executeInTransaction(async () => {
      // 1. リクエストバリデーション
      const validatedRequest = CreateContentRequestSchema.parse(request);

      // 2. ContentType取得（Aggregate Root）
      const contentTypeId = ContentTypeId.fromString(validatedRequest.contentTypeId);
      const contentType = await this.contentTypeRepository.findById(contentTypeId);
      if (!contentType) {
        throw new ContentTypeNotFoundError(validatedRequest.contentTypeId);
      }

      // 3. ContentType主導でContent作成（スキーマ検証含む）
      const contentData: ContentCreationData = {
        title: validatedRequest.title,
        body: validatedRequest.body,
        slug: validatedRequest.slug,
        customFields: validatedRequest.customFields,
      };

      const content = contentType.createContent(contentData);

      // 4. スラッグ重複チェック（Domain Service）
      if (validatedRequest.slug) {
        await this.contentDomainService.ensureSlugUniqueness(content.getSlug());
      } else {
        // カスタムスラッグが指定されていない場合、ユニークなスラッグを生成
        const baseSlug = content.getTitle().generateSlug();
        const uniqueSlug = await this.contentDomainService.generateUniqueSlug(baseSlug);
        content.updateSlug(uniqueSlug);
      }

      // 5. 永続化
      await this.contentRepository.save(content);

      // 6. 作成イベント発行
      const event = new ContentCreatedEvent(
        content.getId(),
        content.getTitle(),
        content.getContentTypeId(),
        content.getCreatedAt()
      );
      // イベント発行は別途実装

      // 7. レスポンスDTO変換
      return this.toResponse(content, contentType);
    });
  }

  private toResponse(content: Content, contentType: ContentType): ContentResponse {
    return {
      id: content.getId().getValue(),
      title: content.getTitle().getValue(),
      slug: content.getSlug().getValue(),
      body: content.getBody().getContent(),
      excerpt: content.generateExcerpt(),
      status: content.getStatus(),
      publishedAt: content.getPublishedAt()?.toISOString() || null,
      createdAt: content.getCreatedAt().toISOString(),
      updatedAt: content.getUpdatedAt().toISOString(),
      contentType: {
        id: contentType.getId().getValue(),
        name: contentType.getName().getValue(),
        displayName: contentType.getDisplayName().getValue(),
      },
    };
  }
}
```

#### PublishContentUseCase
```typescript
// application/usecases/PublishContentUseCase.ts
export class PublishContentUseCase {
  constructor(
    private contentRepository: ContentRepositoryInterface,
    private contentTypeRepository: ContentTypeRepositoryInterface,
    private eventDispatcher: DomainEventDispatcher,
    private transactionManager: TransactionManager
  ) {}

  async execute(contentId: string): Promise<ContentResponse> {
    return await this.transactionManager.executeInTransaction(async () => {
      // 1. コンテンツ取得
      const id = ContentId.fromString(contentId);
      const content = await this.contentRepository.findById(id);
      
      if (!content) {
        throw new ContentNotFoundError(contentId);
      }

      // 2. コンテンツタイプ取得
      const contentType = await this.contentTypeRepository.findById(content.getContentTypeId());
      if (!contentType) {
        throw new ContentTypeNotFoundError(content.getContentTypeId().getValue());
      }

      // 3. ドメインロジック実行
      content.publish();

      // 4. 永続化
      await this.contentRepository.save(content);

      // 5. ドメインイベント発行
      const event = new ContentPublishedEvent(
        content.getId(),
        content.getPublishedAt()!
      );
      await this.eventDispatcher.dispatch(event);

      // 6. レスポンス
      return this.toResponse(content, contentType);
    });
  }
}
```

#### UpdateContentUseCase
```typescript
// application/usecases/UpdateContentUseCase.ts
export class UpdateContentUseCase {
  constructor(
    private contentRepository: ContentRepositoryInterface,
    private contentTypeRepository: ContentTypeRepositoryInterface,
    private contentDomainService: ContentDomainService,
    private transactionManager: TransactionManager
  ) {}

  async execute(contentId: string, request: UpdateContentRequest): Promise<ContentResponse> {
    return await this.transactionManager.executeInTransaction(async () => {
      // 1. バリデーション
      const validatedRequest = UpdateContentRequestSchema.parse(request);
      
      // 2. 既存コンテンツ取得
      const id = ContentId.fromString(contentId);
      const content = await this.contentRepository.findById(id);
      
      if (!content) {
        throw new ContentNotFoundError(contentId);
      }

      // 3. コンテンツタイプ取得
      const contentType = await this.contentTypeRepository.findById(content.getContentTypeId());
      if (!contentType) {
        throw new ContentTypeNotFoundError(content.getContentTypeId().getValue());
      }

      // 4. 更新処理
      if (validatedRequest.title) {
        const title = ContentTitle.fromString(validatedRequest.title);
        content.updateTitle(title);
      }

      if (validatedRequest.body) {
        const body = ContentBody.fromString(validatedRequest.body);
        content.updateBody(body);
      }

      if (validatedRequest.slug) {
        const slug = ContentSlug.fromString(validatedRequest.slug);
        await this.contentDomainService.ensureSlugUniqueness(slug, id);
        content.updateSlug(slug);
      }

      // 5. 永続化
      await this.contentRepository.save(content);

      return this.toResponse(content, contentType);
    });
  }
}
```

#### UploadMediaUseCase
```typescript
// application/usecases/UploadMediaUseCase.ts
export class UploadMediaUseCase {
  constructor(
    private mediaRepository: MediaRepositoryInterface,
    private fileStorageService: FileStorageService,
    private transactionManager: TransactionManager
  ) {}

  async execute(request: UploadMediaRequest, fileBuffer: ArrayBuffer): Promise<MediaResponse> {
    return await this.transactionManager.executeInTransaction(async () => {
      // 1. バリデーション
      const validatedRequest = UploadMediaRequestSchema.parse(request);

      // 2. Value Object作成
      const filename = MediaFilename.fromString(validatedRequest.filename);
      const size = MediaSize.fromBytes(validatedRequest.size);

      // 3. R2キー生成
      const r2Key = MediaR2Key.generate(filename, validatedRequest.contentType);

      // 4. ファイルアップロード
      const uploadedUrl = await this.fileStorageService.upload(
        r2Key.getValue(),
        fileBuffer,
        validatedRequest.contentType
      );
      
      const url = MediaUrl.fromString(uploadedUrl);

      // 5. ドメインエンティティ作成
      const media = Media.create(filename, r2Key, url, size, validatedRequest.contentType);

      // 6. 永続化
      await this.mediaRepository.save(media);

      return this.toMediaResponse(media);
    });
  }
}
```

### 2.2 Query Use Cases (読み込み操作)

#### GetPublishedContentListUseCase (CQRS対応)
```typescript
// application/usecases/GetPublishedContentListUseCase.ts
export class GetPublishedContentListUseCase {
  constructor(
    private contentQueryService: ContentQueryServiceInterface,
    private contentTypeQueryService: ContentTypeQueryServiceInterface
  ) {}

  async execute(request: GetContentListRequest): Promise<ContentListResponse> {
    // 1. リクエストバリデーション
    const validatedRequest = GetContentListRequestSchema.parse(request);
    
    // 2. 検索条件構築
    const criteria: ContentSearchCriteria = {
      page: validatedRequest.page || 1,
      limit: Math.min(validatedRequest.limit || 10, 100),
      sortBy: validatedRequest.sortBy || 'publishedAt',
      sortOrder: validatedRequest.sortOrder || 'desc',
      status: 'published',
    };

    // 3. コンテンツタイプフィルター処理
    if (validatedRequest.contentTypeName) {
      const contentTypeName = ContentTypeName.fromString(validatedRequest.contentTypeName);
      const contentType = await this.contentTypeRepository.findByName(contentTypeName);
      if (!contentType) {
        throw new ContentTypeNotFoundError(validatedRequest.contentTypeName);
      }
      criteria.contentTypeId = contentType.getId();
    }

    // 4. コンテンツ取得（Query Service使用）
    const result = await this.contentQueryService.findPublishedContents(criteria);

    // 5. コンテンツタイプ情報取得（バッチ処理で効率化）
    const contentTypeIds = [...new Set(result.contents.map(c => c.getContentTypeId()))];
    const contentTypes = await Promise.all(
      contentTypeIds.map(id => this.contentTypeRepository.findById(id))
    );
    const contentTypeMap = new Map(
      contentTypes.filter(ct => ct !== null).map(ct => [ct!.getId().getValue(), ct!])
    );

    // 6. レスポンス構築
    return {
      contents: result.contents.map(content => 
        this.toResponse(content, contentTypeMap.get(content.getContentTypeId().getValue())!)
      ),
      totalCount: result.totalCount,
      page: result.page,
      limit: result.limit,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
    };
  }

  private toResponse(content: Content, contentType: ContentType): ContentResponse {
    return {
      id: content.getId().getValue(),
      title: content.getTitle().getValue(),
      slug: content.getSlug().getValue(),
      body: content.getBody().getContent(),
      excerpt: content.generateExcerpt(),
      status: content.getStatus(),
      publishedAt: content.getPublishedAt()?.toISOString() || null,
      createdAt: content.getCreatedAt().toISOString(),
      updatedAt: content.getUpdatedAt().toISOString(),
      contentType: {
        id: contentType.getId().getValue(),
        name: contentType.getName().getValue(),
        displayName: contentType.getDisplayName().getValue(),
      },
    };
  }
}

// 新しいRequest DTO
export const GetContentListRequestSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  contentTypeName: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'publishedAt', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type GetContentListRequest = z.infer<typeof GetContentListRequestSchema>;
```

#### GetContentDetailUseCase (CQRS対応)
```typescript
// application/usecases/GetContentDetailUseCase.ts
export class GetContentDetailUseCase {
  constructor(
    private contentRepository: ContentRepositoryInterface, // 個別取得はCommand側でも必要
    private contentTypeRepository: ContentTypeRepositoryInterface
  ) {}

  async execute(slug: string): Promise<ContentResponse> {
    // 1. スラッグ検証
    const contentSlug = ContentSlug.fromString(slug);
    
    // 2. コンテンツ取得
    const content = await this.contentRepository.findBySlug(contentSlug);
    
    if (!content) {
      throw new ContentNotFoundError(`Content with slug: ${slug}`);
    }

    // 3. 公開状態チェック（公開コンテンツのみ）
    if (!content.isPublished()) {
      throw new ContentNotFoundError(`Content with slug: ${slug}`);
    }

    // 4. コンテンツタイプ取得
    const contentType = await this.contentTypeRepository.findById(content.getContentTypeId());
    if (!contentType) {
      throw new ContentTypeNotFoundError(content.getContentTypeId().getValue());
    }

    return this.toResponse(content, contentType);
  }

  private toResponse(content: Content, contentType: ContentType): ContentResponse {
    return {
      id: content.getId().getValue(),
      title: content.getTitle().getValue(),
      slug: content.getSlug().getValue(),
      body: content.getBody().getContent(),
      excerpt: content.generateExcerpt(),
      status: content.getStatus(),
      publishedAt: content.getPublishedAt()?.toISOString() || null,
      createdAt: content.getCreatedAt().toISOString(),
      updatedAt: content.getUpdatedAt().toISOString(),
      contentType: {
        id: contentType.getId().getValue(),
        name: contentType.getName().getValue(),
        displayName: contentType.getDisplayName().getValue(),
      },
    };
  }
}
```

## 3. DTO設計

### 3.1 Request DTOs
```typescript
// application/dto/CreateContentRequest.ts
export const CreateContentRequestSchema = z.object({
  title: ContentTitleSchema,
  body: ContentBodySchema,
  slug: ContentSlugSchema.optional(),
  contentTypeId: ContentTypeIdSchema,
  customFields: z.record(z.any()).optional(), // ContentType固有のフィールド
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
  size: z.number().int().min(1).max(100 * 1024 * 1024),
  contentType: z.string().regex(/^(image|video|application)\/.+$/, 'Invalid media type'),
});

export type UploadMediaRequest = z.infer<typeof UploadMediaRequestSchema>;

// application/dto/CreateContentTypeRequest.ts
export const CreateContentTypeRequestSchema = z.object({
  name: ContentTypeNameSchema,
  displayName: ContentTypeDisplayNameSchema,
  description: z.string().optional(),
  schema: ContentTypeSchemaSchema,
});

export type CreateContentTypeRequest = z.infer<typeof CreateContentTypeRequestSchema>;
```

### 3.2 Response DTOs
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

## 4. Error Handling

### 4.1 Application Errors
```typescript
// application/errors/ApplicationErrors.ts
export class ContentNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Content not found: ${identifier}`);
    this.name = 'ContentNotFoundError';
  }
}

export class ContentTypeNotFoundError extends Error {
  constructor(identifier: string) {
    super(`ContentType not found: ${identifier}`);
    this.name = 'ContentTypeNotFoundError';
  }
}

export class MediaNotFoundError extends Error {
  constructor(mediaId: string) {
    super(`Media with ID ${mediaId} not found`);
    this.name = 'MediaNotFoundError';
  }
}

export class DuplicateSlugError extends Error {
  constructor(slug: string) {
    super(`Content with slug '${slug}' already exists`);
    this.name = 'DuplicateSlugError';
  }
}

export class DuplicateContentTypeNameError extends Error {
  constructor(name: string) {
    super(`ContentType with name '${name}' already exists`);
    this.name = 'DuplicateContentTypeNameError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly details: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class FileUploadError extends Error {
  constructor(message: string) {
    super(`File upload failed: ${message}`);
    this.name = 'FileUploadError';
  }
}
```

## 5. Services & Infrastructure Interfaces

### 5.1 Transaction Management
```typescript
// application/services/TransactionManager.ts
export interface TransactionManager {
  executeInTransaction<T>(operation: () => Promise<T>): Promise<T>;
}
```

### 5.2 Domain Event Handling
```typescript
// application/services/DomainEventDispatcher.ts
export interface DomainEventDispatcher {
  dispatch(event: DomainEvent): Promise<void>;
}

// application/handlers/ContentPublishedEventHandler.ts
export class ContentPublishedEventHandler {
  async handle(event: ContentPublishedEvent): Promise<void> {
    // 公開時の処理（例：通知送信、キャッシュクリア等）
    console.log(`Content ${event.contentId.getValue()} was published at ${event.publishedAt}`);
    
    // 将来的な拡張例:
    // - 検索インデックス更新
    // - RSS/Atomフィード更新
    // - ソーシャルメディア自動投稿
    // - アナリティクス記録
    // - サイトマップ更新
  }
}

// application/handlers/ContentCreatedEventHandler.ts
export class ContentCreatedEventHandler {
  async handle(event: ContentCreatedEvent): Promise<void> {
    console.log(`Content ${event.contentId.getValue()} was created for content type ${event.contentTypeId.getValue()}`);
    
    // 作成時の処理:
    // - 作成ログ記録
    // - ワークフロー開始
    // - テンプレート自動適用
  }
}
```

### 5.3 File Storage Service
```typescript
// application/services/FileStorageService.ts
export interface FileStorageService {
  upload(key: string, buffer: ArrayBuffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}
```

## 6. Dependency Injection

### 6.1 Container設計
```typescript
// application/di/Container.ts
export class Container {
  constructor(private cloudflareEnv: CloudflareEnv) {}

  // Repository instances (Command側)
  private getContentRepository(): ContentRepositoryInterface {
    return new PrismaContentRepository(this.getPrismaClient());
  }

  private getContentTypeRepository(): ContentTypeRepositoryInterface {
    return new PrismaContentTypeRepository(this.getPrismaClient());
  }

  private getMediaRepository(): MediaRepositoryInterface {
    return new CloudflareR2MediaRepository(
      this.getPrismaClient(),
      this.cloudflareEnv.R2_BUCKET
    );
  }

  // Query Service instances (Query側)
  private getContentQueryService(): ContentQueryServiceInterface {
    return new PrismaContentQueryService(this.getPrismaClient());
  }

  private getContentTypeQueryService(): ContentTypeQueryServiceInterface {
    return new PrismaContentTypeQueryService(this.getPrismaClient());
  }

  private getMediaQueryService(): MediaQueryServiceInterface {
    return new PrismaMediaQueryService(this.getPrismaClient());
  }

  // Service instances
  private getContentDomainService(): ContentDomainService {
    return new ContentDomainService(this.getContentRepository());
  }

  private getMediaDomainService(): MediaDomainService {
    return new MediaDomainService(this.getMediaRepository());
  }

  private getTransactionManager(): TransactionManager {
    return new PrismaTransactionManager(this.getPrismaClient());
  }

  private getDomainEventDispatcher(): DomainEventDispatcher {
    return new InMemoryDomainEventDispatcher();
  }

  private getFileStorageService(): FileStorageService {
    return new CloudflareR2StorageService(this.cloudflareEnv.R2_BUCKET);
  }

  // Use Case factory methods
  getCreateContentUseCase(): CreateContentUseCase {
    return new CreateContentUseCase(
      this.getContentRepository(),
      this.getContentDomainService(),
      this.getContentTypeRepository(),
      this.getTransactionManager()
    );
  }

  getPublishContentUseCase(): PublishContentUseCase {
    return new PublishContentUseCase(
      this.getContentRepository(),
      this.getContentTypeRepository(),
      this.getDomainEventDispatcher(),
      this.getTransactionManager()
    );
  }

  getUpdateContentUseCase(): UpdateContentUseCase {
    return new UpdateContentUseCase(
      this.getContentRepository(),
      this.getContentTypeRepository(),
      this.getContentDomainService(),
      this.getTransactionManager()
    );
  }

  getDeleteContentUseCase(): DeleteContentUseCase {
    return new DeleteContentUseCase(
      this.getContentRepository(),
      this.getTransactionManager()
    );
  }

  getGetPublishedContentListUseCase(): GetPublishedContentListUseCase {
    return new GetPublishedContentListUseCase(
      this.getContentQueryService(),      // Query Service使用
      this.getContentTypeQueryService()   // Query Service使用
    );
  }

  getGetContentDetailUseCase(): GetContentDetailUseCase {
    return new GetContentDetailUseCase(
      this.getContentRepository(),        // 個別取得はCommand側Repository
      this.getContentTypeRepository()     // Command側Repository
    );
  }

  getUploadMediaUseCase(): UploadMediaUseCase {
    return new UploadMediaUseCase(
      this.getMediaRepository(),
      this.getFileStorageService(),
      this.getTransactionManager()
    );
  }

  getCreateContentTypeUseCase(): CreateContentTypeUseCase {
    return new CreateContentTypeUseCase(
      this.getContentTypeRepository(),
      this.getTransactionManager()
    );
  }

  private getPrismaClient(): PrismaClient {
    return new PrismaClient({
      datasources: {
        db: {
          url: this.cloudflareEnv.DATABASE_URL,
        },
      },
    });
  }
}
```

## 7. Testing Strategy

### 7.1 Unit Testing
```typescript
// tests/unit/application/usecases/CreatePostUseCase.test.ts
describe('CreateContentUseCase', () => {
  let mockContentRepository: jest.Mocked<ContentRepositoryInterface>;
  let mockContentTypeRepository: jest.Mocked<ContentTypeRepositoryInterface>;
  let mockContentDomainService: jest.Mocked<ContentDomainService>;
  let mockTransactionManager: jest.Mocked<TransactionManager>;
  let useCase: CreateContentUseCase;

  beforeEach(() => {
    mockContentRepository = createMockContentRepository();
    mockContentTypeRepository = createMockContentTypeRepository();
    mockContentDomainService = createMockContentDomainService();
    mockTransactionManager = createMockTransactionManager();
    
    useCase = new CreateContentUseCase(
      mockContentRepository,
      mockContentDomainService,
      mockContentTypeRepository,
      mockTransactionManager
    );
  });

  describe('execute', () => {
    it('should create content successfully', async () => {
      // Arrange
      const mockContentType = ContentType.create(
        ContentTypeName.fromString('blog_post'),
        ContentTypeDisplayName.fromString('ブログ記事'),
        ContentTypeSchema.fromObject({})
      );
      
      const request = {
        title: 'Test Title',
        body: '# Test Content',
        contentTypeId: mockContentType.getId().getValue(),
      };

      mockTransactionManager.executeInTransaction.mockImplementation(async (fn) => fn());
      mockContentTypeRepository.findById.mockResolvedValue(mockContentType);
      mockContentDomainService.generateUniqueSlug.mockResolvedValue(
        ContentSlug.fromString('test-title')
      );
      mockContentRepository.save.mockResolvedValue();

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toHaveProperty('id');
      expect(result.title).toBe('Test Title');
      expect(mockContentRepository.save).toHaveBeenCalledOnce();
    });

    it('should throw error for invalid content type', async () => {
      // Arrange
      const request = {
        title: 'Test Title',
        body: '# Test Content',
        contentTypeId: 'invalid-content-type-id',
      };

      mockContentTypeRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow(ContentTypeNotFoundError);
    });
  });
});
```

## 8. 利用パターン例

### 8.1 React Router v7 での利用
```typescript
// app/routes/admin/api/content/route.ts
export async function action({ request, context }: ActionFunctionArgs) {
  const container = new Container(context.cloudflare);
  const useCase = container.getCreateContentUseCase();

  try {
    const body = await request.json();
    const result = await useCase.execute(body);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }
    if (error instanceof ContentTypeNotFoundError) {
      return Response.json(
        { error: error.message },
        { status: 404 }
      );
    }
    return Response.json(
      { error: 'Failed to create content' },
      { status: 500 }
    );
  }
}
```

---

このCMS対応アプリケーションサービス層設計により、ビジネスロジックを適切にカプセル化し、テストしやすく保守性の高いアプリケーション層を実現できます。汎用的なCMSとしての拡張性と、ブログをはじめとする様々なコンテンツタイプへの対応が可能です。

## 関連ドキュメント
- `blog-design-document.md` - モダンCMS設計書
- `ddd-domain-design.md` - CMSドメインモデル詳細設計
- `test-strategy-design.md` - DORAテスト戦略
- `ddd-development-tickets.md` - CMS開発チケット分割
- `biome-configuration.md` - Biome v2設定ガイド