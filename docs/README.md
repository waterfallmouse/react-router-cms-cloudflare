# CMS プロジェクトドキュメント

## 📋 ドキュメント構成

このプロジェクトのドキュメントは以下の構成で整理されています：

### 🏗️ Architecture - アーキテクチャ設計

| ドキュメント | 内容 | 読む順序 |
|-------------|------|----------|
| [overview.md](architecture/overview.md) | **プロジェクト全体概要** - 技術スタック、機能要件、システム設計 | 📖 **1番目** |
| [domain-design.md](architecture/domain-design.md) | **ドメインモデル設計** - DDD実装、エンティティ、値オブジェクト | 📖 **2番目** |
| [application-layer.md](architecture/application-layer.md) | **アプリケーション層設計** - UseCase、DTO、トランザクション | 📖 **3番目** |
| [infrastructure.md](architecture/infrastructure.md) | **インフラ・技術選定** - データベース、ストレージ、デプロイ | 📖 **4番目** |

### 🛠️ Implementation - 実装ガイド

| ドキュメント | 内容 | 対象者 |
|-------------|------|--------|
| [development-guide.md](implementation/development-guide.md) | **開発の進め方** - コマンド、環境構築、コーディング規約 | 👨‍💻 **開発者全員** |
| [dependency-injection.md](implementation/dependency-injection.md) | **DI戦略** - コンテナ設計、Decorator実装 | 👨‍💻 **アーキテクト** |
| [testing-strategy.md](implementation/testing-strategy.md) | **テスト戦略** - DORA準拠、テストピラミッド | 👨‍💻 **開発者全員** |
| [logging-strategy.md](implementation/logging-strategy.md) | **ログ戦略** - 構造化ログ、トレーシング | 👨‍💻 **開発者・運用** |

### 🚀 Operations - 運用・デプロイ

| ドキュメント | 内容 | 対象者 |
|-------------|------|--------|
| [deployment.md](operations/deployment.md) | **デプロイ戦略** - CI/CD、環境管理 | 🔧 **DevOps** |
| [monitoring.md](operations/monitoring.md) | **監視・メトリクス** - ダッシュボード、アラート | 🔧 **運用チーム** |

## 🎯 クイックスタート

### 新規参加者向け
1. [overview.md](architecture/overview.md) - プロジェクト全体を理解
2. [development-guide.md](implementation/development-guide.md) - 開発環境セットアップ
3. [domain-design.md](architecture/domain-design.md) - ドメインモデル理解

### 実装者向け
1. [application-layer.md](architecture/application-layer.md) - アプリケーション層実装
2. [dependency-injection.md](implementation/dependency-injection.md) - DI実装
3. [testing-strategy.md](implementation/testing-strategy.md) - テスト実装

### 運用者向け
1. [infrastructure.md](architecture/infrastructure.md) - インフラ理解
2. [deployment.md](operations/deployment.md) - デプロイ手順
3. [monitoring.md](operations/monitoring.md) - 監視設定

## 🔗 関連リソース

- **プロジェクトルート**: [CLAUDE.md](../CLAUDE.md) - Claude Code用プロジェクト実装ガイド
- **実装コード**: `src/` ディレクトリ
- **テストコード**: `tests/` ディレクトリ

## 📝 ドキュメント更新ルール

1. **設計変更時**: 対応するarchitectureドキュメントを更新
2. **実装手順変更時**: implementationドキュメントを更新
3. **運用手順変更時**: operationsドキュメントを更新
4. **重要な変更**: [CLAUDE.md](../CLAUDE.md)も合わせて更新

---

**最終更新**: 2025-06-29  
**ドキュメント構造バージョン**: 2.0