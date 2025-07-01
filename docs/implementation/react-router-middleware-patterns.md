# React Router v7 Middleware実装パターン

## 1. Middleware概要

### 1.1 React Router v7 Middlewareとは

React Router v7の**Middleware**（現在unstable）は、ルートハンドラーの前に実行される関数で、認証・認可・ログ・バリデーションなどの横断的関心事を処理できます。

⚠️ **注意**: Middleware は unstable で本番環境での使用は推奨されていません。

```typescript
// react-router.config.ts でMiddleware有効化
import type { Config } from "@react-router/dev/config";
import type { Future } from "react-router";

declare module "react-router" {
  interface Future {
    unstable_middleware: true; // 👈 Middleware型を有効化
  }
}

export default {
  future: {
    unstable_middleware: true, // 👈 Middleware機能を有効化
  },
} satisfies Config;
```

### 1.2 Framework Mode vs Library Mode

React Router v7 では、Framework mode と Library mode で Middleware の実装が異なります：

```typescript
// Framework mode (推奨)
export const unstable_middleware = [serverLogger, serverAuth]; // サーバーサイド
export const unstable_clientMiddleware = [clientLogger];       // クライアントサイド

// Library mode (SPA)
const routes = [
  {
    path: "/",
    unstable_middleware: [clientLogger, clientAuth], // クライアントサイドのみ
    loader: rootLoader,
    Component: Root,
  },
];
```

### 1.3 Server-side vs Client-side Middleware

#### Server-side Middleware
```typescript
import type { Route } from "react-router";

const serverMiddleware: Route.unstable_MiddlewareFunction = async (
  { request, params, context },
  next
) => {
  let start = performance.now();
  
  // 👇 レスポンスを取得
  let res = await next();
  
  let duration = performance.now() - start;
  console.log(`Handled ${request.url} (${duration}ms)`);
  
  // 👇 レスポンスを返却（変更可能）
  return res;
};
```

#### Client-side Middleware
```typescript
const clientMiddleware: Route.unstable_ClientMiddlewareFunction = async (
  { request },
  next
) => {
  let start = performance.now();
  
  // クライアントサイドでは戻り値なし
  await next();
  
  let duration = performance.now() - start;
  console.log(`Navigated to ${request.url} (${duration}ms)`);
};
```

### 1.4 Context API の変更

Middleware有効時は、従来の `AppLoadContext` の代わりに型安全な `ContextProvider` を使用：

```typescript
import { unstable_createContext } from "react-router";
import type { User } from "~/domain/auth/entities/User";

// 型安全なコンテキスト作成
const userContext = unstable_createContext<User>();
const sessionContext = unstable_createContext<Session>();

// Middlewareでコンテキスト設定
const authMiddleware: Route.unstable_MiddlewareFunction = async ({
  context,
  request,
}) => {
  let session = await getSession(request);
  let user = await getUser(session);
  
  context.set(sessionContext, session);
  context.set(userContext, user);
};

// Loaderでコンテキスト取得
export function loader({ context }: Route.LoaderArgs) {
  let user = context.get(userContext); // 型: User
  let session = context.get(sessionContext); // 型: Session
  return { user };
}
```

### 1.5 実行順序

```
Request → Middleware 1 → Middleware 2 → Route Handler → Response
            ↓              ↓               ↓
        認証チェック   →  認可チェック  →  ビジネスロジック
```

## 2. Cloudflare Workers での実装方針

### 2.1 サーバーサイド中心のアプローチ

Cloudflare Workers では、主に **Server-side Middleware** を使用します：

```typescript
// Cloudflare Workers では Server-side Middleware が適切
export const unstable_middleware = [
  authenticationMiddleware,    // サーバーサイド認証
  authorizationMiddleware,     // サーバーサイド認可
  auditLoggingMiddleware       // サーバーサイドログ
];

// クライアントサイドは最小限
export const unstable_clientMiddleware = [
  navigationLoggingMiddleware  // ナビゲーションログのみ
];
```

## 3. 認証・認可Middleware実装

### 3.1 基本的な認証Middleware（Server-side）

```typescript
// app/middleware/authentication.ts
import type { Route } from "react-router";
import { redirect } from "react-router";
import { unstable_createContext } from "react-router";

// 型安全なコンテキスト定義
const userContext = unstable_createContext<User>();

export const authenticationMiddleware: Route.unstable_MiddlewareFunction = async (
  { context, request },
  next
) => {
  const url = new URL(request.url);
  
  // 公開パスは認証をスキップ
  if (isPublicPath(url.pathname)) {
    return next();
  }

  try {
    // 1. Cloudflare Access JWT取得・検証
    const accessJWT = await verifyCloudflareAccessJWT(request);
    
    // 2. ユーザー情報を取得
    const user = await loadUserFromJWT(accessJWT);
    
    // 3. 型安全なコンテキストに設定
    context.set(userContext, user);
    
    // 4. セッション更新
    await updateUserSession(user, request);
    
    // 5. 次のMiddleware/ルートハンドラーに進む
    const response = await next();
    
    return response;
    
  } catch (error) {
    if (error instanceof AuthenticationError) {
      // 認証失敗: ログインページにリダイレクト
      throw redirect('/admin/login');
    }
    
    // 予期しないエラー: 500エラー
    console.error('Authentication middleware error:', error);
    throw new Response('Internal Server Error', { status: 500 });
  }
};

// コンテキストをエクスポート（他のMiddleware/Loaderで使用）
export { userContext };

// 公開パス判定
function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    '/',
    '/posts',
    '/pages',
    '/api/public',
    '/admin/login',
    '/admin/auth'
  ];
  
  return publicPaths.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  );
}
```

### 2.2 JWT検証実装

```typescript
// app/middleware/jwt-verification.ts
interface CloudflareAccessJWT {
  sub: string;          // User ID
  email: string;        // Email address
  name?: string;        // Display name
  groups?: string[];    // User groups
  iat: number;          // Issued at
  exp: number;          // Expires at
  aud: string;          // Audience (Client ID)
}

export async function verifyCloudflareAccessJWT(
  request: Request
): Promise<CloudflareAccessJWT> {
  // 1. JWTヘッダーから取得
  const jwt = request.headers.get('cf-access-jwt-assertion');
  if (!jwt) {
    throw new AuthenticationError('Access JWT not found');
  }

  // 2. JWT構造解析
  const [header, payload, signature] = jwt.split('.');
  if (!header || !payload || !signature) {
    throw new AuthenticationError('Invalid JWT format');
  }

  try {
    // 3. ペイロード取得
    const decodedPayload = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    ) as CloudflareAccessJWT;

    // 4. 基本検証
    validateJWTClaims(decodedPayload, context);

    // 5. 署名検証
    await verifyJWTSignature(jwt, context);

    return decodedPayload;

  } catch (error) {
    throw new AuthenticationError(`JWT verification failed: ${error.message}`);
  }
}

function validateJWTClaims(payload: CloudflareAccessJWT): void {
  const now = Math.floor(Date.now() / 1000);
  
  // 有効期限チェック
  if (payload.exp < now) {
    throw new AuthenticationError('JWT expired');
  }
  
  // 発行時刻チェック（未来の時刻でないか）
  if (payload.iat > now + 60) { // 1分の時差許容
    throw new AuthenticationError('JWT issued in the future');
  }
  
  // Audience チェック
  const expectedAudience = process.env.CF_ACCESS_CLIENT_ID;
  if (payload.aud !== expectedAudience) {
    throw new AuthenticationError('Invalid JWT audience');
  }
  
  // 必須フィールドチェック
  if (!payload.email || !payload.sub) {
    throw new AuthenticationError('Missing required JWT claims');
  }
}

async function verifyJWTSignature(jwt: string): Promise<void> {
  const [headerB64] = jwt.split('.');
  const header = JSON.parse(atob(headerB64));
  
  // Cloudflare Access公開鍵取得
  const publicKey = await getCloudflarePublicKey(header.kid);
  
  // RS256署名検証
  const encoder = new TextEncoder();
  const data = encoder.encode(jwt.split('.').slice(0, 2).join('.'));
  const signature = new Uint8Array(
    Array.from(atob(jwt.split('.')[2].replace(/-/g, '+').replace(/_/g, '/')))
      .map(c => c.charCodeAt(0))
  );
  
  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signature,
    data
  );
  
  if (!isValid) {
    throw new AuthenticationError('JWT signature verification failed');
  }
}
```

### 3.3 権限ベース認可Middleware（Server-side）

```typescript
// app/middleware/authorization.ts
import type { Route } from "react-router";
import { redirect } from "react-router";
import { userContext } from "./authentication";

export function requirePermission(permission: Permission): Route.unstable_MiddlewareFunction {
  return async ({ context, request }, next) => {
    const user = context.get(userContext);
    
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    
    if (!user.hasPermission(permission)) {
      const url = new URL(request.url);
      
      // API エンドポイントの場合
      if (url.pathname.startsWith('/api/')) {
        throw new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Web ページの場合
      throw redirect('/admin/access-denied');
    }
    
    // 認可成功、継続
    const response = await next();
    return response;
  };
}

export function requireRole(roleName: string): Route.unstable_MiddlewareFunction {
  return async ({ context, request }, next) => {
    const user = context.get(userContext);
    
    if (!user || user.getRole().getName() !== roleName) {
      throw new Response('Forbidden', { status: 403 });
    }
    
    const response = await next();
    return response;
  };
}

export function requireAnyPermission(permissions: Permission[]): Route.unstable_MiddlewareFunction {
  return async ({ context, request }, next) => {
    const user = context.get(userContext);
    
    if (!user || !user.hasAnyPermission(permissions)) {
      throw new Response('Forbidden', { status: 403 });
    }
    
    const response = await next();
    return response;
  };
}
```

## 3. セキュリティMiddleware実装

### 3.1 デバイス信頼性Middleware

```typescript
// app/middleware/device-trust.ts
import type { Route } from "react-router";

export const deviceTrustMiddleware: Route.unstable_ClientMiddlewareFunction = async ({ 
  context, 
  next, 
  request 
}) => {
  const url = new URL(request.url);
  
  // 高セキュリティエリアのみ適用
  if (!isHighSecurityPath(url.pathname)) {
    return next();
  }
  
  try {
    const verifier = new DeviceTrustVerifier();
    await verifier.verifyDevice(request);
    
    return next(); // 検証成功
    
  } catch (error) {
    if (error instanceof DeviceTrustError) {
      return new Response(
        JSON.stringify({ 
          error: 'Device trust verification failed',
          message: error.message,
          requiredActions: getRequiredActions(error)
        }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    throw error;
  }
};

function isHighSecurityPath(pathname: string): boolean {
  const highSecurityPaths = [
    '/admin/system',
    '/admin/users',
    '/admin/backup',
    '/api/admin/system'
  ];
  
  return highSecurityPaths.some(path => pathname.startsWith(path));
}

function getRequiredActions(error: DeviceTrustError): string[] {
  const actions: string[] = [];
  
  if (error.message.includes('certificate')) {
    actions.push('Install client certificate');
  }
  
  if (error.message.includes('WARP')) {
    actions.push('Connect to Cloudflare WARP');
  }
  
  if (error.message.includes('region')) {
    actions.push('Access from allowed region');
  }
  
  return actions;
}
```

### 3.2 ネットワークポリシーMiddleware

```typescript
// app/middleware/network-policy.ts
import type { Route } from "react-router";

export const networkPolicyMiddleware: Route.unstable_ClientMiddlewareFunction = async ({ 
  context, 
  next, 
  request 
}) => {
  const url = new URL(request.url);
  const enforcer = new NetworkPolicyEnforcer();
  
  try {
    await enforcer.enforcePolicy(request, url.pathname);
    return next(); // ポリシー適合
    
  } catch (error) {
    if (error instanceof NetworkPolicyError) {
      // 監査ログ記録
      await logSecurityViolation({
        type: 'NETWORK_POLICY_VIOLATION',
        clientIP: request.headers.get('cf-connecting-ip'),
        path: url.pathname,
        reason: error.message,
        timestamp: new Date()
      });
      
      return new Response('Access Denied', { status: 403 });
    }
    
    throw error;
  }
};

class NetworkPolicyEnforcer {
  async enforcePolicy(request: Request, pathname: string): Promise<void> {
    const policy = this.getPolicy(pathname);
    if (!policy) return;
    
    // IP制限チェック
    if (policy.allowedIPs) {
      const clientIP = request.headers.get('cf-connecting-ip');
      if (!this.isIPAllowed(clientIP, policy.allowedIPs)) {
        throw new NetworkPolicyError('IP address not allowed');
      }
    }
    
    // 地域制限チェック
    if (policy.allowedCountries) {
      const country = request.headers.get('cf-ipcountry');
      if (!policy.allowedCountries.includes(country)) {
        throw new NetworkPolicyError('Geographic access denied');
      }
    }
    
    // 時間制限チェック
    if (policy.timeRestriction) {
      if (!this.isAccessTimeAllowed(policy.timeRestriction)) {
        throw new NetworkPolicyError('Access outside allowed hours');
      }
    }
    
    // レート制限チェック
    if (policy.rateLimit) {
      const clientIP = request.headers.get('cf-connecting-ip');
      await this.enforceRateLimit(clientIP, pathname, policy.rateLimit);
    }
  }
}
```

### 3.3 監査ログMiddleware

```typescript
// app/middleware/audit-logging.ts
import type { Route } from "react-router";

export const auditLoggingMiddleware: Route.unstable_ClientMiddlewareFunction = async ({ 
  context, 
  next, 
  request 
}) => {
  const startTime = Date.now();
  const url = new URL(request.url);
  
  // 監査対象パスの判定
  if (!isAuditablePath(url.pathname)) {
    return next();
  }
  
  // リクエスト情報収集
  const user = context.get('user') as User | undefined;
  const auditData: AuditLogData = {
    timestamp: new Date().toISOString(),
    method: request.method,
    path: url.pathname,
    query: url.search,
    clientIP: request.headers.get('cf-connecting-ip'),
    userAgent: request.headers.get('user-agent'),
    country: request.headers.get('cf-ipcountry'),
    userId: user?.getId().getValue(),
    userEmail: user?.getEmail().getValue(),
    sessionId: generateSessionId(request)
  };
  
  // レスポンス処理後にログ記録するためのコンテキスト設定
  context.set('auditData', auditData);
  context.set('requestStartTime', startTime);
  
  return next(); // 継続
};

// レスポンス後のログ記録（app/entry.server.tsx等で実装）
export async function logAuditEntry(
  auditData: AuditLogData,
  response: Response,
  duration: number
): Promise<void> {
  const logger = new SecurityAuditLogger();
  
  await logger.logSecurityEvent({
    type: 'ACCESS_LOG',
    severity: getSeverity(auditData.path, response.status),
    ...auditData,
    statusCode: response.status,
    duration,
    responseSize: response.headers.get('content-length')
  });
}

function getSeverity(path: string, status: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (status >= 500) return 'HIGH';
  if (status >= 400) return 'MEDIUM';
  if (path.includes('/admin/system')) return 'HIGH';
  if (path.includes('/admin')) return 'MEDIUM';
  return 'LOW';
}
```

## 4. Middleware組み合わせパターン

### 4.1 ルートレベルでのMiddleware定義

```typescript
// app/routes/admin.content.new.tsx
import { requirePermission } from '~/middleware/authorization';
import { auditLoggingMiddleware } from '~/middleware/audit-logging';
import { userContext } from '~/middleware/authentication';
import { Permission } from '~/domain/auth/valueObjects/Permission';
import type { Route } from "react-router";

// Server-side Middleware配列で順序指定
export const unstable_middleware = [
  auditLoggingMiddleware,                    // 1. 監査ログ
  requirePermission(Permission.CONTENT_CREATE) // 2. 権限チェック
];

export async function action({ request, context }: Route.ActionArgs) {
  // この時点で認証・認可済み
  const user = context.get(userContext);
  const formData = await request.formData();
  
  const createRequest = CreateContentRequestSchema.parse({
    title: formData.get('title'),
    body: formData.get('body'),
    contentTypeId: formData.get('contentTypeId')
  });
  
  const useCase = container.resolve(CreateContentUseCase);
  const result = await useCase.execute(createRequest);
  
  return redirect(`/admin/content/${result.id}`);
}

export async function loader({ context }: Route.LoaderArgs) {
  // 型安全にユーザー情報を取得
  const user = context.get(userContext);
  return { 
    user: {
      name: user.getName().getValue(),
      email: user.getEmail().getValue(),
      role: user.getRole().getName().getValue()
    }
  };
}
```

### 4.2 ディレクトリレベルでのMiddleware

```typescript
// app/routes/admin.tsx (親ルート)
export const unstable_middleware = [
  authenticationMiddleware,  // 全admin配下で認証必須
  auditLoggingMiddleware     // 全admin配下で監査ログ
];

// app/routes/admin.system.tsx (高セキュリティエリア)
export const unstable_middleware = [
  deviceTrustMiddleware,     // デバイス信頼性チェック
  networkPolicyMiddleware,   // ネットワークポリシー
  requireRole('admin')       // admin ロール必須
];
```

### 4.3 条件付きMiddleware

```typescript
// app/middleware/conditional-security.ts
import type { Route } from "react-router";
import { redirect } from "react-router";

export const conditionalSecurityMiddleware: Route.unstable_ClientMiddlewareFunction = async ({ 
  context, 
  next, 
  request 
}) => {
  const url = new URL(request.url);
  const user = context.get('user') as User;
  
  // 高権限操作の場合のみ追加セキュリティ
  if (isHighPrivilegeOperation(url.pathname, request.method)) {
    
    // MFA要求
    if (!await verifyMFA(user, request)) {
      return redirect('/admin/mfa-required');
    }
    
    // セッション再検証
    if (!await revalidateSession(user, request)) {
      return redirect('/admin/login');
    }
    
    // 管理者承認必要
    if (requiresApproval(url.pathname) && !user.hasRole('super_admin')) {
      return redirect('/admin/approval-required');
    }
  }
  
  return next();
};

function isHighPrivilegeOperation(path: string, method: string): boolean {
  const highPrivilegePaths = [
    '/admin/users/delete',
    '/admin/system/backup',
    '/admin/system/reset'
  ];
  
  const dangerousMethods = ['DELETE', 'PUT'];
  
  return highPrivilegePaths.some(p => path.startsWith(p)) ||
         (path.includes('/admin/system') && dangerousMethods.includes(method));
}
```

## 5. エラーハンドリングパターン

### 5.1 統一エラーハンドリングMiddleware

```typescript
// app/middleware/error-handling.ts
export const errorHandlingMiddleware: MiddlewareFunction = async (request, context) => {
  try {
    // 次のMiddleware/ルートハンドラーを実行
    return null;
    
  } catch (error) {
    // エラー分類と処理
    if (error instanceof AuthenticationError) {
      return handleAuthenticationError(error, request);
    }
    
    if (error instanceof AuthorizationError) {
      return handleAuthorizationError(error, request);
    }
    
    if (error instanceof ValidationError) {
      return handleValidationError(error, request);
    }
    
    // 予期しないエラー
    console.error('Unexpected middleware error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};

function handleAuthenticationError(error: AuthenticationError, request: Request): Response {
  const url = new URL(request.url);
  
  // API リクエストの場合
  if (url.pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({ 
        error: 'Authentication required',
        loginUrl: '/admin/login'
      }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Web ページの場合
  return redirect(`/admin/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
}

function handleAuthorizationError(error: AuthorizationError, request: Request): Response {
  const url = new URL(request.url);
  
  if (url.pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({ 
        error: 'Insufficient permissions',
        required: error.requiredPermission
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  return redirect('/admin/access-denied');
}
```

### 5.2 レスポンス後処理

```typescript
// app/middleware/response-processor.ts
export const responseProcessorMiddleware: MiddlewareFunction = async (request, context) => {
  // レスポンス後処理のためのフック設定
  context.postResponseHooks = context.postResponseHooks || [];
  
  // 監査ログ記録フック
  context.postResponseHooks.push(async (response: Response) => {
    if (context.auditData) {
      await logAuditEntry(
        context.auditData,
        response,
        Date.now() - context.requestStartTime
      );
    }
  });
  
  // セキュリティヘッダー追加フック
  context.postResponseHooks.push(async (response: Response) => {
    return addSecurityHeaders(response);
  });
  
  return null;
};
```

## 6. パフォーマンス最適化

### 6.1 キャッシュ戦略Middleware

```typescript
// app/middleware/caching.ts
export const cachingMiddleware: MiddlewareFunction = async (request, context) => {
  const url = new URL(request.url);
  
  // キャッシュ可能なリソースの場合
  if (isCacheable(url.pathname, request.method)) {
    const cacheKey = generateCacheKey(request);
    
    // キャッシュ確認
    const cached = await getFromCache(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        status: cached.status,
        headers: {
          ...cached.headers,
          'X-Cache': 'HIT'
        }
      });
    }
    
    // キャッシュミス: コンテキストにキャッシュ情報設定
    context.cacheKey = cacheKey;
    context.shouldCache = true;
  }
  
  return null;
};

function isCacheable(pathname: string, method: string): boolean {
  if (method !== 'GET') return false;
  
  const cacheablePaths = [
    '/api/public',
    '/posts',
    '/pages'
  ];
  
  return cacheablePaths.some(path => pathname.startsWith(path));
}
```

### 6.2 レート制限Middleware

```typescript
// app/middleware/rate-limiting.ts
export const rateLimitingMiddleware: MiddlewareFunction = async (request, context) => {
  const clientIP = request.headers.get('cf-connecting-ip');
  const url = new URL(request.url);
  
  // パス別レート制限設定
  const limit = getRateLimit(url.pathname);
  if (!limit) return null;
  
  const key = `rate_limit:${clientIP}:${url.pathname}`;
  const current = await context.cloudflare.env.KV.get(key);
  
  if (current && parseInt(current) >= limit.maxRequests) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter: limit.windowSeconds
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': limit.windowSeconds.toString()
        }
      }
    );
  }
  
  // カウンター更新
  const newCount = current ? parseInt(current) + 1 : 1;
  await context.cloudflare.env.KV.put(
    key, 
    newCount.toString(), 
    { expirationTtl: limit.windowSeconds }
  );
  
  return null;
};

function getRateLimit(pathname: string): RateLimit | null {
  const limits: Record<string, RateLimit> = {
    '/api/admin': { maxRequests: 100, windowSeconds: 60 },
    '/api/public': { maxRequests: 1000, windowSeconds: 60 },
    '/admin/login': { maxRequests: 5, windowSeconds: 300 }, // 5分で5回まで
  };
  
  for (const [path, limit] of Object.entries(limits)) {
    if (pathname.startsWith(path)) {
      return limit;
    }
  }
  
  return null;
}
```

## 7. テスト実装

### 7.1 Middlewareユニットテスト

```typescript
// app/middleware/__tests__/authentication.test.ts
describe('authenticationMiddleware', () => {
  let mockRequest: Request;
  let mockContext: AppLoadContext;
  
  beforeEach(() => {
    mockRequest = new Request('https://example.com/admin/content');
    mockContext = {
      cloudflare: {
        env: {
          CF_ACCESS_CLIENT_ID: 'test-client-id'
        }
      }
    } as any;
  });
  
  it('should authenticate valid JWT', async () => {
    const validJWT = 'valid.jwt.token';
    mockRequest.headers.set('cf-access-jwt-assertion', validJWT);
    
    // JWT検証のモック
    jest.spyOn(jwtModule, 'verifyCloudflareAccessJWT')
      .mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600
      });
    
    const result = await authenticationMiddleware(mockRequest, mockContext);
    
    expect(result).toBeNull(); // 認証成功で継続
    expect(mockContext.user).toBeDefined();
  });
  
  it('should redirect to login for missing JWT', async () => {
    const result = await authenticationMiddleware(mockRequest, mockContext);
    
    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(302);
    expect(result.headers.get('Location')).toBe('/admin/login');
  });
});
```

### 7.2 統合テスト

```typescript
// tests/integration/middleware.test.ts
describe('Middleware Integration', () => {
  it('should process middleware chain correctly', async () => {
    const app = new App();
    
    // テスト用のミドルウェアチェーン
    const middlewares = [
      authenticationMiddleware,
      requirePermission(Permission.CONTENT_READ),
      auditLoggingMiddleware
    ];
    
    const response = await app.request('/admin/content', {
      headers: {
        'cf-access-jwt-assertion': 'valid.jwt.token'
      }
    });
    
    expect(response.status).toBe(200);
    
    // 監査ログが記録されていることを確認
    const auditLogs = await getAuditLogs();
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].path).toBe('/admin/content');
  });
});
```

## 8. 実装ベストプラクティス

### 8.1 Middleware設計原則

1. **単一責任**: 1つのMiddlewareは1つの関心事のみ処理
2. **順序依存性の最小化**: 可能な限り他のMiddlewareに依存しない
3. **エラーハンドリング**: 適切な例外処理とフォールバック
4. **パフォーマンス**: 必要最小限の処理とキャッシュ活用
5. **テスタビリティ**: 単体テスト可能な構造

### 8.2 実装チェックリスト

- [ ] 認証Middleware実装
- [ ] 認可Middleware実装  
- [ ] デバイス信頼性Middleware実装
- [ ] ネットワークポリシーMiddleware実装
- [ ] 監査ログMiddleware実装
- [ ] エラーハンドリングMiddleware実装
- [ ] レート制限Middleware実装
- [ ] Middlewareユニットテスト作成
- [ ] 統合テスト作成
- [ ] パフォーマンステスト実施

## 9. 関連ドキュメント

- [authentication-security.md](../architecture/authentication-security.md) - 認証・セキュリティアーキテクチャ
- [zero-trust-security.md](zero-trust-security.md) - ゼロトラストセキュリティ実装戦略
- [development-guide.md](development-guide.md) - 開発実装ガイド

---

**作成日**: 2025-07-01  
**バージョン**: 1.0  
**ステータス**: 実装パターン完成  
**React Router**: v7 Middleware (unstable) 対応