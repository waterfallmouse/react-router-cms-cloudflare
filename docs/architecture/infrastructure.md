# インフラ・技術選定詳細

## 1. Cloudflare Workers プラットフォーム選定

### 1.1 選定理由
- **完全無料運用**: 個人ブログレベルでの費用ゼロ
- **Edge Computing**: 世界200+拠点での高速レスポンス  
- **統合エコシステム**: D1, R2, Access等の連携
- **TypeScript Native**: 開発体験の最適化

### 1.2 制約事項と対策
| 制約 | 制限値 | 対策 |
|------|--------|------|
| **CPU時間** | 50ms (Free) | バッチ処理最適化、非同期処理 |
| **メモリ** | 128MB | 軽量実装、メモリ効率化 |
| **リクエストサイズ** | 100MB | ファイルアップロード分割 |
| **実行時間** | 30秒 | タイムアウト処理実装 |

## 2. データベース設計（Cloudflare D1）

### 2.1 D1 選定理由
- **SQLite互換**: Prisma ORMとの親和性
- **無料枠**: 25GB/月（個人ブログに十分）
- **Edge分散**: 複数リージョンでの読み込み最適化

### 2.2 Prisma Schema設計

```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model ContentType {
  id          String   @id @default(cuid())
  name        String   @unique // "blog_post", "page", "product"
  displayName String           // "ブログ記事", "固定ページ"
  description String?
  schema      Json             // コンテンツタイプのスキーマ定義
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  contents    Content[]
}

model Content {
  id          String      @id @default(cuid())
  title       String
  slug        String      @unique
  body        String      // Markdown/HTML
  excerpt     String?     // 自動生成 or 手動入力
  status      ContentStatus @default(draft)
  publishedAt DateTime?   // 公開日時
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  
  // Relations
  contentTypeId String
  contentType   ContentType @relation(fields: [contentTypeId], references: [id])
  media         Media[]
  
  @@index([status, publishedAt])
  @@index([contentTypeId])
}

model Media {
  id        String   @id @default(cuid())
  filename  String
  r2Key     String   @unique // R2オブジェクトキー
  url       String   // 公開URL
  mimeType  String   // MIME type
  size      Int      // バイト数
  alt       String?  // alt text
  contentId String?  // 紐付けコンテンツ（nullable）
  content   Content? @relation(fields: [contentId], references: [id])
  createdAt DateTime @default(now())
  
  @@index([contentId])
}

enum ContentStatus {
  draft
  published
  archived
}
```

### 2.3 マイグレーション戦略
```bash
# 開発時
bun run db:generate  # Prisma client生成
bun run db:migrate   # マイグレーション実行
bun run db:seed      # テストデータ投入

# 本番デプロイ時
wrangler d1 migrations apply cms-db --env production
```

## 3. ファイルストレージ（Cloudflare R2）

### 3.1 R2 選定理由
- **S3互換API**: 既存知識の活用
- **無料枠**: 10GB/月、100万回リクエスト
- **CDN統合**: Cloudflare CDNでの配信最適化

### 3.2 ストレージ構造
```
r2-bucket/
├── images/
│   ├── 2025/01/
│   │   ├── timestamp-random-id.jpg
│   │   └── timestamp-random-id.webp
│   └── thumbnails/
│       └── timestamp-random-id-thumb.jpg
├── documents/
│   └── 2025/01/
│       └── timestamp-random-id.pdf
└── temp/
    └── upload-session-id/
        └── chunk-001.tmp
```

### 3.3 R2 Service実装
```typescript
// src/infrastructure/external/CloudflareR2StorageService.ts
export class CloudflareR2StorageService implements FileStorageService {
  constructor(private r2Bucket: R2Bucket) {}

  async upload(key: string, buffer: ArrayBuffer, contentType: string): Promise<string> {
    await this.r2Bucket.put(key, buffer, {
      httpMetadata: { contentType },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
      },
    });
    
    return `https://cdn.domain.com/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.r2Bucket.delete(key);
  }

  async getUrl(key: string): Promise<string> {
    const object = await this.r2Bucket.get(key);
    if (!object) {
      throw new Error(`File not found: ${key}`);
    }
    return `https://cdn.domain.com/${key}`;
  }
}
```

## 4. 認証・認可（Cloudflare Access）

### 4.1 Access設定
```yaml
# Cloudflare Dashboard設定
applications:
  - name: "CMS Admin"
    domain: "your-domain.workers.dev"
    path: "/admin/*"
    policies:
      - name: "Admin Only"
        action: "allow"
        rules:
          - email: "admin@yourdomain.com"
```

### 4.2 React Router統合
```typescript
// app/routes/admin/$.tsx
export async function loader({ request, context }: LoaderFunctionArgs) {
  // Cloudflare Access JWT検証
  const accessJWT = request.headers.get('cf-access-jwt-assertion');
  
  if (!accessJWT) {
    throw redirect('/admin/login');
  }
  
  try {
    const payload = await verifyCloudflareAccessJWT(accessJWT, context.cloudflare.env);
    return { user: payload };
  } catch (error) {
    throw redirect('/admin/login');
  }
}
```

## 5. CDN・パフォーマンス最適化

### 5.1 キャッシュ戦略
```typescript
// workers/app.ts - キャッシュヘッダー設定
export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    
    // 静的リソースの長期キャッシュ
    if (url.pathname.startsWith('/assets/')) {
      const response = await server.fetch(request, { cloudflare: { env } });
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return response;
    }
    
    // 公開コンテンツの短期キャッシュ
    if (url.pathname.startsWith('/posts/')) {
      const response = await server.fetch(request, { cloudflare: { env } });
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
      return response;
    }
    
    // 管理画面はキャッシュしない
    if (url.pathname.startsWith('/admin/')) {
      const response = await server.fetch(request, { cloudflare: { env } });
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return response;
    }
    
    return server.fetch(request, { cloudflare: { env } });
  }
};
```

### 5.2 画像最適化
```typescript
// Cloudflare Images 連携（将来拡張）
export class OptimizedImageService {
  async getOptimizedUrl(originalUrl: string, options: ImageOptions): Promise<string> {
    const { width, height, format = 'auto', quality = 85 } = options;
    
    // Cloudflare Images変換URL生成
    return `https://imagedelivery.net/${account_id}/${image_id}/${variant}`;
  }
}
```

## 6. 環境管理

### 6.1 wrangler.toml設定
```toml
name = "cms-api"
compatibility_date = "2024-12-01"
node_compat = true

[build]
command = "bun run build"

# Production Environment
[env.production]
vars = { NODE_ENV = "production" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "cms-db"
database_id = "your-production-db-id"

[[env.production.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "cms-media-prod"

# Staging Environment
[env.staging]
vars = { NODE_ENV = "staging" }

[[env.staging.d1_databases]]
binding = "DB"
database_name = "cms-db-staging"
database_id = "your-staging-db-id"

[[env.staging.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "cms-media-staging"

# Development Environment
[env.development]
vars = { NODE_ENV = "development" }

[[env.development.d1_databases]]
binding = "DB"
database_name = "cms-db-dev"
database_id = "your-dev-db-id"

[[env.development.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "cms-media-dev"
```

### 6.2 環境変数管理
```typescript
// src/infrastructure/config/CloudflareEnv.ts
export interface CloudflareEnv {
  NODE_ENV: 'development' | 'staging' | 'production';
  
  // Database
  DB: D1Database;
  DATABASE_URL: string;
  
  // Storage
  R2_BUCKET: R2Bucket;
  
  // Auth
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
  
  // Secrets
  JWT_SECRET?: string;
}
```

## 7. 監視・ログ基盤

### 7.1 Cloudflare Analytics Engine
```typescript
// ログデータをAnalytics Engineに送信
export class AnalyticsLogger {
  constructor(private analyticsEngine: AnalyticsEngineDataset) {}
  
  async logRequest(data: RequestLogData): Promise<void> {
    this.analyticsEngine.writeDataPoint({
      timestamp: data.timestamp,
      method: data.method,
      path: data.path,
      status: data.status,
      duration: data.duration,
      userAgent: data.userAgent,
      country: data.country,
    });
  }
}
```

### 7.2 Real User Monitoring
```javascript
// Cloudflare Web Analytics埋め込み
<script defer src='https://static.cloudflareinsights.com/beacon.min.js'
        data-cf-beacon='{"token": "your-analytics-token"}'></script>
```

## 8. セキュリティ設定

### 8.1 Security Headers
```typescript
// セキュリティヘッダー自動付与
function addSecurityHeaders(response: Response): Response {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  return response;
}
```

### 8.2 CSP設定
```typescript
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
].join('; ');

response.headers.set('Content-Security-Policy', cspDirectives);
```

## 9. バックアップ・災害復旧

### 9.1 D1データバックアップ
```bash
# 自動バックアップスクリプト
#!/bin/bash
DATE=$(date +%Y%m%d)
wrangler d1 execute cms-db --command=".backup backup-${DATE}.db" --env=production
```

### 9.2 R2データ同期
```typescript
// R2間での同期スクリプト
export class R2BackupService {
  async syncToBackupBucket(): Promise<void> {
    const objects = await this.primaryBucket.list();
    
    for (const object of objects.objects) {
      const data = await this.primaryBucket.get(object.key);
      if (data) {
        await this.backupBucket.put(object.key, data.body);
      }
    }
  }
}
```

## 10. コスト最適化

### 10.1 無料枠監視
| サービス | 無料枠 | 監視アラート |
|----------|--------|-------------|
| **Workers** | 100,000 req/day | 80,000 req/day |
| **D1** | 25GB storage | 20GB |
| **R2** | 10GB storage | 8GB |
| **Analytics** | 無制限 | - |

### 10.2 使用量最適化
```typescript
// リクエスト削減技術
export class RequestOptimizer {
  // バッチ処理でDB アクセス削減
  async batchContentQueries(ids: string[]): Promise<Content[]> {
    return this.contentRepository.findByIds(ids); // 1回のクエリ
  }
  
  // キャッシュ活用
  @memoize(300) // 5分間キャッシュ
  async getPopularContent(): Promise<Content[]> {
    return this.contentQueryService.findPopular();
  }
}
```

## 11. 運用・デプロイ

### 11.1 CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
        
      - name: Run tests
        run: bun test
        
      - name: Build
        run: bun run build
        
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: 'production'
```

### 11.2 Health Check
```typescript
// /health エンドポイント
export async function healthCheck(env: CloudflareEnv): Promise<Response> {
  const checks = {
    database: await checkDatabase(env.DB),
    storage: await checkR2(env.R2_BUCKET),
    timestamp: new Date().toISOString(),
  };
  
  const isHealthy = Object.values(checks).every(check => 
    typeof check === 'boolean' ? check : true
  );
  
  return Response.json(checks, { 
    status: isHealthy ? 200 : 503 
  });
}
```

## 12. 関連ドキュメント

- [overview.md](overview.md) - システム全体概要
- [domain-design.md](domain-design.md) - ドメインモデル設計
- [application-layer.md](application-layer.md) - アプリケーション層設計
- [../implementation/development-guide.md](../implementation/development-guide.md) - 開発実装ガイド

---

**作成日**: 2025-06-29  
**バージョン**: 1.0  
**ステータス**: 設計完了  
**対象環境**: Cloudflare Workers + D1 + R2