# CMS Dependency Injection戦略設計書

## 1. 戦略概要

### 1.1 選択した戦略
**手動DI × Decorator（Use Casesのみ）+ スコープ管理強化**

### 1.2 設計判断の根拠
- **開発体験重視**: 型安全性とIDE支援の充実
- **保守性重視**: 現在のコードとの一貫性、学習コストの低さ
- **段階的導入**: リスク最小化、既存コードへの影響を限定

## 2. アーキテクチャ設計

### 2.1 適用範囲
```
src/
├── domain/               # 現行のまま（DI対象外）
├── application/
│   ├── usecases/        # ✅ Decorator + DI対象
│   ├── dto/             # 現行のまま
│   └── services/        # 現行のまま
├── infrastructure/
│   ├── repositories/    # 現行のまま（手動Container）
│   └── external/        # 現行のまま
└── presentation/        # 現行のまま
```

### 2.2 依存関係の流れ
```
Presentation Layer
    ↓
Enhanced Container (手動 + スコープ管理)
    ↓
Use Cases (@Injectable)
    ↓
Repository Interfaces (Containerから注入)
```

## 3. 技術実装仕様

### 3.1 必要なライブラリ
```bash
# 追加パッケージ（最小限）
bun add reflect-metadata

# TypeScript設定でDecorator有効化
# tsconfig.json で experimentalDecorators: true
```

### 3.2 DIトークン定義
```typescript
// src/application/di/tokens.ts
export const TOKENS = {
  // Use Cases
  CreateContentUseCase: Symbol('CreateContentUseCase'),
  PublishContentUseCase: Symbol('PublishContentUseCase'),
  GetContentDetailUseCase: Symbol('GetContentDetailUseCase'),
  GetPublishedContentListUseCase: Symbol('GetPublishedContentListUseCase'),
  UpdateContentUseCase: Symbol('UpdateContentUseCase'),
  DeleteContentUseCase: Symbol('DeleteContentUseCase'),
  
  // Infrastructure Services (注入対象)
  ContentRepository: Symbol('ContentRepository'),
  ContentTypeRepository: Symbol('ContentTypeRepository'),
  MediaRepository: Symbol('MediaRepository'),
  TransactionManager: Symbol('TransactionManager'),
  DomainEventDispatcher: Symbol('DomainEventDispatcher'),
  FileStorageService: Symbol('FileStorageService'),
  ContentDomainService: Symbol('ContentDomainService'),
  MediaDomainService: Symbol('MediaDomainService'),
} as const;

export type DIToken = typeof TOKENS[keyof typeof TOKENS];
```

### 3.3 Decorator実装
```typescript
// src/application/di/decorators.ts
import 'reflect-metadata';

const INJECTABLE_METADATA_KEY = Symbol('injectable');
const INJECT_METADATA_KEY = Symbol('inject');

export interface InjectableMetadata {
  token: symbol;
}

export interface InjectMetadata {
  index: number;
  token: symbol;
}

// クラスをDI対象として登録
export function Injectable(token: symbol) {
  return function<T extends { new (...args: any[]): {} }>(constructor: T) {
    const metadata: InjectableMetadata = { token };
    Reflect.defineMetadata(INJECTABLE_METADATA_KEY, metadata, constructor);
    return constructor;
  };
}

// コンストラクタパラメータの注入設定
export function Inject(token: symbol) {
  return function(target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    const existingInjects: InjectMetadata[] = 
      Reflect.getMetadata(INJECT_METADATA_KEY, target) || [];
    
    existingInjects.push({ index: parameterIndex, token });
    Reflect.defineMetadata(INJECT_METADATA_KEY, existingInjects, target);
  };
}

// メタデータ取得ヘルパー
export function getInjectableMetadata(constructor: any): InjectableMetadata | undefined {
  return Reflect.getMetadata(INJECTABLE_METADATA_KEY, constructor);
}

export function getInjectMetadata(constructor: any): InjectMetadata[] {
  return Reflect.getMetadata(INJECT_METADATA_KEY, constructor) || [];
}
```

### 3.4 Enhanced Container実装
```typescript
// src/application/di/EnhancedContainer.ts
import type { CloudflareEnv } from '../../infrastructure/config/CloudflareEnv';
import { TOKENS, type DIToken } from './tokens';
import { getInjectableMetadata, getInjectMetadata } from './decorators';

// スコープ定義
export type Scope = 'singleton' | 'transient';

interface Registration {
  factory: () => any;
  scope: Scope;
  instance?: any;
}

export class EnhancedContainer {
  private registrations = new Map<symbol, Registration>();
  private decoratedClasses = new Map<symbol, any>();

  constructor(private cloudflareEnv: CloudflareEnv) {
    this.registerInfrastructure();
    this.registerDecoratedClasses();
  }

  // Infrastructure層の手動登録（現行のContainer方式）
  private registerInfrastructure(): void {
    // Singleton: Repository, Service, Manager
    this.register(TOKENS.ContentRepository, 
      () => new PrismaContentRepository(this.getPrismaClient()), 
      'singleton'
    );
    
    this.register(TOKENS.ContentTypeRepository, 
      () => new PrismaContentTypeRepository(this.getPrismaClient()), 
      'singleton'
    );
    
    this.register(TOKENS.TransactionManager, 
      () => new PrismaTransactionManager(this.getPrismaClient()), 
      'singleton'
    );
    
    this.register(TOKENS.DomainEventDispatcher, 
      () => new InMemoryDomainEventDispatcher(), 
      'singleton'
    );
    
    this.register(TOKENS.ContentDomainService, 
      () => new ContentDomainService(this.resolve(TOKENS.ContentRepository)), 
      'singleton'
    );
    
    // 他のサービスも同様に登録...
  }

  // Decoratorが付いたクラスの自動検出・登録
  private registerDecoratedClasses(): void {
    // 実際の実装では、ビルド時またはランタイムでクラスを検出
    // ここでは手動登録の例を示す
    
    this.registerDecorated(CreateContentUseCase);
    this.registerDecorated(PublishContentUseCase);
    this.registerDecorated(GetContentDetailUseCase);
    this.registerDecorated(GetPublishedContentListUseCase);
    // 他のUse Casesも同様...
  }

  private registerDecorated(constructor: any): void {
    const metadata = getInjectableMetadata(constructor);
    if (!metadata) return;

    this.decoratedClasses.set(metadata.token, constructor);
    
    // Use Casesは基本的にTransient（リクエスト毎に新しいインスタンス）
    this.register(metadata.token, () => {
      const injectMetadata = getInjectMetadata(constructor);
      const args: any[] = [];
      
      // コンストラクタ引数の解決
      injectMetadata
        .sort((a, b) => a.index - b.index)
        .forEach(inject => {
          args[inject.index] = this.resolve(inject.token);
        });
      
      return new constructor(...args);
    }, 'transient');
  }

  // 登録メソッド
  private register(token: symbol, factory: () => any, scope: Scope): void {
    this.registrations.set(token, { factory, scope });
  }

  // 解決メソッド
  resolve<T>(token: symbol): T {
    const registration = this.registrations.get(token);
    if (!registration) {
      throw new Error(`No registration found for token: ${token.toString()}`);
    }

    // Singletonの場合、既存インスタンスがあれば返却
    if (registration.scope === 'singleton' && registration.instance) {
      return registration.instance;
    }

    // インスタンス作成
    const instance = registration.factory();

    // Singletonの場合、インスタンスを保存
    if (registration.scope === 'singleton') {
      registration.instance = instance;
    }

    return instance;
  }

  // Use Case用の便利メソッド
  getCreateContentUseCase(): CreateContentUseCase {
    return this.resolve<CreateContentUseCase>(TOKENS.CreateContentUseCase);
  }

  getPublishContentUseCase(): PublishContentUseCase {
    return this.resolve<PublishContentUseCase>(TOKENS.PublishContentUseCase);
  }

  // 他のUse Cases用メソッドも同様...

  // 既存のprivateメソッドはそのまま維持
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

### 3.5 Use Cases実装例
```typescript
// src/application/usecases/CreateContentUseCase.ts
import { Injectable, Inject } from '../di/decorators';
import { TOKENS } from '../di/tokens';

@Injectable(TOKENS.CreateContentUseCase)
export class CreateContentUseCase {
  constructor(
    @Inject(TOKENS.ContentRepository) 
    private readonly contentRepository: ContentRepositoryInterface,
    
    @Inject(TOKENS.ContentTypeRepository) 
    private readonly contentTypeRepository: ContentTypeRepositoryInterface,
    
    @Inject(TOKENS.ContentDomainService) 
    private readonly contentDomainService: ContentDomainService,
    
    @Inject(TOKENS.TransactionManager) 
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(request: CreateContentRequest): Promise<ContentResponse> {
    return await this.transactionManager.executeInTransaction(async () => {
      // 既存の実装はそのまま
      // ...
    });
  }
}
```

## 4. スコープ管理戦略

### 4.1 スコープ定義
| サービス種別 | スコープ | 理由 |
|-------------|----------|------|
| **Repository** | Singleton | DB接続プールの効率性、状態を持たない |
| **DomainService** | Singleton | 状態を持たない、パフォーマンス向上 |
| **TransactionManager** | Singleton | DB接続管理の一元化 |
| **EventDispatcher** | Singleton | イベント処理の一貫性 |
| **Use Cases** | Transient | リクエスト毎の独立性、メモリ効率 |

### 4.2 ライフサイクル管理
```typescript
// リクエスト毎にContainerインスタンス作成
// app/routes/admin/api/content/route.ts
export async function action({ request, context }: ActionFunctionArgs) {
  const container = new EnhancedContainer(context.cloudflare);
  const useCase = container.getCreateContentUseCase(); // 新しいインスタンス
  
  try {
    const body = await request.json();
    const result = await useCase.execute(body);
    return Response.json(result, { status: 201 });
  } catch (error) {
    // エラーハンドリング
  }
}
```

## 5. テスト戦略

### 5.1 現行テスト手法の維持
```typescript
// tests/unit/application/usecases/CreateContentUseCase.test.ts
describe('CreateContentUseCase', () => {
  let mockContentRepository: jest.Mocked<ContentRepositoryInterface>;
  let mockTransactionManager: jest.Mocked<TransactionManager>;
  let useCase: CreateContentUseCase;

  beforeEach(() => {
    // 現行通りの手動モック作成
    mockContentRepository = createMockContentRepository();
    mockTransactionManager = createMockTransactionManager();
    
    // 手動インスタンス作成（DIを通さない）
    useCase = new CreateContentUseCase(
      mockContentRepository,
      mockContentTypeRepository,
      mockContentDomainService,
      mockTransactionManager,
    );
  });

  // テストコードは現行のまま
});
```

### 5.2 将来のテスト拡張オプション
```typescript
// 将来的にテスト専用コンテナが必要になった場合
class TestContainer extends EnhancedContainer {
  constructor() {
    super(mockCloudflareEnv);
  }

  protected registerInfrastructure(): void {
    // テスト用モック登録
    this.register(TOKENS.ContentRepository, () => createMockContentRepository(), 'singleton');
    // ...
  }
}
```

## 6. 移行計画

### 6.1 Phase 1: 基盤実装（Week 1-2）
- [ ] DIトークン定義作成
- [ ] Decorator実装
- [ ] EnhancedContainer基本実装
- [ ] TypeScript設定更新

### 6.2 Phase 2: Use Cases移行（Week 3-4）
- [ ] CreateContentUseCase移行
- [ ] PublishContentUseCase移行
- [ ] GetContentDetailUseCase移行
- [ ] GetPublishedContentListUseCase移行
- [ ] テストの動作確認

### 6.3 Phase 3: 統合・最適化（Week 5）
- [ ] Presentation層での使用確認
- [ ] パフォーマンステスト
- [ ] 型安全性の最終確認
- [ ] ドキュメント更新

## 7. パフォーマンス影響

### 7.1 バンドルサイズ影響
- **reflect-metadata**: ~3KB
- **Decorator実装**: ~1KB
- **合計追加**: ~4KB（軽微）

### 7.2 実行時パフォーマンス
- **Singleton効果**: Repository等の初期化コスト削減
- **Transient Use Cases**: メモリ効率向上
- **Reflection使用**: 初期化時のみ、実行時は高速

### 7.3 Cloudflare Workers適合性
- Edge Runtime制約: 問題なし
- Cold Start時間: 影響軽微（~1-2ms）
- メモリ使用量: Singleton効果で改善

## 8. 利点・リスク分析

### 8.1 利点
| 項目 | 詳細 |
|------|------|
| **型安全性** | 完全なTypeScript統合、コンパイル時チェック |
| **IDE支援** | 完全な補完・ナビゲーション・リファクタリング |
| **可読性** | Decoratorによる依存関係の明示化 |
| **保守性** | 既存コードとの一貫性、段階的導入 |
| **パフォーマンス** | Singletonによるメモリ効率向上 |

### 8.2 リスク・対策
| リスク | 対策 |
|-------|------|
| **学習コスト** | 段階的導入、ドキュメント整備 |
| **デバッグ複雑性** | 明確なトークン命名、エラーメッセージ改善 |
| **Reflection依存** | 最小限使用、型安全性でカバー |

## 9. 代替案との比較

| 項目 | 手動DI×Decorator | TSyringe | Inversify |
|------|------------------|----------|-----------|
| **型安全性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **IDE支援** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **学習コスト** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **バンドルサイズ** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Cloudflare適合** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

## 10. 結論

**手動DI × Decorator（Use Casesのみ）+ スコープ管理強化**戦略は、プロジェクトの要件（開発体験重視、保守性重視、パフォーマンス重視）に最適な選択です。

### 10.1 採択理由
1. **開発体験**: 完全な型安全性とIDE支援
2. **保守性**: 既存コードとの一貫性、学習コスト最小
3. **リスク管理**: 段階的導入、影響範囲限定
4. **パフォーマンス**: 軽量、Cloudflare Workers最適化

### 10.2 成功指標
- [ ] 型安全性エラーの削減
- [ ] Use Case作成時間の短縮
- [ ] テストの保守性向上
- [ ] バンドルサイズ4KB以下の追加
- [ ] チーム内でのスムーズな学習・適用

---

**作成日**: 2025-06-29  
**バージョン**: 1.0  
**ステータス**: 設計完了・実装準備中  
**適用範囲**: Application Layer (Use Cases)  
**次のステップ**: Phase 1実装開始