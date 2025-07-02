# Cloudflare Access設定ガイド

## 1. Cloudflare Access概要

### 1.1 Cloudflare Accessとは

**Cloudflare Access**は、Cloudflareが提供するゼロトラストセキュリティソリューションで、Webアプリケーションへのアクセスを認証・認可レベルで保護します。

```
従来のVPN + ファイアウォール:
[User] → [VPN] → [Firewall] → [App]

Cloudflare Access (Zero Trust):
[User] → [Identity Provider] → [Cloudflare Access] → [App]
           ↓                      ↓
        OAuth認証            ポリシー評価
```

### 1.2 主要機能

- **Identity Provider統合**: Google, GitHub, Azure AD, SAML等
- **Zero Trust Access**: 内部・外部の区別なくアクセス制御
- **詳細なポリシー設定**: パス別・ユーザー別・時間別制御
- **監査ログ**: 全アクセスの詳細記録
- **無料プラン**: 50ユーザーまで無料

## 2. 初期設定

### 2.1 Cloudflareアカウント準備

```bash
# 1. Cloudflareアカウント作成
# https://dash.cloudflare.com/sign-up

# 2. ドメインをCloudflareに追加
# - DNS設定をCloudflareに変更
# - SSL/TLS設定を確認

# 3. Workers設定確認
# - Workers & Pages セクション
# - カスタムドメイン設定（オプション）
```

### 2.2 Cloudflare Access有効化

```bash
# Cloudflare Dashboard
1. Zero Trust セクションに移動
2. Access → Applications
3. "Add an application" クリック
4. "Self-hosted" を選択
```

### 2.3 CLI設定（オプション）

```bash
# Cloudflare CLI インストール（Wranglerに含まれる）
bun add -g wrangler

# 認証
wrangler auth login

# Zero Trust設定確認
wrangler access --help
```

## 3. Application設定

### 3.1 基本Application設定

#### 設定例: CMS管理画面保護

```yaml
# Cloudflare Dashboard設定項目
Application Details:
  Name: "CMS Admin Panel"
  Session Duration: "24h"
  Auto Redirect to Identity: true
  
Application Domain:
  Domain: "your-cms.workers.dev"
  Path: "/admin/*"
  
Advanced Settings:
  HTTP Only Cookie: true
  Same Site Attribute: "Strict"
  Enable Binding Cookie: false
  Custom Denial URL: "/admin/access-denied"
  Custom Non-Identity Denial URL: "/admin/login-required"
```

#### CLI による設定

```bash
# Application作成
wrangler access applications create \
  --name "CMS Admin Panel" \
  --domain "your-cms.workers.dev" \
  --path "/admin/*" \
  --session-duration "24h" \
  --auto-redirect-to-identity true

# 設定確認
wrangler access applications list
```

### 3.2 詳細パス設定

```yaml
# 複数パスでの保護設定
Protected Paths:
  # 管理画面全体
  - Path: "/admin/*"
    Methods: ["GET", "POST", "PUT", "DELETE"]
    
  # 管理API
  - Path: "/api/admin/*" 
    Methods: ["GET", "POST", "PUT", "DELETE"]
    
  # システム設定（高セキュリティ）
  - Path: "/admin/system/*"
    Methods: ["GET", "POST", "PUT", "DELETE"]
    Additional Security: true

Excluded Paths:
  # 公開ログインページ
  - Path: "/admin/login"
  - Path: "/admin/auth/callback"
  - Path: "/admin/health"
```

## 4. Identity Provider設定

### 4.1 Google OAuth設定

#### Google Cloud Console設定

```bash
# 1. Google Cloud Consoleでプロジェクト作成
# https://console.cloud.google.com/

# 2. API & Services → Credentials
# 3. Create Credentials → OAuth 2.0 Client IDs

OAuth 2.0 Client設定:
  Application Type: "Web application"
  Name: "CMS Admin Access"
  
  Authorized JavaScript origins:
    - https://your-team.cloudflareaccess.com
    
  Authorized redirect URIs:
    - https://your-team.cloudflareaccess.com/cdn-cgi/access/callback
```

#### Cloudflare Access設定

```yaml
# Cloudflare Dashboard → Zero Trust → Settings → Authentication
Identity Provider Settings:
  Name: "Google OAuth"
  Type: "Google"
  
  Configuration:
    Client ID: "your-google-client-id"
    Client Secret: "your-google-client-secret"
    
  Claims:
    Email: "email"
    Name: "name"
    Groups: "groups"
    
  Advanced:
    Scopes: ["email", "profile"]
    Hosted Domain: "company.com" (Optional)
```

### 4.2 GitHub OAuth設定

#### GitHub設定

```bash
# 1. GitHub → Settings → Developer settings → OAuth Apps
# 2. "New OAuth App" クリック

OAuth App設定:
  Application Name: "CMS Admin Access"
  Homepage URL: "https://your-cms.workers.dev"
  Authorization callback URL: "https://your-team.cloudflareaccess.com/cdn-cgi/access/callback"
```

#### Cloudflare Access設定

```yaml
Identity Provider Settings:
  Name: "GitHub OAuth"
  Type: "GitHub" 
  
  Configuration:
    Client ID: "your-github-client-id"
    Client Secret: "your-github-client-secret"
    
  Advanced:
    Organizations: ["your-organization"]
    Teams: ["cms-admin", "developers"]
```

### 4.3 Azure AD設定

#### Azure AD設定

```bash
# 1. Azure Portal → Azure Active Directory
# 2. App registrations → New registration

App Registration:
  Name: "CMS Admin Access"
  Supported account types: "Accounts in this organizational directory only"
  Redirect URI: "https://your-team.cloudflareaccess.com/cdn-cgi/access/callback"
  
# 3. Certificates & secrets → New client secret
# 4. API permissions → Add Microsoft Graph permissions
```

#### Cloudflare Access設定

```yaml
Identity Provider Settings:
  Name: "Azure AD"
  Type: "Azure AD"
  
  Configuration:
    Client ID: "your-azure-app-id"
    Client Secret: "your-azure-client-secret"
    Directory ID: "your-tenant-id"
    
  Claims:
    Email: "unique_name"
    Name: "name"
    Groups: "groups"
```

## 5. Access Policy設定

### 5.1 基本ポリシー

#### 管理者ポリシー

```yaml
Policy Name: "CMS Administrators"
Action: "Allow"
Session Duration: "24h"

Rules:
  # 特定メールアドレス
  - Type: "Email"
    Values: 
      - "admin@company.com"
      - "manager@company.com"
      
  # ドメインベース
  - Type: "Email Domain"
    Values:
      - "company.com"
      
  # Google Workspace
  - Type: "GSuite"
    Identity Provider: "Google OAuth"
    Values:
      - "company.com"
      
  # GitHub Organization
  - Type: "GitHub Organization"
    Identity Provider: "GitHub OAuth"
    Values:
      - "your-organization"
```

#### 時間制限ポリシー

```yaml
Policy Name: "Business Hours Only"
Action: "Allow"

Rules:
  - Type: "Time"
    Configuration:
      Time Zone: "Asia/Tokyo"
      Days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
      Hours:
        Start: "09:00"
        End: "18:00"
        
  # かつ 承認済みユーザー
  - Type: "Email Domain"
    Values: ["company.com"]
```

#### 地域制限ポリシー

```yaml
Policy Name: "Geographic Restriction"
Action: "Allow"

Rules:
  # 日本からのアクセスのみ
  - Type: "Country"
    Values: ["JP"]
    
  # または アメリカからの管理者
  - Type: "Country"
    Values: ["US"]
    Additional Rules:
      - Type: "Email"
        Values: ["global-admin@company.com"]
```

### 5.2 詳細ポリシー設定

#### 階層的アクセス制御

```yaml
# Level 1: 基本管理画面
Application: "/admin/content/*"
Policies:
  - Name: "Content Editors"
    Rules:
      - Email Domain: "company.com"
      - GitHub Teams: ["content-team"]

# Level 2: ユーザー管理
Application: "/admin/users/*"  
Policies:
  - Name: "User Managers"
    Rules:
      - Email: ["admin@company.com", "hr@company.com"]
      - Require MFA: true

# Level 3: システム設定
Application: "/admin/system/*"
Policies:
  - Name: "System Administrators"
    Rules:
      - Email: ["admin@company.com"]
      - IP Range: ["192.168.1.0/24"]
      - Time: "Business Hours"
      - Require Hardware Key: true
```

#### 条件付きアクセス

```yaml
Policy Name: "Conditional Access"
Action: "Allow"

Conditional Rules:
  # 通常時間: 簡単な認証
  - Condition: "Business Hours"
    Rules:
      - Email Domain: "company.com"
      
  # 時間外: 厳格な認証  
  - Condition: "After Hours"
    Rules:
      - Email: ["admin@company.com"]
      - Require MFA: true
      - IP Allowlist: ["home-office-ip"]
      
  # 外部アクセス: 最高レベル
  - Condition: "External Location"
    Rules:
      - Email: ["admin@company.com"]
      - Require Hardware Key: true
      - Session Duration: "1h"
```

## 6. 高度なセキュリティ設定

### 6.1 Device Trust設定

#### WARP必須設定

```yaml
# Zero Trust → Settings → WARP Client
WARP Configuration:
  Device Enrollment: "Required"
  Organization Name: "Company CMS"
  
Device Policies:
  - Name: "Admin Device Policy"
    Apply To: "CMS Administrators"
    Requirements:
      - Device Registration: true
      - OS Version: "Latest"
      - Antivirus: "Required"
      - Disk Encryption: "Required"
```

#### Client Certificate設定

```bash
# 1. Certificate Authority作成
# Zero Trust → Settings → Device certificates

# 2. Certificate Generation
# - Root CA作成
# - Device Certificate配布

# 3. mTLS Policy適用
# Access → Applications → Advanced → mTLS
```

### 6.2 リスクベースアクセス

#### セッション管理

```yaml
Session Controls:
  # セッション期間
  Default Duration: "8h"
  Maximum Duration: "24h"
  Idle Timeout: "2h"
  
  # 並行セッション制限
  Max Concurrent Sessions: 3
  
  # セッション検証
  Periodic Reauthentication: "4h"
  Device Binding: true
```

#### 異常検知

```yaml
Anomaly Detection:
  # 位置異常
  Geographic Anomaly:
    Enable: true
    Sensitivity: "Medium"
    Notification: true
    
  # 時間異常
  Time-based Anomaly:
    Enable: true
    Learning Period: "30 days"
    
  # デバイス異常
  Device Anomaly:
    Enable: true
    Unknown Device: "Block"
    
  # 行動異常
  Behavioral Anomaly:
    Enable: true
    AI Learning: true
```

## 7. Monitoring & Logging

### 7.1 Access Logs設定

#### ログ設定

```yaml
# Zero Trust → Logs → Access
Access Logs:
  Enable: true
  Retention: "6 months"
  
Export Settings:
  # Cloudflare Analytics Engine
  - Destination: "Analytics Engine"
    Dataset: "access_logs"
    
  # External SIEM
  - Destination: "Webhook"
    URL: "https://your-siem.company.com/webhook"
    Headers:
      Authorization: "Bearer YOUR_TOKEN"
```

#### ログ形式

```json
{
  "timestamp": "2025-07-01T10:30:00Z",
  "user_id": "user@company.com",
  "application": "CMS Admin Panel",
  "action": "login_success",
  "ip_address": "203.0.113.123",
  "country": "JP",
  "user_agent": "Mozilla/5.0...",
  "session_id": "sess_123456789",
  "policy_evaluation": {
    "policies": ["CMS Administrators", "Business Hours"],
    "result": "allow",
    "evaluation_time_ms": 45
  },
  "device_info": {
    "device_id": "device_abc123",
    "device_type": "desktop",
    "warp_enabled": true
  }
}
```

### 7.2 アラート設定

#### セキュリティアラート

```yaml
Alert Rules:
  # 複数回ログイン失敗
  - Name: "Multiple Login Failures"
    Condition: "failed_logins > 5 in 5 minutes"
    Action: "Lock account + Notify admin"
    
  # 異常な地域からのアクセス
  - Name: "Geographic Anomaly"
    Condition: "login from unusual country"
    Action: "Require additional verification"
    
  # 時間外システムアクセス
  - Name: "After Hours System Access"
    Condition: "access to /admin/system/* outside business hours"
    Action: "Immediate notification"
    
  # 新しいデバイス
  - Name: "New Device Access"
    Condition: "first time device"
    Action: "Additional verification + Log"
```

#### 通知設定

```yaml
Notification Channels:
  # Email
  - Type: "Email"
    Recipients: ["security@company.com", "admin@company.com"]
    
  # Slack
  - Type: "Webhook"
    URL: "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
    
  # Teams
  - Type: "Webhook"  
    URL: "https://company.webhook.office.com/webhookb2/YOUR_WEBHOOK"
```

## 8. JWT設定とアプリ連携

### 8.1 JWT設定

#### Application JWT設定

```yaml
# Application → Authentication → JWT
JWT Configuration:
  Enable: true
  Signing Algorithm: "RS256"
  
  Token Claims:
    - email
    - name
    - groups
    - sub (user ID)
    - iat (issued at)
    - exp (expires at)
    - aud (audience)
    
  Custom Claims:
    - role: "user.role"
    - permissions: "user.permissions"
    
  Token Lifetime: "1h"
  Refresh Enabled: true
```

#### Public Key取得

```bash
# JWT検証用の公開鍵取得エンドポイント
curl https://your-team.cloudflareaccess.com/cdn-cgi/access/certs

# レスポンス例
{
  "keys": [
    {
      "kid": "key-id-123",
      "kty": "RSA",
      "use": "sig",
      "n": "public-key-modulus...",
      "e": "AQAB"
    }
  ]
}
```

### 8.2 アプリケーション連携

#### Workers内でのJWT検証

```typescript
// workers/auth-verification.ts
export async function verifyAccessJWT(request: Request): Promise<UserClaims> {
  const jwt = request.headers.get('cf-access-jwt-assertion');
  
  if (!jwt) {
    throw new Error('Access JWT not found');
  }
  
  // JWT検証
  const payload = await verifyJWTSignature(jwt);
  
  return {
    userId: payload.sub,
    email: payload.email,
    name: payload.name,
    groups: payload.groups || [],
    permissions: payload.permissions || []
  };
}

async function verifyJWTSignature(jwt: string): Promise<any> {
  const [header] = jwt.split('.');
  const { kid } = JSON.parse(atob(header));
  
  // 公開鍵取得
  const certsUrl = 'https://your-team.cloudflareaccess.com/cdn-cgi/access/certs';
  const certs = await fetch(certsUrl).then(r => r.json());
  const publicKey = certs.keys.find(k => k.kid === kid);
  
  if (!publicKey) {
    throw new Error('Public key not found');
  }
  
  // 署名検証実装
  // ...
}
```

#### React Router Middleware連携

```typescript
// app/middleware/cloudflare-access.ts
export const cloudflareAccessMiddleware: MiddlewareFunction = async (request, context) => {
  try {
    const userClaims = await verifyAccessJWT(request);
    
    // ユーザー情報をコンテキストに設定
    context.user = await mapClaimsToUser(userClaims);
    
    return null; // 継続
    
  } catch (error) {
    // Access認証失敗
    return redirect('/admin/access-denied');
  }
};
```

## 9. トラブルシューティング

### 9.1 よくある問題

#### 認証ループ

```bash
# 問題: ログイン後も認証画面に戻る
# 原因: Cookie設定・ドメイン不一致

解決方法:
1. Application Domain設定確認
2. Cookie設定確認（SameSite、Secure）
3. DNS設定確認
4. ブラウザーキャッシュクリア
```

#### JWT検証エラー

```bash
# 問題: JWT signature verification failed
# 原因: 公開鍵の取得・検証ロジック

解決方法:
1. 公開鍵エンドポイント確認
2. JWT Header・Payload確認
3. 署名アルゴリズム確認（RS256）
4. Token有効期限確認
```

#### Identity Provider連携エラー

```bash
# 問題: OAuth認証失敗
# 原因: Redirect URI・Client設定

解決方法:
1. OAuth App設定確認
2. Redirect URI完全一致確認
3. Client ID・Secret確認
4. Scope設定確認
```

### 9.2 デバッグツール

#### Access Logs確認

```bash
# Cloudflare Dashboard
1. Zero Trust → Logs → Access
2. Filter by User/Application/Time
3. Export logs for analysis

# CLI
wrangler access logs list --application-id=<app-id>
```

#### JWT Debugging

```typescript
// JWT内容確認用ツール
function debugJWT(jwt: string) {
  const [header, payload] = jwt.split('.').map(part => 
    JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
  );
  
  console.log('JWT Header:', header);
  console.log('JWT Payload:', payload);
  console.log('Expires at:', new Date(payload.exp * 1000));
}
```

## 10. 運用ベストプラクティス

### 10.1 セキュリティベストプラクティス

1. **最小権限の原則**: 必要最小限のアクセスのみ許可
2. **定期的な権限見直し**: 月次での権限監査
3. **強力な認証**: MFA・Hardware Key推奨
4. **セッション管理**: 適切なタイムアウト設定
5. **監査ログ**: 全アクセスログの保管・分析

### 10.2 運用チェックリスト

#### 初期設定

- [ ] Identity Provider設定完了
- [ ] Application・Policy設定完了
- [ ] JWT検証実装完了
- [ ] ログ・監視設定完了
- [ ] 緊急時アクセス手順確立

#### 定期メンテナンス

- [ ] ユーザーアクセス権限レビュー（月次）
- [ ] セキュリティログ分析（週次）
- [ ] Policy設定見直し（四半期）
- [ ] Certificate更新（年次）
- [ ] 災害復旧テスト（年次）

## 11. Related Documents

- [authentication-security.md](../architecture/authentication-security.md) - Authentication & Security Architecture
- [zero-trust-security.md](../implementation/zero-trust-security.md) - Zero Trust Security Implementation Strategy
- [react-router-middleware-patterns.md](../implementation/react-router-middleware-patterns.md) - React Router Middleware Implementation Patterns

---

**Last Updated**: 2025-07-02
**Version**: 2.0  
**Status**: Configuration Guide Complete  
**対象**: Cloudflare Access Free/Paid プラン