# 開発実装ガイド

## 1. 環境構築

### 1.1 必要なツール
```bash
# 必須ツール
- Bun >= 1.0.0
- Node.js >= 18.0.0 (Bunの内部で使用)
- Git
- VS Code (推奨)

# Cloudflare ツール
- Wrangler CLI
- Cloudflare アカウント（無料）
```

### 1.2 初期セットアップ
```bash
# リポジトリクローン
git clone <repository-url>
cd react-router-cms-cloudflare

# 依存関係インストール
bun install

# Cloudflare CLI インストール
bun add -g wrangler

# Cloudflare認証
wrangler auth login

# 環境ファイル作成
cp .env.example .env.local
```

### 1.3 開発用データベース設定
```bash
# D1データベース作成
wrangler d1 create cms-db-dev

# DATABASE_URLを.env.localに設定
echo "DATABASE_URL=<your-local-db-path>" >> .env.local

# Prismaクライアント生成
bun run db:generate

# マイグレーション実行
bun run db:migrate

# テストデータ投入
bun run db:seed
```

## 2. 開発コマンド

### 2.1 基本コマンド
```bash
# 開発サーバー起動 (HMR対応)
bun run dev

# プロダクションビルド
bun run build

# プレビュー (ローカルでプロダクション環境テスト)
bun run preview

# 型チェック
bun run typecheck

# Cloudflare Workers にデプロイ
bun run deploy
```

### 2.2 データベースコマンド
```bash
# Prismaクライアント生成
bun run db:generate

# マイグレーション実行
bun run db:migrate

# マイグレーション作成
bun run db:migrate:create

# テストデータ投入
bun run db:seed

# データベースリセット
bun run db:reset
```

### 2.3 テストコマンド
```bash
# 全テスト実行
bun test

# ユニットテストのみ
bun test --filter="unit/**/*"

# 統合テストのみ
bun test --filter="integration/**/*"

# E2Eテストのみ
bun test --filter="e2e/**/*"

# カバレッジ付きテスト実行
bun test --coverage

# ウォッチモード
bun test --watch
```

### 2.4 コード品質コマンド
```bash
# Biome チェック (lint + format)
bun run check

# 自動修正
bun run lint:fix

# フォーマットのみ
bun run format

# 型チェック
bun run typecheck
```

## 3. 開発ワークフロー

### 3.1 ブランチ戦略
```
main              # 本番環境
├── develop       # 開発統合環境
├── feature/*     # 機能開発
├── hotfix/*      # 緊急修正
└── release/*     # リリース準備
```

### 3.2 開発フロー
```bash
# 1. 機能ブランチ作成
git checkout -b feature/add-content-management

# 2. 開発実行
bun run dev

# 3. テスト実行
bun test

# 4. コード品質チェック
bun run check

# 5. コミット
git add .
git commit -m "feat: add content management feature"

# 6. プッシュ
git push origin feature/add-content-management

# 7. プルリクエスト作成
```

### 3.3 実装順序（推奨）
1. **Domain Layer**: Value Objects → Entities → Domain Services
2. **Application Layer**: DTOs → Use Cases → Event Handlers
3. **Infrastructure Layer**: Repositories → External Services
4. **Presentation Layer**: Route Handlers → React Components

## 4. コーディング規約

### 4.1 TypeScript規約
```typescript
// ✅ Good: 明示的な型定義
export interface CreateContentRequest {
  title: string;
  body: string;
  slug?: string;
}

// ❌ Bad: any型の使用
export interface CreateContentRequest {
  title: any;
  body: any;
}

// ✅ Good: 関数型での型定義
export type ContentValidator = (content: Content) => boolean;

// ✅ Good: Generic型の活用
export interface Repository<T, ID> {
  save(entity: T): Promise<void>;
  findById(id: ID): Promise<T | null>;
}
```

### 4.2 ファイル命名規約
```
src/
├── domain/
│   ├── entities/
│   │   └── Content.ts              # PascalCase
│   ├── valueObjects/
│   │   └── ContentTitle.ts         # PascalCase
│   └── services/
│       └── ContentDomainService.ts # PascalCase + Service suffix
├── application/
│   ├── usecases/
│   │   └── CreateContentUseCase.ts # PascalCase + UseCase suffix
│   └── dto/
│       └── CreateContentRequest.ts # PascalCase + Request/Response suffix
├── infrastructure/
│   └── repositories/
│       └── PrismaContentRepository.ts # Technology + Entity + Repository
└── presentation/
    └── routes/
        └── admin.content.new.tsx   # kebab-case for routes
```

### 4.3 インポート規約
```typescript
// ✅ Good: グループ別インポート
// 1. Node.js標準ライブラリ
import { promises as fs } from 'fs';

// 2. 外部ライブラリ
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

// 3. 内部モジュール (domain → application → infrastructure → presentation)
import { Content } from '../../domain/entities/Content';
import { CreateContentUseCase } from '../usecases/CreateContentUseCase';
import { PrismaContentRepository } from '../../infrastructure/repositories/PrismaContentRepository';

// 4. 相対インポート
import './styles.css';
```

### 4.4 エラーハンドリング規約
```typescript
// ✅ Good: 適切なエラー型定義
export class ContentNotFoundError extends Error {
  constructor(id: string) {
    super(`Content with id ${id} not found`);
    this.name = 'ContentNotFoundError';
  }
}

// ✅ Good: Result型パターン (可能な場合)
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// ✅ Good: UseCase でのエラーハンドリング
export class CreateContentUseCase {
  async execute(request: CreateContentRequest): Promise<Result<ContentResponse>> {
    try {
      // ビジネスロジック
      return { success: true, data: response };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      throw error; // 予期しないエラーは再スロー
    }
  }
}
```

## 5. DDD実装パターン

### 5.1 Value Object実装
```typescript
// ✅ Good: Immutable + バリデーション
export class ContentTitle {
  constructor(private readonly value: string) {
    const result = ContentTitleSchema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid ContentTitle: ${result.error.issues[0].message}`);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ContentTitle): boolean {
    return this.value === other.value;
  }

  static fromString(value: string): ContentTitle {
    return new ContentTitle(value);
  }
}
```

### 5.2 Entity実装
```typescript
// ✅ Good: ID管理 + ビジネスロジック
export class Content {
  constructor(
    private readonly id: ContentId,
    private title: ContentTitle,
    private body: ContentBody,
    // ...
  ) {}

  // ビジネスロジック
  publish(): void {
    if (this.isPublished()) {
      throw new Error('Content is already published');
    }
    this.status = 'published';
    this.publishedAt = new Date();
  }

  // Factory method
  static create(title: ContentTitle, body: ContentBody): Content {
    const id = ContentId.generate();
    return new Content(id, title, body, 'draft');
  }
}
```

### 5.3 UseCase実装
```typescript
// ✅ Good: 単一責務 + トランザクション
@Injectable(TOKENS.CreateContentUseCase)
export class CreateContentUseCase {
  constructor(
    @Inject(TOKENS.ContentRepository) 
    private readonly contentRepository: ContentRepositoryInterface,
    @Inject(TOKENS.TransactionManager) 
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(request: CreateContentRequest): Promise<ContentResponse> {
    return await this.transactionManager.executeInTransaction(async () => {
      // 1. バリデーション
      // 2. ドメインロジック実行
      // 3. 永続化
      // 4. レスポンス生成
    });
  }
}
```

## 6. テスト実装ガイド

### 6.1 Value Object テスト
```typescript
// tests/unit/domain/valueObjects/ContentTitle.test.ts
describe('ContentTitle', () => {
  it('should create valid ContentTitle', () => {
    const title = ContentTitle.fromString('Valid Title');
    expect(title.getValue()).toBe('Valid Title');
  });

  it('should throw error for empty title', () => {
    expect(() => ContentTitle.fromString('')).toThrow('ContentTitle cannot be empty');
  });
});
```

### 6.2 UseCase テスト
```typescript
// tests/unit/application/usecases/CreateContentUseCase.test.ts
describe('CreateContentUseCase', () => {
  let mockRepository: jest.Mocked<ContentRepositoryInterface>;
  let useCase: CreateContentUseCase;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
    } as any;
    
    useCase = new CreateContentUseCase(mockRepository, mockTransactionManager);
  });

  it('should create content successfully', async () => {
    mockRepository.save.mockResolvedValue();
    
    const result = await useCase.execute({
      title: 'Test Title',
      body: 'Test Content',
    });
    
    expect(result.title).toBe('Test Title');
    expect(mockRepository.save).toHaveBeenCalledOnce();
  });
});
```

## 7. デバッグ・トラブルシューティング

### 7.1 よくある問題と解決法

#### Prisma関連
```bash
# Problem: Prisma client が見つからない
# Solution: クライアント再生成
bun run db:generate

# Problem: マイグレーションエラー
# Solution: データベースリセット
bun run db:reset
bun run db:migrate
```

#### Cloudflare Workers関連
```bash
# Problem: wrangler コマンドが見つからない
# Solution: グローバルインストール
bun add -g wrangler

# Problem: 認証エラー
# Solution: 再認証
wrangler auth login
```

#### TypeScript関連
```bash
# Problem: 型エラー
# Solution: 型チェック実行
bun run typecheck

# Problem: モジュール解決エラー
# Solution: node_modules削除・再インストール
rm -rf node_modules bun.lockb
bun install
```

### 7.2 デバッグ設定
```typescript
// src/infrastructure/logging/Logger.ts
export class Logger {
  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, data);
    }
  }
}

// 使用例
const logger = new Logger();
logger.debug('UseCase executed', { request, result });
```

### 7.3 VS Code設定
```json
// .vscode/settings.json
{
  "typescript.preferences.strictNullChecks": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": {
    "source.fixAll.biome": true,
    "source.organizeImports.biome": true
  }
}

// .vscode/extensions.json
{
  "recommendations": [
    "biomejs.biome",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma"
  ]
}
```

## 8. パフォーマンス最適化

### 8.1 バンドルサイズ最適化
```bash
# バンドルサイズ分析
bun run build --analyze

# Tree-shaking確認
bun run build --metafile=meta.json
```

### 8.2 ランタイム最適化
```typescript
// ✅ Good: オブジェクト再利用
const logger = LoggerFactory.getInstance();

// ❌ Bad: 毎回新しいインスタンス
const logger = new Logger();

// ✅ Good: メモ化
const memoizedFunction = memoize(expensiveFunction, 300); // 5分キャッシュ

// ✅ Good: バッチ処理
const contents = await repository.findByIds(ids); // 1回のクエリ
```

## 9. セキュリティベストプラクティス

### 9.1 入力バリデーション
```typescript
// ✅ すべての入力でZodバリデーション実行
export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const validatedData = CreateContentRequestSchema.parse(body); // throwする
  // または
  const result = CreateContentRequestSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }
}
```

### 9.2 SQL インジェクション対策
```typescript
// ✅ Good: Prisma ORM使用（自動エスケープ）
const content = await prisma.content.findUnique({
  where: { slug: userProvidedSlug } // 自動的にエスケープされる
});

// ❌ Bad: 生のSQL文字列結合
const query = `SELECT * FROM content WHERE slug = '${userProvidedSlug}'`;
```

### 9.3 認証・認可
```typescript
// ✅ すべての管理APIでアクセス制御
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticateUser(request);
  if (!user) {
    throw redirect('/admin/login');
  }
  
  if (!user.hasPermission('content:read')) {
    throw new Response('Forbidden', { status: 403 });
  }
}
```

## 10. 関連ドキュメント

- [../architecture/overview.md](../architecture/overview.md) - プロジェクト全体概要
- [testing-strategy.md](testing-strategy.md) - テスト戦略詳細
- [dependency-injection.md](dependency-injection.md) - DI実装詳細
- [logging-strategy.md](logging-strategy.md) - ログ実装詳細

---

**作成日**: 2025-06-29  
**バージョン**: 1.0  
**ステータス**: 実装ガイド完成  
**対象**: 開発者全員