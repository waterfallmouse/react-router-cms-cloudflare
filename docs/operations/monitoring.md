# Monitoring & Metrics Strategy

## 1. Monitoring Architecture Overview

### 1.1 Monitoring Layer Structure
```
┌─────────────────────────────────────┐
│        User Experience             │
│  Real User Monitoring (Cloudflare) │
└─────────────────────────────────────┘
                   │
┌─────────────────────────────────────┐
│       Application Metrics          │
│  Analytics Engine + Custom Logs    │
└─────────────────────────────────────┘
                   │
┌─────────────────────────────────────┐
│     Infrastructure Metrics         │
│ Workers Analytics + D1 + R2 Metrics │
└─────────────────────────────────────┘
                   │
┌─────────────────────────────────────┐
│        External Monitoring         │
│   UptimeRobot + PagerDuty          │
└─────────────────────────────────────┘
```

### 1.2 Metrics Classification
| カテゴリ | 指標 | 監視ツール | アラート |
|----------|------|------------|----------|
| **可用性** | Uptime, Health Check | UptimeRobot, Pingdom | 即座 |
| **パフォーマンス** | Response Time, Cold Start | Cloudflare Analytics | 5分後 |
| **エラー** | Error Rate, 5xx Status | Workers Analytics | 即座 |
| **ビジネス** | Content Creation, User Activity | Analytics Engine | 日次 |
| **リソース** | CPU, Memory, D1/R2 Usage | Cloudflare Dashboard | 閾値超過時 |

## 2. Cloudflare Analytics Utilization

### 2.1 Workers Analytics Configuration
```typescript
// workers/app.ts - Analytics Event送信
export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(request.url);
    
    try {
      const response = await server.fetch(request, { cloudflare: { env } });
      
      // Analytics Engine にメトリクス送信
      if (env.ANALYTICS) {
        env.ANALYTICS.writeDataPoint({
          timestamp: new Date().toISOString(),
          method: request.method,
          path: url.pathname,
          status: response.status,
          duration: Date.now() - startTime,
          userAgent: request.headers.get('user-agent') || 'unknown',
          country: request.headers.get('cf-ipcountry') || 'unknown',
          datacenter: request.headers.get('cf-ray')?.split('-')[1] || 'unknown',
        });
      }
      
      return response;
    } catch (error) {
      // エラーメトリクス送信
      if (env.ANALYTICS) {
        env.ANALYTICS.writeDataPoint({
          timestamp: new Date().toISOString(),
          method: request.method,
          path: url.pathname,
          status: 500,
          duration: Date.now() - startTime,
          error: (error as Error).message,
        });
      }
      throw error;
    }
  }
};
```

### 2.3 Analytics Engine Query Examples
```sql
-- パフォーマンス分析
SELECT 
  path,
  AVG(duration) as avg_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration) as p95_duration,
  COUNT(*) as request_count
FROM analytics_dataset 
WHERE timestamp > NOW() - INTERVAL '1' HOUR
  AND duration IS NOT NULL
GROUP BY path
ORDER BY avg_duration DESC;

-- エラー率分析
SELECT 
  path,
  COUNT(*) as total_requests,
  SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error_count,
  (SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as error_rate
FROM analytics_dataset
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY path
HAVING error_rate > 5
ORDER BY error_rate DESC;

-- 地域別パフォーマンス
SELECT 
  country,
  datacenter,
  COUNT(*) as request_count,
  AVG(duration) as avg_duration
FROM analytics_dataset
WHERE timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY country, datacenter
ORDER BY request_count DESC;

-- ビジネスメトリクス
SELECT 
  DATE(timestamp) as date,
  contentType,
  COUNT(*) as created_count
FROM analytics_dataset
WHERE event = 'content_created'
  AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY DATE(timestamp), contentType
ORDER BY date DESC, created_count DESC;
```

## 3. Real User Monitoring（RUM）

### 3.1 Cloudflare Web Analytics
```html
<!-- app/root.tsx - Web Analytics埋め込み -->
<script defer src='https://static.cloudflareinsights.com/beacon.min.js'
        data-cf-beacon='{"token": "your-analytics-token"}'></script>
```

## 5. Dashboard Design

### 5.1 Cloudflare Dashboard Utilization
```
Cloudflare Dashboard 監視項目:
├── Workers Analytics
│   ├── Request Volume (req/min)
│   ├── Error Rate (%)
│   ├── Response Time (P50, P95, P99)
│   └── Geographic Distribution
├── D1 Analytics  
│   ├── Query Volume
│   ├── Query Duration
│   └── Storage Usage
├── R2 Analytics
│   ├── Request Count
│   ├── Data Transfer
│   └── Storage Usage
└── Security Events
    ├── Access Logs
    ├── WAF Triggers
    └── Rate Limiting
```

## 7. Log Analysis & Monitoring

### 7.1 Structured Log Analysis
```typescript
// ログ分析クエリ
const LOG_ANALYSIS_QUERIES = {
  // エラーパターン分析
  errorPatterns: `
    SELECT 
      error_type,
      COUNT(*) as occurrence_count,
      ARRAY_AGG(DISTINCT error_message LIMIT 5) as sample_messages
    FROM logs 
    WHERE level = 'ERROR' 
      AND timestamp > NOW() - INTERVAL '24' HOUR
    GROUP BY error_type
    ORDER BY occurrence_count DESC
  `,
  
  // パフォーマンス問題検出
  slowQueries: `
    SELECT 
      operation,
      AVG(duration) as avg_duration,
      MAX(duration) as max_duration,
      COUNT(*) as count
    FROM logs 
    WHERE duration > 1000 
      AND timestamp > NOW() - INTERVAL '1' HOUR
    GROUP BY operation
    ORDER BY avg_duration DESC
  `,
  
  // セキュリティイベント
  securityEvents: `
    SELECT 
      event_type,
      user_id,
      ip_address,
      COUNT(*) as attempt_count
    FROM logs 
    WHERE level = 'SECURITY' 
      AND timestamp > NOW() - INTERVAL '1' HOUR
    GROUP BY event_type, user_id, ip_address
    HAVING attempt_count > 5
  `,
};
```

## 12. Related Documents

- [deployment.md](deployment.md) - Deployment Strategy
- [../architecture/infrastructure.md](../architecture/infrastructure.md) - Infrastructure Design
- [../implementation/logging-strategy.md](../implementation/logging-strategy.md) - Detailed Logging Strategy

---

**Last Updated**: 2025-07-02
**Version**: 2.0  
**Status**: Monitoring Strategy Complete  
**Target**: Operations Team & DevOps
