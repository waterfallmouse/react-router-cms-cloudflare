# 監視・メトリクス戦略

## 1. 監視アーキテクチャ概要

### 1.1 監視レイヤー構成
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

### 1.2 メトリクス分類
| カテゴリ | 指標 | 監視ツール | アラート |
|----------|------|------------|----------|
| **可用性** | Uptime, Health Check | UptimeRobot, Pingdom | 即座 |
| **パフォーマンス** | Response Time, Cold Start | Cloudflare Analytics | 5分後 |
| **エラー** | Error Rate, 5xx Status | Workers Analytics | 即座 |
| **ビジネス** | Content Creation, User Activity | Analytics Engine | 日次 |
| **リソース** | CPU, Memory, D1/R2 Usage | Cloudflare Dashboard | 閾値超過時 |

## 2. Cloudflare Analytics活用

### 2.1 Workers Analytics設定
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

### 2.2 カスタムメトリクス定義
```typescript
// src/infrastructure/monitoring/MetricsCollector.ts
export class MetricsCollector {
  constructor(private analyticsEngine: AnalyticsEngineDataset) {}
  
  // ビジネスメトリクス
  async recordContentCreation(contentType: string, userId?: string): Promise<void> {
    this.analyticsEngine.writeDataPoint({
      timestamp: new Date().toISOString(),
      event: 'content_created',
      contentType,
      userId: userId || 'anonymous',
      count: 1,
    });
  }
  
  async recordContentPublished(contentId: string, contentType: string): Promise<void> {
    this.analyticsEngine.writeDataPoint({
      timestamp: new Date().toISOString(),
      event: 'content_published',
      contentId,
      contentType,
      count: 1,
    });
  }
  
  // パフォーマンスメトリクス
  async recordQueryPerformance(queryType: string, duration: number): Promise<void> {
    this.analyticsEngine.writeDataPoint({
      timestamp: new Date().toISOString(),
      event: 'query_performance',
      queryType,
      duration,
      slow: duration > 100 ? 1 : 0, // 100ms超過フラグ
    });
  }
  
  // エラーメトリクス
  async recordError(errorType: string, errorMessage: string, userId?: string): Promise<void> {
    this.analyticsEngine.writeDataPoint({
      timestamp: new Date().toISOString(),
      event: 'error',
      errorType,
      errorMessage: errorMessage.substring(0, 100), // 長さ制限
      userId: userId || 'anonymous',
      count: 1,
    });
  }
}
```

### 2.3 Analytics Engine クエリ例
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

### 3.2 カスタムRUM実装
```typescript
// app/components/PerformanceMonitor.tsx
export function PerformanceMonitor() {
  useEffect(() => {
    // Core Web Vitals監視
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(sendToAnalytics);
      getFID(sendToAnalytics);
      getFCP(sendToAnalytics);
      getLCP(sendToAnalytics);
      getTTFB(sendToAnalytics);
    });
    
    // ページ読み込み時間
    window.addEventListener('load', () => {
      const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      sendToAnalytics({
        name: 'page_load_time',
        value: navTiming.loadEventEnd - navTiming.fetchStart,
        delta: 0,
        id: Math.random().toString(36),
        entries: [],
      });
    });
  }, []);
  
  return null;
}

function sendToAnalytics(metric: any) {
  fetch('/api/analytics/rum', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      timestamp: Date.now(),
      url: window.location.pathname,
    }),
  }).catch(console.error);
}
```

## 4. アラート・通知システム

### 4.1 アラート条件定義
```typescript
// src/infrastructure/monitoring/AlertManager.ts
export interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  duration: number; // 分
  severity: 'critical' | 'warning' | 'info';
  channels: ('email' | 'slack' | 'pagerduty')[];
}

export const ALERT_RULES: AlertRule[] = [
  {
    name: 'High Error Rate',
    condition: 'error_rate > threshold',
    threshold: 5, // 5%
    duration: 5,
    severity: 'critical',
    channels: ['email', 'slack', 'pagerduty'],
  },
  {
    name: 'Slow Response Time',
    condition: 'avg_response_time > threshold',
    threshold: 1000, // 1秒
    duration: 10,
    severity: 'warning',
    channels: ['slack'],
  },
  {
    name: 'High CPU Usage',
    condition: 'cpu_time_exceeded > threshold',
    threshold: 10, // 10回/分
    duration: 5,
    severity: 'warning',
    channels: ['email'],
  },
  {
    name: 'Database Connection Failure',
    condition: 'db_connection_failure > threshold',
    threshold: 1,
    duration: 1,
    severity: 'critical',
    channels: ['email', 'pagerduty'],
  },
];
```

### 4.2 Webhook通知実装
```typescript
// src/infrastructure/monitoring/NotificationService.ts
export class NotificationService {
  async sendAlert(alert: Alert): Promise<void> {
    const promises = alert.channels.map(channel => {
      switch (channel) {
        case 'slack':
          return this.sendSlackNotification(alert);
        case 'email':
          return this.sendEmailNotification(alert);
        case 'pagerduty':
          return this.sendPagerDutyNotification(alert);
      }
    });
    
    await Promise.allSettled(promises);
  }
  
  private async sendSlackNotification(alert: Alert): Promise<void> {
    const webhook = 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK';
    
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 ${alert.severity.toUpperCase()}: ${alert.name}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Alert:* ${alert.name}\n*Severity:* ${alert.severity}\n*Value:* ${alert.value}\n*Threshold:* ${alert.threshold}\n*Time:* ${alert.timestamp}`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View Dashboard' },
                url: 'https://dash.cloudflare.com/your-account/workers',
              },
            ],
          },
        ],
      }),
    });
  }
  
  private async sendEmailNotification(alert: Alert): Promise<void> {
    // Cloudflare Email Workers または外部サービス使用
    // 実装省略
  }
  
  private async sendPagerDutyNotification(alert: Alert): Promise<void> {
    const integrationKey = 'your-pagerduty-integration-key';
    
    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: integrationKey,
        event_action: 'trigger',
        payload: {
          summary: `${alert.name}: ${alert.value} > ${alert.threshold}`,
          severity: alert.severity,
          source: 'cms-api',
          timestamp: alert.timestamp,
        },
      }),
    });
  }
}
```

## 5. ダッシュボード設計

### 5.1 Cloudflare Dashboard活用
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

### 5.2 カスタムダッシュボード（Grafana等）
```typescript
// Analytics API連携でカスタムダッシュボード構築
export class DashboardDataProvider {
  async getMetrics(timeRange: string): Promise<DashboardMetrics> {
    const [
      workerMetrics,
      businessMetrics,
      errorMetrics,
    ] = await Promise.all([
      this.getWorkerMetrics(timeRange),
      this.getBusinessMetrics(timeRange),
      this.getErrorMetrics(timeRange),
    ]);
    
    return {
      summary: {
        totalRequests: workerMetrics.totalRequests,
        errorRate: errorMetrics.errorRate,
        avgResponseTime: workerMetrics.avgResponseTime,
        availability: this.calculateAvailability(errorMetrics),
      },
      charts: {
        requestVolume: workerMetrics.requestVolume,
        responseTime: workerMetrics.responseTime,
        errorDistribution: errorMetrics.distribution,
        contentActivity: businessMetrics.contentActivity,
      },
    };
  }
}
```

## 6. SLA・KPI監視

### 6.1 SLA定義
| 指標 | 目標値 | 測定期間 | 対応レベル |
|------|--------|----------|------------|
| **可用性** | 99.9% | 月次 | Critical |
| **レスポンス時間** | P95 < 500ms | 週次 | Warning |
| **エラー率** | < 1% | 日次 | Critical |
| **MTTR** | < 30分 | インシデント毎 | Target |

### 6.2 KPI監視
```typescript
// KPI計算・監視
export class KPICalculator {
  async calculateSLAMetrics(period: string): Promise<SLAReport> {
    const data = await this.getAnalyticsData(period);
    
    return {
      availability: this.calculateAvailability(data),
      responseTime: {
        p50: this.calculatePercentile(data.responseTimes, 0.5),
        p95: this.calculatePercentile(data.responseTimes, 0.95),
        p99: this.calculatePercentile(data.responseTimes, 0.99),
      },
      errorRate: (data.errorCount / data.totalRequests) * 100,
      mttr: this.calculateMTTR(data.incidents),
    };
  }
  
  private calculateAvailability(data: any): number {
    const uptime = data.totalRequests - data.serverErrors;
    return (uptime / data.totalRequests) * 100;
  }
}
```

## 7. ログ分析・監視

### 7.1 構造化ログ分析
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

### 7.2 ログ異常検知
```typescript
// 異常検知アルゴリズム
export class AnomalyDetector {
  async detectAnomalies(): Promise<Anomaly[]> {
    const recentMetrics = await this.getRecentMetrics();
    const baseline = await this.getBaselineMetrics();
    
    const anomalies: Anomaly[] = [];
    
    // エラー率異常
    if (recentMetrics.errorRate > baseline.errorRate * 2) {
      anomalies.push({
        type: 'error_rate_spike',
        severity: 'high',
        current: recentMetrics.errorRate,
        baseline: baseline.errorRate,
        timestamp: new Date(),
      });
    }
    
    // レスポンス時間異常
    if (recentMetrics.avgResponseTime > baseline.avgResponseTime * 1.5) {
      anomalies.push({
        type: 'response_time_degradation',
        severity: 'medium',
        current: recentMetrics.avgResponseTime,
        baseline: baseline.avgResponseTime,
        timestamp: new Date(),
      });
    }
    
    return anomalies;
  }
}
```

## 8. 外部監視サービス統合

### 8.1 UptimeRobot設定
```bash
# UptimeRobot API設定例
Monitor Settings:
- Type: HTTP(s)
- URL: https://your-domain.workers.dev/health
- Interval: 5 minutes
- Timeout: 30 seconds
- HTTP Method: GET
- Expected Status Code: 200

Alert Contacts:
- Email: admin@yourdomain.com
- Slack: #alerts channel
- SMS: +1234567890 (critical only)
```

### 8.2 Pingdom統合
```javascript
// Pingdom Real User Monitoring
(function() {
    var script = document.createElement('script');
    script.src = 'https://rum-static.pingdom.net/pa-your-id.js';
    script.async = true;
    document.head.appendChild(script);
})();
```

## 9. 監視オートメーション

### 9.1 自動スケーリング監視
```typescript
// Cloudflare Workers は自動スケールするが、
// リソース使用量監視で予測・最適化
export class ResourceMonitor {
  async monitorUsage(): Promise<void> {
    const metrics = await this.getCurrentUsage();
    
    // 使用量予測
    if (metrics.requestTrend.growth > 50) { // 50%増加
      await this.sendAlert({
        type: 'usage_trend',
        message: 'Request volume increasing rapidly',
        data: metrics.requestTrend,
      });
    }
    
    // リソース制限接近警告
    if (metrics.cpuTimeUsage > 80) { // 80%使用
      await this.sendAlert({
        type: 'resource_limit',
        message: 'CPU time usage approaching limit',
        data: metrics.cpuTimeUsage,
      });
    }
  }
}
```

### 9.2 自動復旧機能
```typescript
// 自動復旧スクリプト
export class AutoRecovery {
  async handleCriticalAlert(alert: Alert): Promise<void> {
    switch (alert.type) {
      case 'database_connection_failure':
        await this.restartDatabaseConnection();
        break;
        
      case 'high_error_rate':
        await this.enableMaintenanceMode();
        await this.investigateErrors();
        break;
        
      case 'memory_leak':
        await this.requestWorkerRestart();
        break;
    }
  }
  
  private async restartDatabaseConnection(): Promise<void> {
    // データベース接続プールリセット
    // 実装詳細省略
  }
  
  private async enableMaintenanceMode(): Promise<void> {
    // メンテナンスページ表示
    // KVストアでメンテナンスフラグ設定
  }
}
```

## 10. コスト監視

### 10.1 Cloudflare使用量監視
```typescript
// 使用量監視・予測
export class UsageMonitor {
  async checkUsageLimits(): Promise<UsageReport> {
    const usage = await this.getCurrentUsage();
    const limits = this.getFreeTierLimits();
    
    return {
      workers: {
        requests: usage.workerRequests,
        limit: limits.workerRequests,
        percentage: (usage.workerRequests / limits.workerRequests) * 100,
        warning: usage.workerRequests > limits.workerRequests * 0.8,
      },
      d1: {
        storage: usage.d1Storage,
        limit: limits.d1Storage,
        percentage: (usage.d1Storage / limits.d1Storage) * 100,
        warning: usage.d1Storage > limits.d1Storage * 0.8,
      },
      r2: {
        storage: usage.r2Storage,
        requests: usage.r2Requests,
        limits: { storage: limits.r2Storage, requests: limits.r2Requests },
        warnings: {
          storage: usage.r2Storage > limits.r2Storage * 0.8,
          requests: usage.r2Requests > limits.r2Requests * 0.8,
        },
      },
    };
  }
  
  private getFreeTierLimits() {
    return {
      workerRequests: 100000, // per day
      d1Storage: 25 * 1024 * 1024 * 1024, // 25GB
      r2Storage: 10 * 1024 * 1024 * 1024, // 10GB
      r2Requests: 1000000, // per month
    };
  }
}
```

## 11. レポート・分析

### 11.1 定期レポート自動生成
```typescript
// 週次・月次レポート生成
export class ReportGenerator {
  async generateWeeklyReport(): Promise<WeeklyReport> {
    const data = await this.getWeeklyData();
    
    return {
      summary: {
        totalRequests: data.requestCount,
        avgResponseTime: data.avgResponseTime,
        errorRate: data.errorRate,
        availability: data.availability,
      },
      trends: {
        requestGrowth: this.calculateGrowth(data.requestTrend),
        performanceChange: this.calculatePerformanceChange(data.performanceTrend),
      },
      topPages: data.topPages,
      errors: data.topErrors,
      recommendations: this.generateRecommendations(data),
    };
  }
  
  async sendReport(report: WeeklyReport): Promise<void> {
    // メール/Slack送信
    await this.notificationService.sendReport(report);
  }
}
```

## 12. 関連ドキュメント

- [deployment.md](deployment.md) - デプロイ戦略
- [../architecture/infrastructure.md](../architecture/infrastructure.md) - インフラ設計
- [../implementation/logging-strategy.md](../implementation/logging-strategy.md) - ログ戦略詳細

---

**作成日**: 2025-06-29  
**バージョン**: 1.0  
**ステータス**: 監視戦略完成  
**対象**: 運用チーム・DevOps