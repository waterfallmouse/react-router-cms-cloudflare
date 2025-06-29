# CMS ログ戦略設計書

## 1. 概要

### 1.1 設計目的
Domain-Driven Design (DDD) アーキテクチャを採用したCloudflare Workers + React Router v7 CMS環境において、リクエスト横断でのトレース機能と包括的なログ管理を実現する。

### 1.2 設計原則
- **CF-Ray活用**: CloudflareネイティブのトレーシングIDを最大活用
- **DDD準拠**: 各レイヤーの責務に応じたログ設計
- **Workers最適化**: Edge Runtime制約に対応した効率的実装
- **運用重視**: Cloudflare Analyticsとの統合による実用的な監視

### 1.3 対象範囲
| 優先度 | 対象 | 詳細 |
|--------|------|------|
| **1. 管理画面** | `/admin/*` | コンテンツ管理、認証・認可ログ |
| **2. 公開サイト** | `/`, `/posts/*` | アクセスログ、パフォーマンスログ |
| **3. API** | `/api/*` | 業務ログ、エラーログ |

## 2. TraceID生成・伝播アーキテクチャ

### 2.1 CF-Rayベースの戦略

```typescript
// CF-RayヘッダーをプライマリトレースIDとして活用
// 例: CF-Ray: 84c8bf11cae33210-NRT
//     [RequestID][Datacenter]

export class TraceIdManager {
  static extractCloudflareTraceId(request: Request): string {
    const cfRay = request.headers.get('cf-ray');
    return cfRay || this.generateFallbackTraceId();
  }
  
  private static generateFallbackTraceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `local-${timestamp}-${random}`;
  }
}
```

### 2.2 Context伝播メカニズム

```
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare Edge Network                    │
├─────────────────────────────────────────────────────────────┤
│ Request → CF-Ray生成 → React Router v7 → Response           │
│    ↓           ↓              ↓              ↓              │
│ Access Log → Security Log → Business Log → Performance Log   │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                    DDD Layered Logging                      │
│ ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐    │
│ │Presentation │ │ Application  │ │  Infrastructure     │    │
│ │- HTTP logs  │ │- UseCase logs│ │- Repository logs    │    │
│ │- Auth logs  │ │- Business    │ │- External API logs  │    │
│ │- Route logs │ │  event logs  │ │- Database logs      │    │
│ └─────────────┘ └──────────────┘ └─────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│               Cloudflare Analytics + Logs                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 ContextManager実装

```typescript
export class ContextManager {
  private static contexts = new Map<string, LoggingContext>();
  private static currentTraceId: string | null = null;
  
  static createContext(request: Request, cloudflareContext: any): LoggingContext {
    const traceId = TraceIdManager.extractCloudflareTraceId(request);
    this.setCurrentTraceId(traceId);
    
    const context: LoggingContext = {
      traceId,
      cfRay: request.headers.get('cf-ray'),
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('cf-connecting-ip') || 'unknown',
      route: new URL(request.url).pathname,
      method: request.method,
      startTime: Date.now(),
      cloudflare: {
        country: request.headers.get('cf-ipcountry'),
        datacenter: request.headers.get('cf-ray')?.split('-')[1],
        tlsVersion: request.headers.get('cf-tls-version'),
      },
    };
    
    this.contexts.set(traceId, context);
    return context;
  }
}
```

## 3. ログレベル・構造化定義

### 3.1 ログレベル定義

```typescript
export enum LogLevel {
  TRACE = 0,    // 詳細なデバッグ情報（開発時のみ）
  DEBUG = 1,    // デバッグ情報
  INFO = 2,     // 一般的な情報（正常なフロー）
  WARN = 3,     // 警告（回復可能なエラー）
  ERROR = 4,    // エラー（処理失敗、要調査）
  FATAL = 5,    // 致命的エラー（システム停止レベル）
  
  // 業務固有レベル
  BUSINESS = 6, // 業務ログ（コンテンツ作成・公開等）
  SECURITY = 7, // セキュリティログ（認証・認可）
  AUDIT = 8,    // 監査ログ（重要な操作履歴）
}
```

### 3.2 構造化ログフォーマット

```typescript
export interface BaseLogEntry {
  // 必須フィールド
  timestamp: string;        // ISO8601形式
  level: LogLevel;
  message: string;
  traceId: string;          // = CF-Ray値
  
  // サービス情報
  service: string;          // "cms-api"
  version: string;          // アプリバージョン
  environment: string;      // "prod", "dev"
  
  // Cloudflare情報
  cloudflare?: {
    cfRay: string;
    country?: string;       // cf-ipcountry
    datacenter?: string;    // CF-Rayのデータセンター部分
    tlsVersion?: string;    // cf-tls-version
  };
  
  // リクエスト情報
  request?: {
    method: string;
    url: string;
    userAgent?: string;
    ipAddress?: string;
    userId?: string;
    sessionId?: string;
  };
  
  // パフォーマンス情報
  performance?: {
    duration: number;       // ミリ秒
    memoryUsage?: number;   // MB
  };
  
  // エラー情報
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  
  // 業務情報
  business?: {
    entity: string;         // "content", "media", "user"
    action: string;         // "create", "update", "publish"
    entityId?: string;
    additionalData?: Record<string, any>;
  };
  
  // セキュリティ情報
  security?: {
    event: 'auth_attempt' | 'auth_success' | 'auth_failure' | 'access_denied';
    userId?: string;
    resource?: string;
    reason?: string;
  };
  
  // 自由拡張フィールド
  metadata?: Record<string, any>;
}
```

### 3.3 ログレベル使い分けガイド

| レベル | 使用場面 | 例 | 環境 |
|--------|----------|-----|------|
| **TRACE** | 詳細なデバッグ（開発のみ） | 変数の値、関数の入出力 | Dev |
| **DEBUG** | デバッグ情報 | SQL実行、外部API呼び出し | Dev |
| **INFO** | 正常フロー | リクエスト開始/完了、正常な処理 | All |
| **WARN** | 回復可能な問題 | リトライ実行、デフォルト値使用 | All |
| **ERROR** | 処理失敗 | バリデーションエラー、DB接続失敗 | All |
| **BUSINESS** | 業務操作 | コンテンツ作成、公開、削除 | All |
| **SECURITY** | セキュリティ関連 | ログイン試行、認証失敗 | All |
| **AUDIT** | 監査要求 | 重要データの変更履歴 | All |

## 4. DDD各レイヤーでの実装方式

### 4.1 Presentation Layer（React Router v7）

#### HTTP Request/Response ログ

```typescript
// workers/app.ts
export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const startTime = Date.now();
    
    // 1. CF-Rayベースのログコンテキスト作成
    const loggingContext = ContextManager.createContext(request, { env });
    const logger = LoggerFactory.getInstance().createLogger(loggingContext.traceId);
    
    const appLoadContext = {
      cloudflare: { env },
      logging: loggingContext,
    };
    
    try {
      logger.info('Request started', {
        cloudflare: {
          cfRay: loggingContext.cfRay || 'unknown',
          country: loggingContext.cloudflare?.country,
          datacenter: loggingContext.cloudflare?.datacenter,
        },
        request: {
          method: request.method,
          url: new URL(request.url).pathname,
          userAgent: request.headers.get('user-agent') || undefined,
          ipAddress: request.headers.get('cf-connecting-ip') || undefined,
        },
      });
      
      const response = await server.fetch(request, appLoadContext);
      
      // アクセスログ出力
      const duration = Date.now() - startTime;
      logger.access(request, { 
        status: response.status,
        size: parseInt(response.headers.get('content-length') || '0'),
      }, duration);
      
      ContextManager.cleanup(loggingContext.traceId);
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Request failed', error as Error, {
        performance: { duration },
      });
      
      ContextManager.cleanup(loggingContext.traceId);
      throw error;
    }
  }
};
```

#### Server Actions/Loaders

```typescript
// app/routes/admin/content/new.tsx
export async function action({ request, context }: ActionFunctionArgs) {
  const logger = LoggerFactory.getInstance().createLogger(context.logging.traceId);
  
  try {
    logger.info('Content creation action started');
    
    const formData = await request.formData();
    const contentData = {
      title: formData.get('title') as string,
      body: formData.get('body') as string,
    };
    
    // バリデーションログ
    if (!contentData.title || !contentData.body) {
      logger.warn('Validation failed: missing required fields');
      return { error: 'Title and body are required' };
    }
    
    const container = new EnhancedContainer(context.cloudflare);
    const useCase = container.getCreateContentUseCase();
    const result = await useCase.execute(contentData);
    
    // 業務ログ
    logger.business('create', 'content', result.id, { title: contentData.title });
    logger.info('Content creation completed successfully');
    
    return redirect(`/admin/content/${result.id}`);
    
  } catch (error) {
    logger.error('Content creation failed', error as Error);
    return { error: 'Failed to create content' };
  }
}
```

### 4.2 Application Layer（UseCase）

#### UseCase Decorator + Logging

```typescript
// src/application/decorators/LoggingDecorator.ts
export function LoggedUseCase(entityName: string) {
  return function<T extends { new (...args: any[]): any }>(constructor: T) {
    return class extends constructor {
      async execute(...args: any[]): Promise<any> {
        const currentTraceId = ContextManager.getCurrentTraceId() || 'unknown';
        const logger = LoggerFactory.getInstance().createLogger(currentTraceId);
        
        const startTime = Date.now();
        const useCaseName = constructor.name;
        
        try {
          logger.info(`UseCase started: ${useCaseName}`, {
            business: {
              entity: entityName,
              action: 'execute',
              additionalData: { useCaseName },
            },
          });
          
          const result = await super.execute(...args);
          
          const duration = Date.now() - startTime;
          logger.info(`UseCase completed: ${useCaseName}`, {
            performance: { duration },
            business: {
              entity: entityName,
              action: 'complete',
              additionalData: { useCaseName },
            },
          });
          
          return result;
          
        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error(`UseCase failed: ${useCaseName}`, error as Error, {
            performance: { duration },
            business: {
              entity: entityName,
              action: 'error',
              additionalData: { useCaseName },
            },
          });
          throw error;
        }
      }
    };
  };
}

// UseCase実装例
@Injectable(TOKENS.CreateContentUseCase)
@LoggedUseCase('content')  // ← ログ装飾追加
export class CreateContentUseCase {
  // 既存のビジネスロジック実装
}
```

### 4.3 Infrastructure Layer（Repository + External Services）

#### Repository Logging Wrapper

```typescript
// src/infrastructure/repositories/LoggingRepositoryWrapper.ts
export function withLogging<T>(repository: T, entityName: string): T {
  return new Proxy(repository, {
    get(target: any, prop: string) {
      const originalMethod = target[prop];
      
      if (typeof originalMethod === 'function') {
        return async function(...args: any[]) {
          const traceId = ContextManager.getCurrentTraceId() || 'unknown';
          const logger = LoggerFactory.getInstance().createLogger(traceId);
          
          const startTime = Date.now();
          const methodName = prop;
          
          try {
            logger.debug(`Repository method started: ${entityName}.${methodName}`);
            
            const result = await originalMethod.apply(target, args);
            
            const duration = Date.now() - startTime;
            logger.debug(`Repository method completed: ${entityName}.${methodName}`, {
              performance: { duration },
            });
            
            return result;
            
          } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`Repository method failed: ${entityName}.${methodName}`, error as Error, {
              performance: { duration },
            });
            throw error;
          }
        };
      }
      
      return originalMethod;
    }
  });
}
```

#### External Service Logging（R2 Storage例）

```typescript
// src/infrastructure/external/CloudflareR2StorageService.ts
export class CloudflareR2StorageService implements FileStorageService {
  async upload(key: string, buffer: ArrayBuffer, contentType: string): Promise<string> {
    const traceId = ContextManager.getCurrentTraceId() || 'unknown';
    const logger = LoggerFactory.getInstance().createLogger(traceId);
    
    const startTime = Date.now();
    
    try {
      logger.info('R2 upload started', {
        metadata: { key, contentType, size: buffer.byteLength },
      });
      
      await this.r2Bucket.put(key, buffer, {
        httpMetadata: { contentType },
      });
      
      const duration = Date.now() - startTime;
      const url = `https://r2.domain.com/${key}`;
      
      logger.info('R2 upload completed', {
        performance: { duration },
        metadata: { key, url },
      });
      
      return url;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('R2 upload failed', error as Error, {
        performance: { duration },
        metadata: { key },
      });
      throw new FileUploadError(`Failed to upload to R2: ${(error as Error).message}`);
    }
  }
}
```

## 5. Cloudflare環境最適化

### 5.1 Workers Runtime制約への対応

#### メモリ使用量最適化

```typescript
export class OptimizedLogger {
  private static readonly MAX_LOG_BUFFER_SIZE = 50;
  private static readonly LOG_BATCH_TIMEOUT = 5000; // 5秒でバッチ送信
  
  private logBuffer: BaseLogEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  
  private shouldBatch(level: LogLevel): boolean {
    // WARN以下はバッチ、ERROR以上は即座に出力
    return level <= LogLevel.WARN;
  }
  
  private addToBuffer(logEntry: BaseLogEntry): void {
    this.logBuffer.push(logEntry);
    
    // バッファ上限チェック
    if (this.logBuffer.length >= OptimizedLogger.MAX_LOG_BUFFER_SIZE) {
      this.flushBuffer();
    }
    
    // バッチタイマー設定
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBuffer();
      }, OptimizedLogger.LOG_BATCH_TIMEOUT);
    }
  }
  
  private flushBuffer(): void {
    if (this.logBuffer.length === 0) return;
    
    console.log(JSON.stringify({
      type: 'batch_logs',
      count: this.logBuffer.length,
      logs: this.logBuffer,
    }));
    
    this.logBuffer = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}
```

#### CPU時間制限への対応

```typescript
export class PerformanceAwareLogger extends OptimizedLogger {
  private static readonly MAX_EXECUTION_TIME = 50; // 50ms制限
  private operationStartTime: number = 0;
  
  protected log(level: LogLevel, message: string, data?: Partial<BaseLogEntry>): void {
    this.operationStartTime = Date.now();
    
    try {
      // 処理時間チェック
      if (this.isExecutionTimeExceeded()) {
        // 最小限のログ出力
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level,
          message: 'Log processing timeout - simplified entry',
          traceId: this.context.traceId,
        }));
        return;
      }
      
      super.log(level, message, data);
      
    } catch (error) {
      // フォールバック：最小限のログ
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: LogLevel.ERROR,
        message: `Logging error: ${(error as Error).message}`,
        traceId: this.context.traceId,
      }));
    }
  }
  
  private isExecutionTimeExceeded(): boolean {
    return (Date.now() - this.operationStartTime) > PerformanceAwareLogger.MAX_EXECUTION_TIME;
  }
}
```

### 5.2 Cloudflare Analytics統合

```typescript
export class CloudflareAnalyticsLogger extends PerformanceAwareLogger {
  constructor(
    context: LoggerContext,
    private analyticsEngine?: AnalyticsEngineDataset
  ) {
    super(context);
  }
  
  async sendToAnalytics(entry: BaseLogEntry): Promise<void> {
    if (!this.analyticsEngine) return;
    
    try {
      const analyticsData = {
        timestamp: entry.timestamp,
        traceId: entry.traceId,
        level: LogLevel[entry.level],
        service: entry.service,
        environment: entry.environment,
        
        // ディメンション（フィルタリング用）
        method: entry.request?.method,
        route: entry.request?.url,
        status: entry.response?.status,
        country: entry.cloudflare?.country,
        datacenter: entry.cloudflare?.datacenter,
        
        // メトリクス（集計用）
        duration: entry.performance?.duration || 0,
        responseSize: entry.response?.size || 0,
        errorCount: entry.level >= LogLevel.ERROR ? 1 : 0,
        
        // 業務メトリクス
        businessEntity: entry.business?.entity,
        businessAction: entry.business?.action,
      };
      
      this.analyticsEngine.writeDataPoint(analyticsData);
      
    } catch (error) {
      // Analytics送信失敗は処理を止めない
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: LogLevel.WARN,
        message: 'Failed to send to Analytics Engine',
        traceId: this.context.traceId,
      }));
    }
  }
}
```

### 5.3 Environment別設定

```typescript
export const LOGGING_CONFIGS: Record<string, LoggingConfig> = {
  production: {
    minLogLevel: LogLevel.INFO,
    enableBatching: true,
    batchSize: 100,
    batchTimeout: 10000,
    enableAnalytics: true,
    enablePerformanceLogging: true,
    maxMessageLength: 500,
    enableSensitiveDataLogging: false,
  },
  
  development: {
    minLogLevel: LogLevel.TRACE,
    enableBatching: false,
    batchSize: 1,
    batchTimeout: 0,
    enableAnalytics: false,
    enablePerformanceLogging: false,
    maxMessageLength: 10000,
    enableSensitiveDataLogging: true,
  },
};
```

## 6. 実装ガイド

### 6.1 ディレクトリ構造

```
src/
├── infrastructure/
│   ├── logging/
│   │   ├── TraceIdManager.ts          # CF-Ray管理
│   │   ├── ContextManager.ts          # Context管理
│   │   ├── LoggerFactory.ts           # ファクトリー
│   │   ├── Logger.ts                  # 基本Logger
│   │   ├── OptimizedLogger.ts         # 最適化Logger
│   │   ├── PerformanceAwareLogger.ts  # パフォーマンス対応
│   │   ├── CloudflareAnalyticsLogger.ts # Analytics統合
│   │   ├── LogEntry.ts                # ログエントリ定義
│   │   └── LogLevel.ts                # ログレベル定義
│   └── repositories/
│       └── LoggingRepositoryWrapper.ts # Repository Wrapper
├── application/
│   └── decorators/
│       └── LoggingDecorator.ts        # UseCase Decorator
└── presentation/
    └── middleware/
        └── LoggingMiddleware.ts       # HTTP Middleware
```

### 6.2 設定ファイル

```toml
# wrangler.toml
name = "cms-api"
compatibility_date = "2024-12-01"

[env.production]
vars = { NODE_ENV = "production", LOG_LEVEL = "info" }
analytics_engine_datasets = [
  { binding = "ANALYTICS", dataset = "cms_logs" }
]

[env.development]
vars = { NODE_ENV = "development", LOG_LEVEL = "trace" }
```

### 6.3 使用例

#### Basic Logging
```typescript
const logger = LoggerFactory.getInstance().createLogger(traceId);

// 基本ログ
logger.info('Operation started');
logger.error('Operation failed', error);

// 業務ログ
logger.business('create', 'content', contentId);

// セキュリティログ
logger.security('auth_failure', { userId, reason: 'invalid_password' });
```

#### UseCase Logging
```typescript
@Injectable(TOKENS.CreateContentUseCase)
@LoggedUseCase('content')
export class CreateContentUseCase {
  async execute(request: CreateContentRequest): Promise<ContentResponse> {
    // ログは自動出力される
    return await this.transactionManager.executeInTransaction(async () => {
      // ビジネスロジック
    });
  }
}
```

#### Repository Logging
```typescript
// DI Container での登録
this.register(TOKENS.ContentRepository, 
  () => withLogging(
    new PrismaContentRepository(this.getPrismaClient()), 
    'content'
  ), 
  'singleton'
);
```

## 7. 監視・運用

### 7.1 Cloudflare Dashboard活用

**CF-Ray による統合監視:**
- Request Tracing での詳細分析
- Analytics Engine でのログ集計
- Security Events との自動関連付け
- Performance Insights との統合

### 7.2 ログ分析クエリ例

```sql
-- Analytics Engine での集計例
SELECT 
  datacenter,
  COUNT(*) as request_count,
  AVG(duration) as avg_duration,
  SUM(errorCount) as error_count
FROM cms_logs 
WHERE timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY datacenter
ORDER BY request_count DESC;
```

### 7.3 アラート設定

| 条件 | アラート内容 | 対象 |
|------|-------------|------|
| エラー率 > 5% | 即座通知 | ERROR以上 |
| 平均レスポンス時間 > 1000ms | 監視通知 | Performance logs |
| セキュリティイベント発生 | 即座通知 | SECURITY logs |
| 認証失敗 > 10回/分 | 即座通知 | auth_failure events |

## 8. パフォーマンス指標

### 8.1 ログシステム自体の監視

| 指標 | 目標値 | 監視方法 |
|------|--------|----------|
| **ログ出力遅延** | < 10ms | バッチ処理での測定 |
| **メモリ使用量** | < 50MB | Workers メモリ監視 |
| **CPU使用時間** | < 50ms | パフォーマンス測定 |
| **Analytics送信成功率** | > 95% | 送信ログ監視 |

### 8.2 業務指標監視

| 指標 | 目標値 | ダッシュボード |
|------|--------|---------------|
| **コンテンツ作成時間** | < 500ms | UseCase performance logs |
| **画像アップロード時間** | < 2000ms | R2 performance logs |
| **認証成功率** | > 98% | Security logs |
| **エラー率** | < 1% | Error logs |

## 9. セキュリティ考慮事項

### 9.1 機密情報の除去

```typescript
private sanitizeLogData(data?: Partial<BaseLogEntry>): Partial<BaseLogEntry> {
  if (!data) return {};
  
  const sanitized = { ...data };
  
  if (sanitized.metadata) {
    const cleanMetadata = { ...sanitized.metadata };
    Object.keys(cleanMetadata).forEach(key => {
      if (this.isSensitiveField(key)) {
        cleanMetadata[key] = '[REDACTED]';
      }
    });
    sanitized.metadata = cleanMetadata;
  }
  
  return sanitized;
}

private isSensitiveField(fieldName: string): boolean {
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  return sensitiveFields.some(field => 
    fieldName.toLowerCase().includes(field)
  );
}
```

### 9.2 ログアクセス制御

- **本番環境**: Cloudflare Access による管理者限定アクセス
- **ステージング環境**: チーム開発者アクセス
- **開発環境**: 制限なし

## 10. 移行・展開計画

### 10.1 Phase 1: 基盤実装（Week 1-2）
- [ ] TraceIdManager, ContextManager実装
- [ ] 基本Logger, LoggerFactory実装
- [ ] CF-Ray統合テスト

### 10.2 Phase 2: DDD統合（Week 3-4）
- [ ] UseCase Decorator実装
- [ ] Repository Wrapper実装
- [ ] Presentation Layer統合

### 10.3 Phase 3: 最適化・Analytics（Week 5-6）
- [ ] OptimizedLogger, PerformanceAwareLogger実装
- [ ] CloudflareAnalyticsLogger統合
- [ ] バッチ処理最適化

### 10.4 Phase 4: 運用・監視（Week 7-8）
- [ ] ダッシュボード設定
- [ ] アラート設定
- [ ] ドキュメント整備

## 11. 利点・期待効果

### 11.1 開発体験向上
- ✅ **统一されたログ形式**: すべてのレイヤーで一貫したログ
- ✅ **TraceID横断追跡**: エラー発生時の根本原因特定が容易
- ✅ **自動化**: Decorator/Wrapperによる自動ログ出力

### 11.2 運用効率化
- ✅ **Cloudflare統合**: Dashboard直接確認、Request Tracing活用
- ✅ **リアルタイム監視**: Analytics Engineでの即座な集計・分析
- ✅ **アラート連携**: 異常検知の自動化

### 11.3 パフォーマンス向上
- ✅ **Workers最適化**: バッチ処理、CPU時間制限対応
- ✅ **効率的な出力**: 重要度に応じた出力制御
- ✅ **メモリ効率**: バッファ管理によるメモリ使用量削減

---

**作成日**: 2025-06-29  
**バージョン**: 1.0  
**ステータス**: 設計完了・実装準備完了  
**対象環境**: Cloudflare Workers + React Router v7 + DDD Architecture  
**次のステップ**: Phase 1実装開始

## 関連ドキュメント
- `blog-design-document.md` - モダンCMS設計書
- `ddd-domain-design.md` - CMSドメインモデル詳細設計
- `application-service-design.md` - CMSアプリケーションサービス層設計
- `test-strategy-design.md` - DORAテスト戦略
- `di-strategy-design.md` - CMS Dependency Injection戦略設計書
- `CLAUDE.md` - プロジェクト実装ガイド
