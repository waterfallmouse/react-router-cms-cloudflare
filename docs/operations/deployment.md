# デプロイ戦略

## 1. デプロイ環境構成

### 1.1 環境構成
```
production   # 本番環境 - your-domain.workers.dev
├── staging  # ステージング環境 - staging.your-domain.workers.dev  
└── develop  # 開発環境 - dev.your-domain.workers.dev
```

### 1.2 環境別設定
| 環境 | ドメイン | ブランチ | データベース | 目的 |
|------|----------|----------|-------------|------|
| **production** | your-domain.workers.dev | main | cms-db-prod | 本番運用 |
| **staging** | staging.your-domain.workers.dev | develop | cms-db-staging | リリース前検証 |
| **develop** | dev.your-domain.workers.dev | feature/* | cms-db-dev | 開発・テスト |

## 2. 自動デプロイ（CI/CD）

### 2.1 GitHub Actions設定
```yaml
# .github/workflows/deploy.yml
name: Deploy CMS

on:
  push:
    branches: 
      - main        # Production
      - develop     # Staging
  pull_request:
    branches: 
      - main        # PR validation

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
      
      - name: Type check
        run: bun run typecheck
      
      - name: Lint
        run: bun run check
      
      - name: Unit tests
        run: bun test --filter="unit/**/*" --coverage
      
      - name: Integration tests
        run: bun test --filter="integration/**/*"

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging
    
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
      
      - name: Build
        run: bun run build
      
      - name: Deploy to Staging
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: 'staging'
          wranglerVersion: '3.0.0'
      
      - name: Run E2E tests against staging
        run: bun test --filter="e2e/**/*"
        env:
          E2E_BASE_URL: https://staging.your-domain.workers.dev

  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
      
      - name: Build
        run: bun run build
      
      - name: Deploy to Production
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: 'production'
          wranglerVersion: '3.0.0'
      
      - name: Health check
        run: |
          sleep 30
          curl -f https://your-domain.workers.dev/health || exit 1
```

### 2.2 デプロイ承認フロー
```yaml
# production環境のみ手動承認が必要
environments:
  production:
    protection_rules:
      - type: required_reviewers
        required_reviewers:
          - admin-user
      - type: wait_timer
        wait_timer: 5 # 5分待機
```

## 3. マニュアルデプロイ

### 3.1 基本デプロイコマンド
```bash
# ステージング環境
bun run deploy:staging

# 本番環境
bun run deploy:production

# 特定の環境指定
wrangler deploy --env production
```

### 3.2 デプロイ前チェックリスト
```bash
# 1. テスト実行
bun test

# 2. 型チェック
bun run typecheck

# 3. ビルド確認
bun run build

# 4. 設定確認
wrangler whoami
wrangler kv:namespace list

# 5. マイグレーション確認 (必要に応じて)
wrangler d1 migrations list cms-db --env production
```

### 3.3 ロールバック手順
```bash
# デプロイ履歴確認
wrangler deployments list

# 特定バージョンにロールバック
wrangler rollback [DEPLOYMENT_ID]

# 緊急時の強制ロールバック
wrangler rollback --force [DEPLOYMENT_ID]
```

## 4. データベースマイグレーション

### 4.1 マイグレーション戦略
```
Development → Staging → Production
      ↓           ↓          ↓
   Auto apply  Manual test  Manual apply
```

### 4.2 マイグレーション実行
```bash
# 開発環境（自動）
bun run db:migrate

# ステージング環境（手動確認）
wrangler d1 migrations list cms-db-staging --env staging
wrangler d1 migrations apply cms-db-staging --env staging

# 本番環境（手動実行）
wrangler d1 migrations list cms-db --env production
wrangler d1 migrations apply cms-db --env production --dry-run  # 事前確認
wrangler d1 migrations apply cms-db --env production
```

### 4.3 マイグレーション失敗時対策
```bash
# 1. マイグレーション状態確認
wrangler d1 info cms-db --env production

# 2. バックアップ作成（事前に）
wrangler d1 execute cms-db --command=".backup backup-$(date +%Y%m%d).db" --env production

# 3. 手動修正（必要に応じて）
wrangler d1 execute cms-db --command="-- 修正SQL" --env production

# 4. 最後の手段: データベースリストア
# Cloudflare Dashboard からバックアップリストア
```

## 5. 環境変数・シークレット管理

### 5.1 Cloudflare環境変数設定
```bash
# 環境変数設定
wrangler secret put JWT_SECRET --env production
wrangler secret put DATABASE_URL --env production

# 環境変数一覧確認
wrangler secret list --env production

# 環境変数削除
wrangler secret delete OLD_SECRET --env production
```

### 5.2 wrangler.toml設定
```toml
# wrangler.toml
name = "cms-api"
compatibility_date = "2024-12-01"

[env.production]
name = "cms-api-prod"
vars = { 
  NODE_ENV = "production",
  SITE_URL = "https://your-domain.workers.dev"
}

[[env.production.d1_databases]]
binding = "DB"
database_name = "cms-db"
database_id = "your-production-db-id"

[[env.production.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "cms-media"

[env.staging]
name = "cms-api-staging"
vars = { 
  NODE_ENV = "staging",
  SITE_URL = "https://staging.your-domain.workers.dev"
}

[[env.staging.d1_databases]]
binding = "DB"
database_name = "cms-db-staging"
database_id = "your-staging-db-id"

[[env.staging.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "cms-media-staging"
```

## 6. カスタムドメイン設定

### 6.1 ドメイン設定手順
```bash
# 1. Cloudflare にドメイン登録
# Dashboard > Add site > yourdomain.com

# 2. Workers Custom Domain設定
wrangler custom-domains add yourdomain.com --env production

# 3. DNS設定
# A record: yourdomain.com → Workers IP
# CNAME: www.yourdomain.com → yourdomain.com
```

### 6.2 SSL証明書
```bash
# 自動SSL証明書（Cloudflare管理）
# Dashboard > SSL/TLS > Origin Server > Create Certificate

# Let's Encrypt（必要に応じて）
wrangler ssl upload yourdomain.com --cert cert.pem --key key.pem
```

## 7. 監視・ヘルスチェック

### 7.1 ヘルスチェックエンドポイント
```typescript
// app/routes/health.tsx
export async function loader({ context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  
  const checks = {
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    database: await checkDatabase(env.DB),
    storage: await checkR2(env.R2_BUCKET),
    version: process.env.npm_package_version,
  };
  
  const isHealthy = checks.database && checks.storage;
  
  return Response.json(checks, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

async function checkDatabase(db: D1Database): Promise<boolean> {
  try {
    await db.prepare('SELECT 1').first();
    return true;
  } catch {
    return false;
  }
}

async function checkR2(bucket: R2Bucket): Promise<boolean> {
  try {
    await bucket.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}
```

### 7.2 外部監視設定
```bash
# UptimeRobot設定例
Monitor Type: HTTP(s)
URL: https://your-domain.workers.dev/health
Interval: 5 minutes
Alert Contacts: admin@yourdomain.com

# Pingdom設定例
Check Type: HTTP
URL: https://your-domain.workers.dev/health
Check Interval: 1 minute
```

## 8. パフォーマンス最適化

### 8.1 Cold Start最適化
```typescript
// workers/app.ts
// グローバル変数での初期化（Cold Start時のみ）
const prisma = new PrismaClient();
const container = new Container();

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    // warm実行時は既存インスタンス使用
    const appLoadContext = {
      cloudflare: { env },
      services: container,
    };
    
    return server.fetch(request, appLoadContext);
  }
};
```

### 8.2 バンドルサイズ最適化
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['@prisma/client'], // Worker外で初期化
      output: {
        manualChunks: {
          domain: ['src/domain'],
          application: ['src/application'],
        },
      },
    },
  },
});
```

## 9. 災害復旧・バックアップ

### 9.1 自動バックアップ
```bash
# 日次バックアップスクリプト
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_NAME="cms-backup-${DATE}"

# D1データベースバックアップ
wrangler d1 execute cms-db --command=".backup ${BACKUP_NAME}.db" --env production

# R2バックアップ（rclone使用）
rclone sync cloudflare:cms-media cloudflare:cms-media-backup
```

### 9.2 復旧手順
```bash
# データベース復旧
# 1. バックアップファイル確認
wrangler d1 execute cms-db --command=".backup list" --env production

# 2. 新しいD1データベース作成
wrangler d1 create cms-db-restored

# 3. バックアップ復元
wrangler d1 execute cms-db-restored --file backup-20241215.db

# 4. アプリケーション設定更新
# wrangler.toml のdatabase_id更新

# R2復旧
rclone sync cloudflare:cms-media-backup cloudflare:cms-media
```

## 10. セキュリティ・コンプライアンス

### 10.1 デプロイ時セキュリティチェック
```bash
# 1. 依存関係脆弱性チェック
bun audit

# 2. 設定ファイル機密情報チェック
git secrets --scan

# 3. 環境変数漏洩チェック
grep -r "SECRET\|PASSWORD\|TOKEN" src/ --exclude-dir=node_modules

# 4. HTTPS強制確認
curl -I https://your-domain.workers.dev
```

### 10.2 アクセス制御
```bash
# Cloudflare Access設定
# 1. Admin routes保護 (/admin/*)
# 2. API keys管理
# 3. 2FA有効化

# GitHub Actions Secrets管理
# 1. CLOUDFLARE_API_TOKEN
# 2. 環境別アクセス制御
# 3. 最小権限の原則
```

## 11. トラブルシューティング

### 11.1 デプロイ失敗時対応
```bash
# 問題: Workers deployment failed
# 解決: ログ確認
wrangler tail --env production

# 問題: Database connection failed  
# 解決: D1設定確認
wrangler d1 info cms-db --env production

# 問題: Bundle size too large
# 解決: バンドル分析
bun run build --analyze
```

### 11.2 パフォーマンス問題
```bash
# CPU時間制限超過
# 解決: パフォーマンス監視追加
console.time('operation');
// 処理
console.timeEnd('operation');

# メモリ使用量過多
# 解決: メモリ使用量監視
console.log('Memory usage:', process.memoryUsage());
```

## 12. 関連ドキュメント

- [monitoring.md](monitoring.md) - 監視・メトリクス詳細
- [../architecture/infrastructure.md](../architecture/infrastructure.md) - インフラ設計
- [../implementation/development-guide.md](../implementation/development-guide.md) - 開発ガイド

---

**作成日**: 2025-06-29  
**バージョン**: 1.0  
**ステータス**: デプロイ戦略完成  
**対象**: DevOps・運用チーム