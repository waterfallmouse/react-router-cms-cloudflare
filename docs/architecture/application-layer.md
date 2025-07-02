# CMS Application Service Layer Design

## 1. Application Layer Overview

### 1.1 Responsibilities
- Orchestration of domain logic
- Management of transaction boundaries
- Dispatching of domain events
- Integration with external services
- Conversion between DTOs and domain objects

### 1.2 Design Principles
- **CQRS (Command Query Responsibility Segregation)**: Separation of write and read operations.
- **Single Responsibility**: One UseCase has only one responsibility.
- **Dependency Inversion**: Abstracting dependencies on the infrastructure layer through interfaces.
- **Testability**: Can be tested independently of the domain layer.

## 2. Use Case Design

### 2.1 Command Use Cases (Write Operations)

#### CreateContentUseCase (ContentType-driven version)
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
      // 1. Request validation
      const validatedRequest = CreateContentRequestSchema.parse(request);

      // 2. Get ContentType (Aggregate Root)
      const contentTypeId = ContentTypeId.fromString(validatedRequest.contentTypeId);
      const contentType = await this.contentTypeRepository.findById(contentTypeId);
      if (!contentType) {
        throw new ContentTypeNotFoundError(validatedRequest.contentTypeId);
      }

      // 3. Create Content led by ContentType (including schema validation)
      const contentData: ContentCreationData = {
        title: validatedRequest.title,
        body: validatedRequest.body,
        slug: validatedRequest.slug,
        customFields: validatedRequest.customFields,
      };

      const content = contentType.createContent(contentData);

      // 4. Slug duplication check (Domain Service)
      if (validatedRequest.slug) {
        await this.contentDomainService.ensureSlugUniqueness(content.getSlug());
      } else {
        // If a custom slug is not specified, generate a unique one
        const baseSlug = content.getTitle().generateSlug();
        const uniqueSlug = await this.contentDomainService.generateUniqueSlug(baseSlug);
        content.updateSlug(uniqueSlug);
      }

      // 5. Persistence
      await this.contentRepository.save(content);

      // 6. Dispatch creation event
      const event = new ContentCreatedEvent(
        content.getId(),
        content.getTitle(),
        content.getContentTypeId(),
        content.getCreatedAt()
      );
      // Event dispatching will be implemented separately

      // 7. Convert to response DTO
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
      // 1. Get content
      const id = ContentId.fromString(contentId);
      const content = await this.contentRepository.findById(id);
      
      if (!content) {
        throw new ContentNotFoundError(contentId);
      }

      // 2. Get content type
      const contentType = await this.contentTypeRepository.findById(content.getContentTypeId());
      if (!contentType) {
        throw new ContentTypeNotFoundError(content.getContentTypeId().getValue());
      }

      // 3. Execute domain logic
      content.publish();

      // 4. Persistence
      await this.contentRepository.save(content);

      // 5. Dispatch domain event
      const event = new ContentPublishedEvent(
        content.getId(),
        content.getPublishedAt()!
      );
      await this.eventDispatcher.dispatch(event);

      // 6. Response
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
      // 1. Validation
      const validatedRequest = UpdateContentRequestSchema.parse(request);
      
      // 2. Get existing content
      const id = ContentId.fromString(contentId);
      const content = await this.contentRepository.findById(id);
      
      if (!content) {
        throw new ContentNotFoundError(contentId);
      }

      // 3. Get content type
      const contentType = await this.contentTypeRepository.findById(content.getContentTypeId());
      if (!contentType) {
        throw new ContentTypeNotFoundError(content.getContentTypeId().getValue());
      }

      // 4. Update process
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

      // 5. Persistence
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
      // 1. Validation
      const validatedRequest = UploadMediaRequestSchema.parse(request);

      // 2. Create Value Objects
      const filename = MediaFilename.fromString(validatedRequest.filename);
      const size = MediaSize.fromBytes(validatedRequest.size);

      // 3. Generate R2 key
      const r2Key = MediaR2Key.generate(filename, validatedRequest.contentType);

      // 4. File upload
      const uploadedUrl = await this.fileStorageService.upload(
        r2Key.getValue(),
        fileBuffer,
        validatedRequest.contentType
      );
      
      const url = MediaUrl.fromString(uploadedUrl);

      // 5. Create domain entity
      const media = Media.create(filename, r2Key, url, size, validatedRequest.contentType);

      // 6. Persistence
      await this.mediaRepository.save(media);

      return this.toMediaResponse(media);
    });
  }
}
```

### 2.2 Query Use Cases (Read Operations)

#### GetPublishedContentListUseCase (CQRS Compliant)
```typescript
// application/usecases/GetPublishedContentListUseCase.ts
export class GetPublishedContentListUseCase {
  constructor(
    private contentQueryService: ContentQueryServiceInterface,
    private contentTypeQueryService: ContentTypeQueryServiceInterface
  ) {}

  async execute(request: GetContentListRequest): Promise<ContentListResponse> {
    // 1. Request validation
    const validatedRequest = GetContentListRequestSchema.parse(request);
    
    // 2. Build search criteria
    const criteria: ContentSearchCriteria = {
      page: validatedRequest.page || 1,
      limit: Math.min(validatedRequest.limit || 10, 100),
      sortBy: validatedRequest.sortBy || 'publishedAt',
      sortOrder: validatedRequest.sortOrder || 'desc',
      status: 'published',
    };

    // 3. Content type filter process
    if (validatedRequest.contentTypeName) {
      const contentTypeName = ContentTypeName.fromString(validatedRequest.contentTypeName);
      const contentType = await this.contentTypeRepository.findByName(contentTypeName);
      if (!contentType) {
        throw new ContentTypeNotFoundError(validatedRequest.contentTypeName);
      }
      criteria.contentTypeId = contentType.getId();
    }

    // 4. Get content (using Query Service)
    const result = await this.contentQueryService.findPublishedContents(criteria);

    // 5. Get content type info (optimized with batch processing)
    const contentTypeIds = [...new Set(result.contents.map(c => c.getContentTypeId()))];
    const contentTypes = await Promise.all(
      contentTypeIds.map(id => this.contentTypeRepository.findById(id))
    );
    const contentTypeMap = new Map(
      contentTypes.filter(ct => ct !== null).map(ct => [ct!.getId().getValue(), ct!])
    );

    // 6. Build response
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

// New Request DTO
export const GetContentListRequestSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  contentTypeName: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'publishedAt', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type GetContentListRequest = z.infer<typeof GetContentListRequestSchema>;
```

#### GetContentDetailUseCase (CQRS Compliant)
```typescript
// application/usecases/GetContentDetailUseCase.ts
export class GetContentDetailUseCase {
  constructor(
    private contentRepository: ContentRepositoryInterface, // Individual retrieval is also needed on the Command side
    private contentTypeRepository: ContentTypeRepositoryInterface
  ) {}

  async execute(slug: string): Promise<ContentResponse> {
    // 1. Slug validation
    const contentSlug = ContentSlug.fromString(slug);
    
    // 2. Get content
    const content = await this.contentRepository.findBySlug(contentSlug);
    
    if (!content) {
      throw new ContentNotFoundError(`Content with slug: ${slug}`);
    }

    // 3. Check published status (published content only)
    if (!content.isPublished()) {
      throw new ContentNotFoundError(`Content with slug: ${slug}`);
    }

    // 4. Get content type
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

## 3. DTO Design

### 3.1 Request DTOs
```typescript
// application/dto/CreateContentRequest.ts
export const CreateContentRequestSchema = z.object({
  title: ContentTitleSchema,
  body: ContentBodySchema,
  slug: ContentSlugSchema.optional(),
  contentTypeId: ContentTypeIdSchema,
  customFields: z.record(z.any()).optional(), // Fields specific to ContentType
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
    // Processing on publish (e.g., send notifications, clear cache, etc.)
    console.log(`Content ${event.contentId.getValue()} was published at ${event.publishedAt}`);
    
    // Future extension examples:
    // - Update search index
    // - Update RSS/Atom feed
    // - Auto-post to social media
    // - Record analytics
    // - Update sitemap
  }
}

// application/handlers/ContentCreatedEventHandler.ts
export class ContentCreatedEventHandler {
  async handle(event: ContentCreatedEvent): Promise<void> {
    console.log(`Content ${event.contentId.getValue()} was created for content type ${event.contentTypeId.getValue()}`);
    
    // Processing on creation:
    // - Log creation
    // - Start workflow
    // - Auto-apply template
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

### 6.1 Container Design
```typescript
// application/di/Container.ts
export class Container {
  constructor(private cloudflareEnv: CloudflareEnv) {}

  // Repository instances (Command side)
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

  // Query Service instances (Query side)
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
      this.getContentQueryService(),      // Use Query Service
      this.getContentTypeQueryService()   // Use Query Service
    );
  }

  getGetContentDetailUseCase(): GetContentDetailUseCase {
    return new GetContentDetailUseCase(
      this.getContentRepository(),        // Individual retrieval uses Command-side Repository
      this.getContentTypeRepository()     // Command-side Repository
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
        ContentTypeDisplayName.fromString('Blog Post'),
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

## 8. Usage Pattern Example

### 8.1 Usage with React Router v7
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

This CMS-compliant application service layer design allows for proper encapsulation of business logic, resulting in a highly testable and maintainable application layer. It provides extensibility as a general-purpose CMS and supports various content types, including blogs.

## Related Documents
- [overview.md](overview.md) - Modern CMS Design Document
- [domain-design.md](domain-design.md) - CMS Domain Model Detailed Design
- [../implementation/testing-strategy.md](../implementation/testing-strategy.md) - DORA Testing Strategy
- [../../development-tickets.md](../../development-tickets.md) - CMS Development Ticket Breakdown
- [../../biome.json](../../biome.json) - Biome v2 Configuration Guide

---

**Last Updated**: 2025-07-02
**Version**: 2.0  
**Status**: Application Layer Design Complete  
**対象**: アーキテクト・開発者
