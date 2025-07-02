# CMS アーキテクチャ概要

## 1. プロジェクト概要

### 目的
Domain-Driven Design (DDD) 原則に基づいたモダンCMS（Content Management System）の構築。最初のユースケースは個人ブログサービス（月10投稿以下の小規模運用）だが、将来的に多様なコンテンツタイプに対応可能な拡張性を持つ設計。

### 技術スタック
- **言語**: TypeScript
- **アーキテクチャ**: Domain-Driven Design (DDD)
- **フレームワーク**: React Router v7
- **インフラ**: Cloudflare（完全無料構成）
- **ORM**: Prisma
- **バリデーション**: Zod
- **CSSフレームワーク**: Tailwind CSS v4
- **ビルドツール**: Vite（標準構成）
- **テスト**: Bun Test + Playwright (DORA準拠)

### コスト試算
**完全無料での運用が可能**
- Cloudflare Workers: 無料（100,000リクエスト/日）
- Cloudflare D1: 無料（25GB/月）
- Cloudflare R2: 無料（10GB/月）
- Cloudflare Access: 無料（50ユーザー）
- ドメイン: [name].workers.dev（無料）

## 2. システムアーキテクチャ

### 2.1 DDD レイヤードアーキテクチャ
```
┌─────────────────────────────────────┐
│         Presentation Layer          │
│  React Router v7 + Route Handlers  │
│         (REST API + Pages)          │
└─────────────────────────────────────┘
                   │
┌─────────────────────────────────────┐
│         Application Layer           │
│   Use Cases (CQRS) + DTOs +        │
│   Transaction Management            │
└─────────────────────────────────────┘
                   │
┌─────────────────────────────────────┐
│           Domain Layer              │
│  Entities + Value Objects +         │
│  Domain Services + Repositories     │
└─────────────────────────────────────┘
                   │
┌─────────────────────────────────────┐
│        Infrastructure Layer        │
│  Prisma Repositories + R2 +        │
│  External Services + DI Container  │
└─────────────────────────────────────┘
```

### 2.2 技術アーキテクチャ
```
Frontend (React Router v7)
├── SSR対応
├── Cloudflare Workers（Edge Runtime）
└── TailwindCSS v4

Backend (DDD Clean Architecture)
├── Domain: Entities + Value Objects + Domain Services
├── Application: Use Cases + DTOs + Event Handlers
├── Infrastructure: Prisma + R2 + External APIs
└── Presentation: Route Handlers + Controllers

Data & Storage
├── Cloudflare D1（SQLite with Prisma）
├── Cloudflare R2（画像ストレージ）
└── Zod Validation（全レイヤー）

認証・セキュリティ
└── Cloudflare Access（/admin/*保護）
```

### 2.3 プロジェクト構造
```
src/
├── domain/
│   └── cms/
│       ├── entities/          # Content, ContentType, Media entities
│       ├── valueObjects/      # ContentId, ContentTitle, ContentSlug, etc.
│       ├── services/          # ContentDomainService, MediaDomainService
│       ├── repositories/      # Interface definitions
│       └── schemas/           # Zod validation schemas
├── application/
│   ├── usecases/             # CreateContent, PublishContent, etc.
│   ├── dto/                  # Request/Response DTOs
│   └── services/             # Transaction, Event handling
├── infrastructure/
│   ├── repositories/         # Prisma implementations
│   ├── external/            # R2, external APIs
│   └── di/                  # Dependency injection
└── presentation/
    ├── routes/              # React Router route handlers
    └── components/          # React components

tests/
├── unit/                    # Domain & Application layer tests
├── integration/            # Repository & API tests
└── e2e/                   # End-to-end user flows
```

## 3. 機能要件

### MVP（最小構成 - ブログCMS）
- ✅ コンテンツ作成・編集・削除（記事タイプ）
- ✅ マークダウン対応（シンプルなテキストエリア）
- ✅ メディア管理（画像アップロード・管理、R2連携）
- ✅ レスポンシブデザイン
- ✅ 管理者認証（Cloudflare Access）
- ✅ 公開・下書き状態管理

### 将来拡張予定（汎用CMS機能）
- **コンテンツタイプ拡張**: ページ、プロダクト、ニュース等
- **分類管理**: タグ・カテゴリ・タクソノミー機能
- **ユーザー管理**: 複数ユーザー・ロール・権限管理
- **コメント・レビューシステム**
- **多言語対応**: i18n機能
- **ワークフロー**: 承認フロー・レビュー機能
- **API公開**: Headless CMS機能
- **テンプレート管理**: 複数テーマ・レイアウト
- **SEO最適化機能**

## 4. ルーティング設計

### 公開ページ (React Router v7)
```
/ - トップページ（コンテンツ一覧）
/posts/[slug] - ブログ記事詳細
/pages/[slug] - 固定ページ詳細
/[contentType]/[slug] - 汎用コンテンツ詳細

// Public API Routes
/api/content - 公開コンテンツ一覧API
/api/content/[slug] - コンテンツ詳細API
/api/content/type/[type] - タイプ別コンテンツAPI
/api/media/[id] - メディア配信API
```

### 管理ページ（Cloudflare Access保護）
```
/admin - CMS管理ダッシュボード
/admin/content - コンテンツ一覧
/admin/content/new - コンテンツ作成
/admin/content/[id]/edit - コンテンツ編集
/admin/content-types - コンテンツタイプ管理
/admin/media - メディアライブラリ
/admin/settings - CMS設定

// Admin API Routes  
/admin/api/content - コンテンツCRUD API
/admin/api/content-types - コンテンツタイプ管理API
/admin/api/media - メディア管理API
/admin/api/settings - 設定管理API
```

## 5. セキュリティ・認証

### 認証方式
**Cloudflare Access**による管理画面保護
- 設定パス: `/admin/*`
- 認証方法: メール認証（最小構成）
- 費用: 無料（50ユーザーまで）

### セキュリティ対策
- CSRF保護（React Router標準機能）
- XSS対策（マークダウンサニタイズ）
- 画像アップロード制限（ファイルサイズ・拡張子）

## 6. パフォーマンス最適化

### 画像最適化
- Cloudflare R2 + Cloudflare Images
- WebP/AVIF対応
- レスポンシブ画像

### キャッシュ戦略
- Cloudflare CDN
- Edge Side Includes（ESI）
- 静的リソースキャッシュ

## 7. 開発・運用戦略

### 開発原則
1. **Domain Layer**: Keep pure business logic, no external dependencies
2. **Application Layer**: Orchestrate domain objects, handle transactions
3. **Infrastructure Layer**: Implement repository interfaces, external integrations
4. **Presentation Layer**: Handle HTTP requests, validation, serialization

### 品質保証
- Zod schemas for all validation (domain and application layers)
- Write tests first (TDD approach recommended)
- Follow CQRS pattern for use cases
- Maintain 90%+ test coverage (enforced by fail_on_low_coverage)
- Use dependency injection for loose coupling
- Use Biome for consistent code formatting and linting

## 8. 拡張ロードマップ

### Phase 2: 本格CMS機能（3-6ヶ月後）
- **コンテンツタイプ管理**: 動的なコンテンツタイプ作成・編集
- **分類システム**: タグ・カテゴリ・カスタムタクソノミー
- **ユーザー管理**: 複数ユーザー・ロール・権限システム
- **全文検索**: Elasticsearch/CloudSearch統合
- **ワークフロー**: 承認フロー・コンテンツレビュー機能

### Phase 3: エンタープライズ機能（6-12ヶ月後）
- **多言語対応**: i18n機能・言語別コンテンツ管理
- **Headless CMS**: GraphQL/REST API公開
- **テンプレート管理**: 複数テーマ・レイアウトエンジン
- **バージョン管理**: コンテンツ履歴・差分表示
- **A/Bテスト**: コンテンツパフォーマンス測定

### Phase 4: 高度な機能（12ヶ月以降）
- **AI統合**: 自動タグ付け・コンテンツ推奨
- **リアルタイム編集**: 協調編集機能
- **CDN統合**: グローバル配信最適化
- **アナリティクス**: 詳細なコンテンツ分析
- **プラグインシステム**: サードパーティ拡張対応

## 9. Related Documents

- [domain-design.md](domain-design.md) - ドメインモデル詳細設計
- [application-layer.md](application-layer.md) - アプリケーション層設計
- [infrastructure.md](infrastructure.md) - インフラ・技術選定詳細
- [../implementation/development-guide.md](../implementation/development-guide.md) - 開発実装ガイド

---

**Last Updated**: 2025-07-02
**Version**: 2.0  
**Status**: Design Complete & Implementation Ready  
**初期ユースケース**: 個人ブログサービス  
**将来展望**: 汎用CMSプラットフォーム