# ブログサービス テスト戦略設計

## 1. DORA テスト自動化ベストプラクティス

### 1.1 継続的テストアプローチ
- ソフトウェア配信ライフサイクル全体でテスト実施
- CI/CDパイプラインに統合された高速で信頼性の高い自動テストスイート

### 1.2 テストピラミッド構造
```
        E2E Tests (少数)
           /\
      Integration Tests (中程度)
         /\
    Unit Tests (多数・基盤)
```

**原則**:
- 大部分をユニットテストが占める
- 統合/受け入れテストは適度な数
- E2E/手動テストは最小限

## 2. DDD + React Router v7 用テスト戦略

### 2.1 レイヤー別テスト構成

```typescript
tests/
├── unit/                    # ユニットテスト (70-80%)
│   ├── domain/
│   │   ├── valueObjects/    # Value Object テスト
│   │   ├── entities/        # Entity テスト
│   │   └── services/        # Domain Service テスト
│   ├── application/
│   │   └── usecases/        # UseCase テスト
│   └── infrastructure/
│       └── repositories/    # Repository テスト
├── integration/             # 統合テスト (15-25%)
│   ├── api/                 # API エンドポイントテスト
│   ├── database/            # DB統合テスト
│   └── external/            # 外部サービス統合
└── e2e/                     # E2Eテスト (5-10%)
    ├── user-flows/          # ユーザーフローテスト
    └── admin-flows/         # 管理者フローテスト
```

### 2.2 テスト技術選定

```typescript
// テストフレームワーク
- Bun Test: 高速なユニット・統合テスト (内蔵テストランナー)
- Playwright: E2Eテスト (React Router v7対応)
- Testing Library: React コンポーネントテスト (Bun Test互換)

// モック・テストダブル
- Bun.mock(): Bun標準モック機能
- MSW: API モッキング
- Test Containers: データベース統合テスト (可能であれば)
```

## 3. ユニットテスト戦略 (70-80%)

### 3.1 Domain Layer Tests

#### Value Object Tests
```typescript
// tests/unit/domain/valueObjects/PostTitle.test.ts
import { describe, it, expect } from 'bun:test';
import { PostTitle } from '../../../../src/domain/blog/valueObjects/PostTitle';

describe('PostTitle', () => {
  describe('constructor', () => {
    it('should create valid PostTitle', () => {
      const title = new PostTitle('Valid Title');
      expect(title.getValue()).toBe('Valid Title');
    });

    it('should throw error for empty title', () => {
      expect(() => new PostTitle('')).toThrow('PostTitle cannot be empty');
    });

    it('should throw error for title over 200 characters', () => {
      const longTitle = 'a'.repeat(201);
      expect(() => new PostTitle(longTitle)).toThrow('PostTitle must be 200 characters or less');
    });
  });

  describe('generateSlug', () => {
    it('should generate valid slug from title', () => {
      const title = new PostTitle('Hello World Example');
      const slug = title.generateSlug();
      expect(slug.getValue()).toBe('hello-world-example');
    });
  });
});
```

#### Entity Tests
```typescript
// tests/unit/domain/entities/Post.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { Post } from '../../../../src/domain/blog/entities/Post';
import { PostTitle } from '../../../../src/domain/blog/valueObjects/PostTitle';
import { PostContent } from '../../../../src/domain/blog/valueObjects/PostContent';

describe('Post Entity', () => {
  let validTitle: PostTitle;
  let validContent: PostContent;

  beforeEach(() => {
    validTitle = new PostTitle('Test Title');
    validContent = new PostContent('# Test Content');
  });

  describe('create', () => {
    it('should create new post with generated ID and slug', () => {
      const post = Post.create(validTitle, validContent);
      
      expect(post.getId().getValue()).toMatch(/^[0-9a-f-]{36}$/);
      expect(post.getTitle()).toBe(validTitle);
      expect(post.getContent()).toBe(validContent);
      expect(post.isDraft()).toBe(true);
    });
  });

  describe('publish', () => {
    it('should publish draft post', () => {
      const post = Post.create(validTitle, validContent);
      post.publish();
      
      expect(post.isPublished()).toBe(true);
      expect(post.getPublishedAt()).toBeInstanceOf(Date);
    });

    it('should throw error when publishing already published post', () => {
      const post = Post.create(validTitle, validContent);
      post.publish();
      
      expect(() => post.publish()).toThrow('Post is already published');
    });

    it('should throw error when publishing empty content', () => {
      const emptyContent = new PostContent('');
      const post = Post.create(validTitle, emptyContent);
      
      expect(() => post.publish()).toThrow('Cannot publish empty post');
    });
  });
});
```

### 3.2 Application Layer Tests

#### UseCase Tests (TDD推奨)
```typescript
// tests/unit/application/usecases/CreatePostUseCase.test.ts
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { CreatePostUseCase } from '../../../../src/application/usecases/CreatePostUseCase';
import { PostRepositoryInterface } from '../../../../src/domain/blog/repositories/PostRepositoryInterface';
import { PostDomainService } from '../../../../src/domain/blog/services/PostDomainService';

describe('CreatePostUseCase', () => {
  let mockPostRepository: PostRepositoryInterface;
  let mockPostDomainService: PostDomainService;
  let useCase: CreatePostUseCase;

  beforeEach(() => {
    mockPostRepository = {
      save: mock(),
      findBySlug: mock(),
      // ... other methods
    } as any;

    mockPostDomainService = {
      ensureSlugUniqueness: mock(),
    } as any;

    useCase = new CreatePostUseCase(mockPostRepository, mockPostDomainService);
  });

  describe('execute', () => {
    it('should create post successfully', async () => {
      const request = {
        title: 'Test Title',
        content: '# Test Content',
      };

      mockPostDomainService.ensureSlugUniqueness.mockResolvedValue();
      mockPostRepository.save.mockResolvedValue();

      const result = await useCase.execute(request);

      expect(result).toHaveProperty('id');
      expect(result.title).toBe('Test Title');
      expect(mockPostRepository.save).toHaveBeenCalledOnce();
    });

    it('should throw error for duplicate slug', async () => {
      const request = {
        title: 'Test Title',
        content: '# Test Content',
      };

      mockPostDomainService.ensureSlugUniqueness
        .mockRejectedValue(new Error('Slug already exists'));

      await expect(useCase.execute(request)).rejects.toThrow('Slug already exists');
    });
  });
});
```

## 4. 統合テスト戦略 (15-25%)

### 4.1 API Integration Tests
```typescript
// tests/integration/api/posts.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { testClient } from '../helpers/testClient';
import { resetDatabase, seedTestData } from '../helpers/database';

describe('Posts API Integration', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedTestData();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  describe('POST /api/posts', () => {
    it('should create new post', async () => {
      const postData = {
        title: 'Integration Test Post',
        content: '# Test Content',
      };

      const response = await testClient.post('/api/posts', {
        json: postData,
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('id');
      expect(body.title).toBe(postData.title);
    });
  });

  describe('GET /api/posts', () => {
    it('should return published posts only', async () => {
      const response = await testClient.get('/api/posts');
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.posts).toBeInstanceOf(Array);
      body.posts.forEach(post => {
        expect(post.published).toBe(true);
      });
    });
  });
});
```

### 4.2 Database Integration Tests
```typescript
// tests/integration/database/PostRepository.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PrismaPostRepository } from '../../../src/infrastructure/repositories/PrismaPostRepository';
import { testPrisma } from '../helpers/testDatabase';
import { Post } from '../../../src/domain/blog/entities/Post';
import { PostTitle } from '../../../src/domain/blog/valueObjects/PostTitle';
import { PostContent } from '../../../src/domain/blog/valueObjects/PostContent';

describe('PrismaPostRepository Integration', () => {
  let repository: PrismaPostRepository;

  beforeEach(async () => {
    repository = new PrismaPostRepository(testPrisma);
    await testPrisma.post.deleteMany(); // Clean slate
  });

  afterEach(async () => {
    await testPrisma.post.deleteMany();
  });

  describe('save', () => {
    it('should persist post to database', async () => {
      const post = Post.create(
        new PostTitle('Test Post'),
        new PostContent('# Test Content')
      );

      await repository.save(post);

      const savedPost = await testPrisma.post.findUnique({
        where: { id: post.getId().getValue() }
      });

      expect(savedPost).toBeTruthy();
      expect(savedPost!.title).toBe('Test Post');
    });
  });
});
```

## 5. E2Eテスト戦略 (5-10%)

### 5.1 Critical User Flows
```typescript
// tests/e2e/user-flows/blog-reading.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Blog Reading Flow', () => {
  test('should navigate from home to post detail', async ({ page }) => {
    await page.goto('/');
    
    // Homepage should show post list
    await expect(page.locator('[data-testid="post-list"]')).toBeVisible();
    
    // Click on first post
    const firstPost = page.locator('[data-testid="post-item"]').first();
    const postTitle = await firstPost.locator('h2').textContent();
    await firstPost.click();
    
    // Should navigate to post detail
    await expect(page.locator('[data-testid="post-detail"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText(postTitle || '');
  });
});

// tests/e2e/admin-flows/post-management.spec.ts
test.describe('Admin Post Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login to admin (assuming Cloudflare Access is mocked in test)
    await page.goto('/admin/login');
    await page.fill('[data-testid="email"]', 'admin@test.com');
    await page.click('[data-testid="login-button"]');
  });

  test('should create and publish post', async ({ page }) => {
    await page.goto('/admin/posts/new');
    
    await page.fill('[data-testid="post-title"]', 'E2E Test Post');
    await page.fill('[data-testid="post-content"]', '# E2E Test Content');
    
    await page.click('[data-testid="save-draft"]');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    
    await page.click('[data-testid="publish-button"]');
    await expect(page.locator('[data-testid="published-badge"]')).toBeVisible();
  });
});
```

## 6. テスト設定とヘルパー

### 6.1 Bun Test設定
```typescript
// bunfig.toml
[test]
root = "./tests"
preload = ["./tests/setup.ts"]

# Coverage settings
[test.coverage]
dir = "./coverage"
reporter = ["text", "json", "html"]
threshold = 90.0
```

### 6.2 テストヘルパー
```typescript
// tests/helpers/testDatabase.ts
import { PrismaClient } from '@prisma/client';

export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL,
    },
  },
});

export async function resetDatabase() {
  await testPrisma.image.deleteMany();
  await testPrisma.post.deleteMany();
}

export async function seedTestData() {
  await testPrisma.post.create({
    data: {
      id: 'test-post-1',
      title: 'Test Post 1',
      slug: 'test-post-1',
      content: '# Test Content 1',
      published: true,
      publishedAt: new Date(),
    },
  });
}
```

## 7. CI/CDパイプライン統合

### 7.1 GitHub Actions設定
```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test --coverage --fail-on-low-coverage 90

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test --filter="integration/**/*"

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bunx playwright install
      - run: bun test --filter="e2e/**/*"
```

## 8. テスト品質指標

### 8.1 DORA指標
- **テスト実行時間**: ユニット < 30秒、統合 < 5分、E2E < 15分
- **テスト成功率**: 95%以上
- **カバレッジ**: 90%以上（fail_on_low_coverage設定）
- **テスト修正時間**: 1時間以内

### 8.2 監視項目
- バグ発見場所の追跡
- テスト失敗解決時間
- テスト作成者の分散度
- パイプライン包括的テストカバレッジ

---

**Last Updated**: 2025-07-02
**Version**: 2.0  
**Status**: DORA Testing Strategy Complete  
**対象**: 開発者全員

この戦略により、高品質で保守性の高いテストスイートを構築し、継続的デリバリーを支援します。