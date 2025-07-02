# CMS Logging Strategy Design (Pino Integration)

## 1. Overview

### 1.1 Design Purpose
Domain-Driven Design (DDD) アーキテクチャを採用したCloudflare Workers + React Router v7 CMS環境において、Pinoログライブラリを使用した統一的なログ管理とリクエスト横断でのトレース機能を実現する。

### 1.2 Design Principles
- **Pino標準化**: 高性能な構造化ログライブラリの活用
- **CF-Ray統合**: CloudflareネイティブのトレーシングIDとPinoの連携
- **DDD準拠**: 各レイヤーの責務に応じたログ設計
- **Workers最適化**: Edge Runtime制約に対応したPino Browser設定
- **TypeScript対応**: 型安全なログ実装

### 1.3 Target Scope
| 優先度 | 対象 | 詳細 |
|--------|------|------|
| **1. 管理画面** | `/admin/*` | コンテンツ管理、認証・認可ログ |
| **2. 公開サイト** | `/`, `/posts/*` | アクセスログ、パフォーマンスログ |
| **3. API** | `/api/*` | 業務ログ、エラーログ |

## 2. Pino Setup and TraceID Management

### 2.1 Pino Installation and Basic Configuration

```bash
# 依存ライブラリのインストール
bun add pino
bun add -D @types/pino
```

### 2.2 Pino Configuration for Cloudflare Workers

```typescript
// src/infrastructure/logging/PinoLogger.ts
import pino from 'pino';

// CF-RayベースのトレーシングID管理
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

// Cloudflare Workers用Pino設定
export function createPinoLogger({
  level = 'info',
  analyticsEngine,
  environment = 'production'
}: {
  level?: string;
  analyticsEngine?: AnalyticsEngineDataset;
  environment?: string;
}) {
  return pino({
    level,
    browser: {
      asObject: true,
      write: (logObj: any) => {
        // Console出力
        console.log(JSON.stringify(logObj));
        
        // Analytics Engineに送信 (INFO以上)
        if (analyticsEngine && logObj.level >= 30) {
          analyticsEngine.writeDataPoint({
            timestamp: new Date(logObj.time).toISOString(),
            level: logObj.level,
            levelName: pino.levels.labels[logObj.level],
            message: logObj.msg,
            traceId: logObj.traceId,
            service: logObj.service,
            environment,
            // メタデータをフラット化
            ...flattenObject(logObj),
          });
        }
      }
    },
    base: {
      service: 'cms-api',
      version: process.env.APP_VERSION || '1.0.0',
      environment,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: pino.stdSerializers,
  });
}

// ネストされたオブジェクトをフラット化
function flattenObject(obj: any, prefix = ''): Record<string, any> {
  const flattened: Record<string, any> = {};
  
  for (const key in obj) {
    if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      Object.assign(flattened, flattenObject(obj[key], `${prefix}${key}_`));
    } else {
      flattened[`${prefix}${key}`] = obj[key];
    }
  }
  
  return flattened;
}
```

### 2.3 Context Propagation with Pino Child Logger

```
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare Edge Network                    │
├─────────────────────────────────────────────────────────────┤
│ Request → CF-Ray + Pino Logger → React Router v7 → Response │
│    ↓           ↓                    │                    │
│ Base Logger → Child Logger(traceId) → Structured Logs        │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                 DDD Layered Pino Logging                    │
│ ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐    │
│ │Presentation │ │ Application  │ │  Infrastructure     │    │
│ │- Child Logger│ │- UseCase logs│ │- Repository logs    │    │
│ │- HTTP context│ │- Business    │ │- External API logs  │    │
│ │- Route logs │ │  event logs  │ │- Database logs      │    │
│ └─────────────┘ └──────────────┘ └─────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│          Console + Cloudflare Analytics Engine              │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Pino Context Manager Implementation

```typescript
// src/infrastructure/logging/PinoContextManager.ts
import { Logger } from 'pino';

export interface RequestContext {
  traceId: string;
  cfRay?: string;
  userAgent?: string;
  ipAddress?: string;
  route: string;
  method: string;
  startTime: number;
  cloudflare: {
    country?: string;
    datacenter?: string;
    tlsVersion?: string;
  };
}

export class PinoContextManager {
  private static contexts = new Map<string, Logger>();
  
  static createRequestLogger(
    baseLogger: Logger, 
    request: Request, 
    cloudflareContext?: any
  ): Logger {
    const traceId = TraceIdManager.extractCloudflareTraceId(request);
    const url = new URL(request.url);
    
    const requestContext: RequestContext = {
      traceId,
      cfRay: request.headers.get('cf-ray') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('cf-connecting-ip') || undefined,
      route: url.pathname,
      method: request.method,
      startTime: Date.now(),
      cloudflare: {
        country: request.headers.get('cf-ipcountry') || undefined,
        datacenter: request.headers.get('cf-ray')?.split('-')[1],
        tlsVersion: request.headers.get('cf-tls-version') || undefined,
      },
    };
    
    // Child Loggerを作成してContextを埋め込む
    const requestLogger = baseLogger.child(requestContext);
    this.contexts.set(traceId, requestLogger);
    
    return requestLogger;
  }
  
  static getLogger(traceId: string): Logger | undefined {
    return this.contexts.get(traceId);
  }
  
  static cleanup(traceId: string): void {
    this.contexts.delete(traceId);
  }
  
  static getCurrentLogger(): Logger | undefined {
    // AsyncLocalStorageの代替として、グローバル変数で管理
    return this.contexts.values().next().value;
  }
}
```

## 3. Pino Log Levels and Structured Logging

### 3.1 Utilizing Pino Standard Log Levels

```typescript
// Pino標準レベルを使用
import pino from 'pino';

// Pinoレベル: trace(10), debug(20), info(30), warn(40), error(50), fatal(60)
export const LOG_LEVELS = {
  trace: 10,    // 詳細なデバッグ情報（開発時のみ）
  debug: 20,    // デバッグ情報
  info: 30,     // 一般的な情報（正常なフロー）
  warn: 40,     // 警告（回復可能なエラー）
  error: 50,    // エラー（処理失敗、要調査）
  fatal: 60,    // 致命的エラー（システム停止レベル）
} as const;

// 業務固有メソッドの定義
export interface BusinessLogger {
  business(action: string, entity: string, entityId?: string, data?: any): void;
  security(event: SecurityEvent, data?: any): void;
  audit(action: string, entity: string, data?: any): void;
}

type SecurityEvent = 'auth_attempt' | 'auth_success' | 'auth_failure' | 'access_denied';

// Pino Loggerの拡張
export function createBusinessLogger(baseLogger: pino.Logger): pino.Logger & BusinessLogger {
  const logger = baseLogger as pino.Logger & BusinessLogger;
  
  logger.business = (action: string, entity: string, entityId?: string, data?: any) => {
    logger.info({
      type: 'business',
      business: { action, entity, entityId, ...data }
    }, `Business: ${action} ${entity}`);
  };
  
  logger.security = (event: SecurityEvent, data?: any) => {
    logger.warn({ 
      type: 'security',
      security: { event, ...data }
    }, `Security: ${event}`);
  };
  
  logger.audit = (action: string, entity: string, data?: any) => {
    logger.info({
      type: 'audit',
      audit: { action, entity, ...data }
    }, `Audit: ${action} ${entity}`);
  };
  
  return logger;
}
```

### 3.2 Pino Structured Log Format

```typescript
// Pinoの標準構造を活用したログフォーマット
export interface PinoLogContext {
  // Pino標準フィールド (自動生成)
  // time: number;     // Pinoが自動生成 (Unix timestamp)
  // level: number;    // Pinoが自動生成 (10-60)
  // msg: string;      // メッセージ
  
  // サービス情報 (baseフィールドで設定)
  service: string;          // "cms-api"
  version: string;          // アプリバージョン
  environment: string;      // "production", "development"
  
  // リクエストコンテキスト (child loggerで設定)
  traceId: string;          // CF-Ray値
  cfRay?: string;
  route: string;
  method: string;
  userAgent?: string;
  ipAddress?: string;
  userId?: string;
  sessionId?: string;
  
  // Cloudflare情報
  cloudflare: {
    country?: string;       // cf-ipcountry
    datacenter?: string;    // CF-Rayのデータセンター部分
    tlsVersion?: string;    // cf-tls-version
  };
}

// ログエントリ固有のフィールド
export interface LogEntryFields {
  // パフォーマンス情報
  performance?: {
    duration: number;       // ミリ秒
    memoryUsage?: number;   // MB
  };
  
  // エラー情報 (Pino serializerで自動処理)
  err?: Error;  // Pinoがerrフィールドを自動シリアル化
  
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
  
  // 監査情報
  audit?: {
    action: string;
    entity: string;
    before?: any;
    after?: any;
  };
  
  // メタデータ (任意の追加情報)
  [key: string]: any;
}

// TypeScript型定義の例
type CmsLogger = pino.Logger<PinoLogContext>;
```

### 3.3 Pino Log Level Usage Guide

| Pinoレベル | 使用場面 | 例 | 環境 | メソッド |
|------------|----------|-----|------|----------|
| **trace(10)** | 詳細なデバッグ（開発のみ） | 変数の値、関数の入出力 | Dev | `logger.trace()` |
| **debug(20)** | デバッグ情報 | SQL実行、外部API呼び出し | Dev | `logger.debug()` |
| **info(30)** | 正常フロー | リクエスト開始/完了、正常な処理 | All | `logger.info()` |
| **warn(40)** | 回復可能な問題 | リトライ実行、デフォルト値使用 | All | `logger.warn()` |
| **error(50)** | 処理失敗 | バリデーションエラー、DB接続失敗 | All | `logger.error()` |
| **fatal(60)** | 致命的エラー | システム停止レベル | All | `logger.fatal()` |

#### Business-Specific Methods
| メソッド | 使用場面 | 例 | 内部レベル |
|--------|----------|-----|------------|
| **business()** | 業務操作 | コンテンツ作成、公開、削除 | info(30) |
| **security()** | セキュリティ関連 | ログイン試行、認証失敗 | warn(40) |
| **audit()** | 監査要求 | 重要データの変更履歴 | info(30) |

#### Usage Examples
```typescript
// 基本ログ
logger.info('Request started');
logger.error({ err: error }, 'Operation failed');

// 業務ログ
logger.business('create', 'content', contentId, { title: 'New Post' });

// セキュリティログ
logger.security('auth_failure', { userId, reason: 'invalid_password' });

// 監査ログ
logger.audit('update', 'content', { before: oldData, after: newData });
```

## 4. Pino Implementation in DDD Layers

### 4.1 Presentation Layer（React Router v7）

#### HTTP Request/Response Pinoログ

```typescript
// workers/app.ts
import { createPinoLogger, createBusinessLogger } from '../src/infrastructure/logging/PinoLogger';
import { PinoContextManager } from '../src/infrastructure/logging/PinoContextManager';

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const startTime = Date.now();
    
    // 1. Pino Base Logger作成
    const baseLogger = createPinoLogger({
      level: env.LOG_LEVEL || 'info',
      analyticsEngine: env.ANALYTICS,
      environment: env.NODE_ENV || 'production'
    });
    
    // 2. リクエストコンテキスト付きChild Logger作成
    const requestLogger = PinoContextManager.createRequestLogger(baseLogger, request, { env });
    const logger = createBusinessLogger(requestLogger);
    
    const appLoadContext = {
      cloudflare: { env },
      logger,  // Pino LoggerをContextに追加
    };
    
    try {
      // リクエスト開始ログ
      logger.info('Request started');
      
      const response = await server.fetch(request, appLoadContext);
      
      // アクセスログ出力
      const duration = Date.now() - startTime;
      logger.info({
        type: 'access',
        response: {
          status: response.status,
          size: parseInt(response.headers.get('content-length') || '0'),
        },
        performance: { duration }
      }, `${request.method} ${new URL(request.url).pathname} ${response.status} ${duration}ms`);
      
      PinoContextManager.cleanup(TraceIdManager.extractCloudflareTraceId(request));
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({
        err: error,
        performance: { duration }
      }, `Request failed: ${(error as Error).message}`);
      
      PinoContextManager.cleanup(TraceIdManager.extractCloudflareTraceId(request));
      throw error;
    }
  }
};
```

#### Server Actions/Loaders

```typescript
// app/routes/admin/content/new.tsx
import type { ActionFunctionArgs } from 'react-router';
import type { BusinessLogger } from '../../../src/infrastructure/logging/PinoLogger';

export async function action({ request, context }: ActionFunctionArgs) {
  const logger = context.logger as BusinessLogger;  // ContextからPino Loggerを取得
  
  try {
    logger.info('Content creation action started');
    
    const formData = await request.formData();
    const contentData = {
      title: formData.get('title') as string,
      body: formData.get('body') as string,
    };
    
    // バリデーションログ
    if (!contentData.title || !contentData.body) {
      logger.warn({
        validation: { 
          missing: ['title', 'body'].filter(field => !contentData[field as keyof typeof contentData])
        }
      }, 'Validation failed: missing required fields');
      return { error: 'Title and body are required' };
    }
    
    const container = new EnhancedContainer(context.cloudflare);
    const useCase = container.getCreateContentUseCase();
    const result = await useCase.execute(contentData);
    
    // 業務ログ (Pino拡張メソッド)
    logger.business('create', 'content', result.id, { title: contentData.title });
    logger.info({ contentId: result.id }, 'Content creation completed successfully');
    
    return redirect(`/admin/content/${result.id}`);
    
  } catch (error) {
    logger.error({ err: error }, 'Content creation failed');
    return { error: 'Failed to create content' };
  }
}
```

### 4.2 Application Layer（UseCase）

#### Pino UseCase Decorator + Logging

```typescript
// src/application/decorators/PinoLoggingDecorator.ts
import type { BusinessLogger } from '../../infrastructure/logging/PinoLogger';

export function LoggedUseCase(entityName: string) {
  return function<T extends { new (...args: any[]): any }>(constructor: T) {
    return class extends constructor {
      async execute(...args: any[]): Promise<any> {
        // DIコンテナからLoggerを取得
        const logger = this.logger as BusinessLogger;
        if (!logger) {
          throw new Error('Logger not injected in UseCase');
        }
        
        const startTime = Date.now();
        const useCaseName = constructor.name;
        
        // UseCase専用のChild Logger作成
        const useCaseLogger = logger.child({
          useCase: useCaseName,
          entity: entityName
        });
        
        try {
          useCaseLogger.info(`UseCase started: ${useCaseName}`);
          
          const result = await super.execute(...args);
          
          const duration = Date.now() - startTime;
          useCaseLogger.info({
            performance: { duration },
            result: { id: result?.id }
          }, `UseCase completed: ${useCaseName}`);
          
          // 業務ログも出力
          useCaseLogger.business('execute', entityName, result?.id);
          
          return result;
          
        } catch (error) {
          const duration = Date.now() - startTime;
          useCaseLogger.error({
            err: error,
            performance: { duration }
          }, `UseCase failed: ${useCaseName}`);
          throw error;
        }
      }
    };
  };
}

// UseCase実装例
@Injectable(TOKENS.CreateContentUseCase)
@LoggedUseCase('content')  // ← Pinoログ装飾追加
export class CreateContentUseCase {
  constructor(
    private readonly contentRepository: ContentRepositoryInterface,
    private readonly logger: BusinessLogger  // ← Pino LoggerをDI
  ) {}
  
  // 既存のビジネスロジック実装
}
```

### 4.3 Infrastructure Layer（Repository + External Services）

#### Pino Repository Logging Wrapper

```typescript
// src/infrastructure/repositories/PinoRepositoryWrapper.ts
import type { BusinessLogger } from '../logging/PinoLogger';

export function withPinoLogging<T>(repository: T, entityName: string, logger: BusinessLogger): T {
  // Repository専用のChild Logger作成
  const repoLogger = logger.child({
    layer: 'infrastructure',
    component: 'repository',
    entity: entityName
  });
  
  return new Proxy(repository, {
    get(target: any, prop: string) {
      const originalMethod = target[prop];
      
      if (typeof originalMethod === 'function') {
        return async function(...args: any[]) {
          const startTime = Date.now();
          const methodName = prop;
          
          try {
            repoLogger.debug(`Repository method started: ${entityName}.${methodName}`);
            
            const result = await originalMethod.apply(target, args);
            
            const duration = Date.now() - startTime;
            repoLogger.debug({
              performance: { duration },
              operation: methodName,
              resultCount: Array.isArray(result) ? result.length : result ? 1 : 0
            }, `Repository method completed: ${entityName}.${methodName}`);
            
            return result;
            
          } catch (error) {
            const duration = Date.now() - startTime;
            repoLogger.error({
              err: error,
              performance: { duration },
              operation: methodName
            }, `Repository method failed: ${entityName}.${methodName}`);
            throw error;
          }
        };
      }
      
      return originalMethod;
    }
  });
}

// 使用例: DI Containerでの登録
// this.register(TOKENS.ContentRepository, 
//   (container) => withPinoLogging(
//     new PrismaContentRepository(container.getPrismaClient()), 
//     'content',
//     container.getLogger()
//   ), 
//   'singleton'
// );
```

#### Pino External Service Logging（R2 Storage例）

```typescript
// src/infrastructure/external/CloudflareR2StorageService.ts
import type { BusinessLogger } from '../logging/PinoLogger';

export class CloudflareR2StorageService implements FileStorageService {
  private readonly logger: BusinessLogger;
  
  constructor(
    private readonly r2Bucket: R2Bucket,
    logger: BusinessLogger
  ) {
    // R2サービス専用のChild Logger作成
    this.logger = logger.child({
      layer: 'infrastructure',
      component: 'external-service',
      service: 'cloudflare-r2'
    });
  }
  
  async upload(key: string, buffer: ArrayBuffer, contentType: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      this.logger.info({
        operation: 'upload',
        file: { key, contentType, size: buffer.byteLength }
      }, 'R2 upload started');
      
      await this.r2Bucket.put(key, buffer, {
        httpMetadata: { contentType },
      });
      
      const duration = Date.now() - startTime;
      const url = `https://r2.domain.com/${key}`;
      
      this.logger.info({
        operation: 'upload',
        performance: { duration },
        file: { key, url },
        result: 'success'
      }, 'R2 upload completed');
      
      return url;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        err: error,
        operation: 'upload',
        performance: { duration },
        file: { key }
      }, 'R2 upload failed');
      
      throw new FileUploadError(`Failed to upload to R2: ${(error as Error).message}`);
    }
  }
}
```

## 5. Pino Cloudflare Workers最適化

### 5.1 Workers Runtime制約への対応

#### Pinoメモリ使用量最適化

```typescript
// src/infrastructure/logging/PinoOptimized.ts
import pino from 'pino';

// Cloudflare Workers用の最適化されたPino設定
export function createOptimizedPinoLogger({
  level = 'info',
  analyticsEngine,
  environment = 'production'
}: {
  level?: string;
  analyticsEngine?: AnalyticsEngineDataset;
  environment?: string;
}) {
  const MAX_LOG_BUFFER_SIZE = 50;
  const LOG_BATCH_TIMEOUT = 5000; // 5秒でバッチ送信
  
  let logBuffer: any[] = [];
  let batchTimer: any = null;
  
  function shouldBatch(level: number): boolean {
    // warn(40)以下はバッチ、error(50)以上は即座に出力
    return level <= 40;
  }
  
  function flushBuffer(): void {
    if (logBuffer.length === 0) return;
    
    // バッチログとして出力
    console.log(JSON.stringify({
      type: 'batch_logs',
      count: logBuffer.length,
      logs: logBuffer,
    }));
    
    // Analytics Engineにバッチ送信
    if (analyticsEngine) {
      logBuffer.forEach(logObj => {
        if (logObj.level >= 30) { // info以上
          analyticsEngine.writeDataPoint({
            timestamp: new Date(logObj.time).toISOString(),
            level: logObj.level,
            message: logObj.msg,
            traceId: logObj.traceId,
            service: logObj.service,
            environment,
            ...flattenLogObject(logObj),
          });
        }
      });
    }
    
    logBuffer = [];
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }
  }
  
  return pino({
    level,
    browser: {
      asObject: true,
      write: (logObj: any) => {
        if (shouldBatch(logObj.level)) {
          // バッファに追加
          logBuffer.push(logObj);
          
          if (logBuffer.length >= MAX_LOG_BUFFER_SIZE) {
            flushBuffer();
          } else if (!batchTimer) {
            batchTimer = setTimeout(flushBuffer, LOG_BATCH_TIMEOUT);
          }
        } else {
          // 即座出力 (error, fatal)
          console.log(JSON.stringify(logObj));
          
          if (analyticsEngine && logObj.level >= 30) {
            analyticsEngine.writeDataPoint({
              timestamp: new Date(logObj.time).toISOString(),
              level: logObj.level,
              message: logObj.msg,
              traceId: logObj.traceId,
              service: logObj.service,
              environment,
              ...flattenLogObject(logObj),
            });
          }
        }
      }
    },
    base: {
      service: 'cms-api',
      version: process.env.APP_VERSION || '1.0.0',
      environment,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: pino.stdSerializers,
  });
}

function flattenLogObject(obj: any, prefix = ''): Record<string, any> {
  const flattened: Record<string, any> = {};
  
  for (const key in obj) {
    if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      Object.assign(flattened, flattenLogObject(obj[key], `${prefix}${key}_`));
    } else {
      flattened[`${prefix}${key}`] = obj[key];
    }
  }
  
  return flattened;
}
```

#### Pino CPU時間制限への対応

```typescript
// src/infrastructure/logging/PinoPerformanceAware.ts
import pino from 'pino';

// パフォーマンスを意識したPinoラッパー
export function createPerformanceAwarePinoLogger(baseLogger: pino.Logger): pino.Logger {
  const MAX_EXECUTION_TIME = 50; // 50ms制限
  
  return new Proxy(baseLogger, {
    get(target, prop) {
      const originalMethod = target[prop as keyof pino.Logger];
      
      // ログメソッドのみをラップ
      if (typeof originalMethod === 'function' && 
          ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(prop as string)) {
        
        return function(this: pino.Logger, ...args: any[]) {
          const operationStartTime = Date.now();
          
          try {
            // 処理時間チェック
            const checkTime = () => {
              return (Date.now() - operationStartTime) > MAX_EXECUTION_TIME;
            };
            
            if (checkTime()) {
              // 最小限のフォールバックログ
              console.log(JSON.stringify({
                time: Date.now(),
                level: 40, // warn
                msg: 'Log processing timeout - simplified entry',
                service: 'cms-api',
              }));
              return;
            }
            
            // 元のメソッドを実行
            return originalMethod.apply(this, args);
            
          } catch (error) {
            // フォールバック：最小限のエラーログ
            console.log(JSON.stringify({
              time: Date.now(),
              level: 50, // error
              msg: `Logging error: ${(error as Error).message}`,
              service: 'cms-api',
            }));
          }
        };
      }
      
      return originalMethod;
    }
  });
}

// 使用例
export function createProductionPinoLogger(config: any): pino.Logger {
  const optimizedLogger = createOptimizedPinoLogger(config);
  return createPerformanceAwarePinoLogger(optimizedLogger);
}
```

### 5.2 Pino + Cloudflare Analytics Engine統合

```typescript
// src/infrastructure/logging/PinoAnalyticsIntegration.ts
import pino from 'pino';

// Analytics Engine統合ファクトリー
export function createPinoWithAnalytics({
  level = 'info',
  analyticsEngine,
  environment = 'production'
}: {
  level?: string;
  analyticsEngine?: AnalyticsEngineDataset;
  environment?: string;
}): pino.Logger {
  
  async function sendToAnalytics(logObj: any): Promise<void> {
    if (!analyticsEngine) return;
    
    try {
      const analyticsData = {
        timestamp: new Date(logObj.time).toISOString(),
        traceId: logObj.traceId,
        level: logObj.level,
        levelName: pino.levels.labels[logObj.level] || 'unknown',
        message: logObj.msg,
        service: logObj.service,
        environment,
        
        // ディメンション（フィルタリング用）
        method: logObj.method,
        route: logObj.route,
        status: logObj.response_status,
        country: logObj.cloudflare_country,
        datacenter: logObj.cloudflare_datacenter,
        
        // メトリクス（集計用）
        duration: logObj.performance_duration || 0,
        responseSize: logObj.response_size || 0,
        errorCount: logObj.level >= 50 ? 1 : 0, // error(50)以上
        
        // 業務メトリクス
        businessEntity: logObj.business_entity,
        businessAction: logObj.business_action,
        
        // ユーザー情報
        userId: logObj.userId,
        sessionId: logObj.sessionId,
      };
      
      analyticsEngine.writeDataPoint(analyticsData);
      
    } catch (error) {
      // Analytics送信失敗は処理を止めない
      console.log(JSON.stringify({
        time: Date.now(),
        level: 40, // warn
        msg: 'Failed to send to Analytics Engine',
        service: 'cms-api',
        err: {
          message: (error as Error).message,
          name: (error as Error).name
        }
      }));
    }
  }
  
  return pino({
    level,
    browser: {
      asObject: true,
      write: (logObj: any) => {
        // Console出力
        console.log(JSON.stringify(logObj));
        
        // Analytics Engineに送信 (info以上)
        if (logObj.level >= 30) {
          sendToAnalytics(logObj).catch(() => {
            // エラーをサイレントに処理
          });
        }
      }
    },
    base: {
      service: 'cms-api',
      version: process.env.APP_VERSION || '1.0.0',
      environment,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      ...pino.stdSerializers,
      // エラーオブジェクトのシリアライズをカスタム
      err: (err: Error) => ({
        name: err.name,
        message: err.message,
        stack: err.stack,
      })
    },
  });
}
```

### 5.3 Pino Environment別設定

```typescript
// src/infrastructure/logging/PinoConfig.ts
export interface PinoLoggingConfig {
  level: string;
  enableBatching: boolean;
  batchSize: number;
  batchTimeout: number;
  enableAnalytics: boolean;
  enablePerformanceLogging: boolean;
  maxMessageLength: number;
  enableSensitiveDataLogging: boolean;
  prettyPrint: boolean;
}

export const PINO_CONFIGS: Record<string, PinoLoggingConfig> = {
  production: {
    level: 'info',              // info(30)以上
    enableBatching: true,
    batchSize: 100,
    batchTimeout: 10000,         // 10秒
    enableAnalytics: true,
    enablePerformanceLogging: true,
    maxMessageLength: 500,
    enableSensitiveDataLogging: false,
    prettyPrint: false,          // JSON形式で出力
  },
  
  development: {
    level: 'trace',             // trace(10)以上（全て）
    enableBatching: false,       // 即座出力
    batchSize: 1,
    batchTimeout: 0,
    enableAnalytics: false,      // ローカルでは無効
    enablePerformanceLogging: false,
    maxMessageLength: 10000,
    enableSensitiveDataLogging: true,
    prettyPrint: true,           // 読みやすい形式
  },
  
  staging: {
    level: 'debug',             // debug(20)以上
    enableBatching: true,
    batchSize: 50,
    batchTimeout: 5000,          // 5秒
    enableAnalytics: true,
    enablePerformanceLogging: true,
    maxMessageLength: 1000,
    enableSensitiveDataLogging: true,
    prettyPrint: false,
  },
};

// 環境別Loggerファクトリー
export function createEnvironmentLogger(
  environment: string,
  analyticsEngine?: AnalyticsEngineDataset
): pino.Logger {
  const config = PINO_CONFIGS[environment] || PINO_CONFIGS.production;
  
  if (environment === 'development') {
    // 開発環境: シンプルなPino
    return pino({
      level: config.level,
      transport: config.prettyPrint ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        }
      } : undefined,
      base: {
        service: 'cms-api',
        environment,
      }
    });
  } else {
    // 本番/ステージング: 最適化されたPino
    return createProductionPinoLogger({
      level: config.level,
      analyticsEngine,
      environment,
    });
  }
}
```

## 6. Pino実装ガイド

### 6.1 ディレクトリ構造

```
src/
├── infrastructure/
│   ├── logging/
│   │   ├── PinoLogger.ts              # Pino基本設定と拡張
│   │   ├── PinoContextManager.ts      # Context管理
│   │   ├── PinoConfig.ts              # 環境別設定
│   │   ├── PinoOptimized.ts           # Workers最適化
│   │   ├── PinoPerformanceAware.ts    # パフォーマンス対応
│   │   ├── PinoAnalyticsIntegration.ts # Analytics Engine統合
│   │   ├── TraceIdManager.ts          # CF-Ray管理
│   │   └── types.ts                   # TypeScript型定義
│   └── repositories/
│       └── PinoRepositoryWrapper.ts   # Repository Wrapper
├── application/
│   └── decorators/
│       └── PinoLoggingDecorator.ts    # UseCase Decorator
└── presentation/
    └── middleware/
        └── PinoMiddleware.ts          # HTTP Middleware
```

### 6.2 設定ファイル

```toml
# wrangler.toml
name = "cms-api"
compatibility_date = "2024-12-01"

# Node.js互換性を有効化 (Pinoのため)
[compatibility_flags]
node_compat = true

[env.production]
vars = { 
  NODE_ENV = "production", 
  LOG_LEVEL = "info",
  APP_VERSION = "1.0.0"
}
analytics_engine_datasets = [
  { binding = "ANALYTICS", dataset = "cms_logs" }
]

[env.staging]
vars = { 
  NODE_ENV = "staging", 
  LOG_LEVEL = "debug",
  APP_VERSION = "1.0.0-staging"
}
analytics_engine_datasets = [
  { binding = "ANALYTICS", dataset = "cms_logs_staging" }
]

[env.development]
vars = { 
  NODE_ENV = "development", 
  LOG_LEVEL = "trace",
  APP_VERSION = "1.0.0-dev"
}
```

```json
// package.json (追加依存)
{
  "dependencies": {
    "pino": "^8.17.0"
  },
  "devDependencies": {
    "@types/pino": "^7.0.5",
    "pino-pretty": "^10.3.0"
  }
}
```

### 6.3 Pino使用例

#### Basic Pino Logging
```typescript
// コンテキストからPino Loggerを取得
const logger = context.logger as BusinessLogger;

// 基本ログ (Pino標準)
logger.info('Operation started');
logger.error({ err: error }, 'Operation failed');

// 構造化ログ
logger.info({
  operation: 'create_content',
  performance: { duration: 150 },
  user: { id: userId }
}, 'Content creation completed');

// Child Loggerでコンテキストを継承
const childLogger = logger.child({ operation: 'file_upload' });
childLogger.info('Starting file upload');

// 業務ログ (拡張メソッド)
logger.business('create', 'content', contentId, { title: 'New Post' });

// セキュリティログ
logger.security('auth_failure', { userId, reason: 'invalid_password' });

// 監査ログ
logger.audit('update', 'content', { before: oldData, after: newData });
```

#### Pino UseCase Logging
```typescript
@Injectable(TOKENS.CreateContentUseCase)
@LoggedUseCase('content')
export class CreateContentUseCase {
  constructor(
    private readonly contentRepository: ContentRepositoryInterface,
    private readonly logger: BusinessLogger  // ← Pino LoggerをDI
  ) {}
  
  async execute(request: CreateContentRequest): Promise<ContentResponse> {
    // Decoratorが自動でログ出力
    // 手動でも追加ログ可能
    this.logger.debug({ request }, 'Processing create content request');
    
    return await this.transactionManager.executeInTransaction(async () => {
      // ビジネスロジック
      const content = new Content(request.title, request.body);
      return await this.contentRepository.save(content);
    });
  }
}
```

#### Pino Repository Logging
```typescript
// DI Container での登録
this.register(TOKENS.ContentRepository, 
  (container) => withPinoLogging(
    new PrismaContentRepository(container.getPrismaClient()), 
    'content',
    container.getLogger()  // ← Pino Loggerを渡す
  ), 
  'singleton'
);
```

#### 環境別Logger初期化
```typescript
// workers/app.ts
import { createEnvironmentLogger } from '../src/infrastructure/logging/PinoConfig';

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    // 環境に応じたPino Loggerを作成
    const logger = createEnvironmentLogger(
      env.NODE_ENV || 'production',
      env.ANALYTICS
    );
    
    // リクエストコンテキスト付きChild Logger
    const requestLogger = PinoContextManager.createRequestLogger(logger, request, { env });
    
    // ...
  }
};
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
- ✅ **標準化されたログライブラリ**: Pinoの豊富なAPIとドキュメント
- ✅ **TypeScriptファースト**: 型安全性とIntelliSenseサポート
- ✅ **Child Logger**: コンテキスト継承で汎用性向上
- ✅ **TraceID横断追跡**: CF-Rayとのシームレス統合
- ✅ **自動化**: Decorator/Wrapperによる自動ログ出力

### 11.2 運用効率化
- ✅ **Cloudflare統合**: Analytics Engineとのネイティブ連携
- ✅ **構造化ログ**: JSON形式での機械処理対応
- ✅ **リアルタイム監視**: Dashboardでの即座な可視化
- ✅ **アラート連携**: レベル別異常検知の自動化

### 11.3 パフォーマンス向上
- ✅ **高性能**: Pinoは最速クラスのNode.jsログライブラリ
- ✅ **Workers最適化**: BrowserモードでEdge Runtime対応
- ✅ **メモリ効率**: バッチ処理とスマートバッファリング
- ✅ **CPU最適化**: 非同期処理とタイムアウト保護

### 11.4 エコシステムの利点
- ✅ **コミュニティサポート**: 大きなコミュニティと豊富なツール
- ✅ **プラグイン連携**: pino-pretty, transport系統の活用
- ✅ **ベストプラクティス**: 業界標準のログパターン
- ✅ **将来性**: 継続的なアップデートと機能強化

---

**Last Updated**: 2025-07-02
**Version**: 2.0  
**Status**: Pino Migration Design Complete & Implementation Ready  
**Target Environment**: Cloudflare Workers + React Router v7 + Pino + DDD Architecture  
**Next Steps**: Pino Phase 1 Implementation Start

## Related Documents
- `overview.md` - Modern CMS Design
- `domain-design.md` - CMS Domain Model Detailed Design
- `application-layer.md` - CMS Application Service Layer Design
- `testing-strategy.md` - DORA Testing Strategy
- `dependency-injection.md` - CMS Dependency Injection Strategy Design
- `../CLAUDE.md` - Project Implementation Guide
