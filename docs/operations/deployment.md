# デプロイ戦略（Infrastructure as Code）

## 1. Infrastructure as Code による環境管理

### 1.1 Terraform によるインフラ管理
Cloudflareリソースの作成・管理はTerraformで行い、アプリケーションコードのデプロイはGitHub Actionsで自動化します。

```
Infrastructure (Terraform)     Application (GitHub Actions)
├── Cloudflare Workers         ├── Code deployment
├── D1 Database               ├── Build & Test
├── R2 Bucket                 ├── Health checks
├── Access policies           └── Rollback
├── DNS settings
└── Environment variables
```

### 1.2 環境構成
```
production   # 本番環境 - your-domain.workers.dev
└── develop  # 開発環境 - dev.your-domain.workers.dev
```

### 1.3 環境別設定
| 環境 | ドメイン | ブランチ | Terraform Workspace | 目的 |
|------|----------|----------|-------------------|------|
| **production** | your-domain.workers.dev | main | production | 本番運用 |
| **dev** | dev.your-domain.workers.dev | develop | development | 開発・テスト |

## 2. Terraform インフラ設定

### 2.1 Terraform ディレクトリ構成
```
terraform/
├── main.tf                 # プロバイダー設定
├── variables.tf            # 入力変数定義
├── outputs.tf              # 出力値定義
├── versions.tf             # Terraform/プロバイダーバージョン
├── environments/
│   ├── development/
│   │   ├── main.tf         # 開発環境設定
│   │   ├── terraform.tfvars # 開発環境変数
│   │   └── backend.tf      # 開発環境state管理
│   └── production/
│       ├── main.tf         # 本番環境設定
│       ├── terraform.tfvars # 本番環境変数
│       └── backend.tf      # 本番環境state管理
├── modules/
│   ├── cloudflare-workers/
│   │   ├── main.tf         # Workers設定
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── cloudflare-d1/
│   │   ├── main.tf         # D1データベース設定
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── cloudflare-r2/
│       ├── main.tf         # R2バケット設定
│       ├── variables.tf
│       └── outputs.tf
└── scripts/
    ├── deploy-infrastructure.sh
    └── destroy-infrastructure.sh
```

### 2.2 メインTerraform設定
```hcl
# terraform/main.tf
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# terraform/variables.tf
variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "zone_id" {
  description = "Cloudflare Zone ID for custom domain"
  type        = string
  default     = ""
}

variable "environment" {
  description = "Environment name (development/production)"
  type        = string
  validation {
    condition     = contains(["development", "production"], var.environment)
    error_message = "Environment must be 'development' or 'production'."
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "cms"
}
```

### 2.3 Workers モジュール
```hcl
# terraform/modules/cloudflare-workers/main.tf
resource "cloudflare_workers_script" "cms_app" {
  account_id = var.account_id
  name       = "${var.project_name}-${var.environment}"
  content    = "export default { fetch() { return new Response('Placeholder'); } }"
  
  # 本番環境でのみカスタムドメイン設定
  dynamic "service_binding" {
    for_each = var.environment == "production" ? [1] : []
    content {
      name        = "WORKER"
      service     = cloudflare_workers_script.cms_app.name
      environment = var.environment
    }
  }
  
  # D1バインディング
  d1_database_binding {
    name        = "DB"
    database_id = var.d1_database_id
  }
  
  # R2バインディング
  r2_bucket_binding {
    name        = "R2_BUCKET"
    bucket_name = var.r2_bucket_name
  }
  
  # 環境変数
  plain_text_binding {
    name = "NODE_ENV"
    text = var.environment == "production" ? "production" : "development"
  }
  
  plain_text_binding {
    name = "SITE_URL"
    text = var.site_url
  }
  
  # シークレット変数（別途wranglerで設定）
  secret_text_binding {
    name = "JWT_SECRET"
    text = var.jwt_secret
  }
}

# カスタムドメイン（本番環境のみ）
resource "cloudflare_workers_domain" "cms_domain" {
  count      = var.environment == "production" && var.custom_domain != "" ? 1 : 0
  account_id = var.account_id
  hostname   = var.custom_domain
  service    = cloudflare_workers_script.cms_app.name
  zone_id    = var.zone_id
}

# terraform/modules/cloudflare-workers/variables.tf
variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "d1_database_id" {
  description = "D1 Database ID"
  type        = string
}

variable "r2_bucket_name" {
  description = "R2 Bucket name"
  type        = string
}

variable "site_url" {
  description = "Site URL"
  type        = string
}

variable "jwt_secret" {
  description = "JWT Secret"
  type        = string
  sensitive   = true
}

variable "custom_domain" {
  description = "Custom domain for production"
  type        = string
  default     = ""
}

variable "zone_id" {
  description = "Cloudflare Zone ID"
  type        = string
  default     = ""
}
```

### 2.4 D1データベースモジュール
```hcl
# terraform/modules/cloudflare-d1/main.tf
resource "cloudflare_d1_database" "cms_db" {
  account_id = var.account_id
  name       = "${var.project_name}-db-${var.environment}"
}

# terraform/modules/cloudflare-d1/outputs.tf
output "database_id" {
  description = "D1 Database ID"
  value       = cloudflare_d1_database.cms_db.id
}

output "database_name" {
  description = "D1 Database Name"
  value       = cloudflare_d1_database.cms_db.name
}
```

### 2.5 R2ストレージモジュール
```hcl
# terraform/modules/cloudflare-r2/main.tf
resource "cloudflare_r2_bucket" "cms_media" {
  account_id = var.account_id
  name       = "${var.project_name}-media-${var.environment}"
  location   = var.location
}

# CORS設定
resource "cloudflare_r2_bucket" "cms_media_cors" {
  count      = 1
  account_id = var.account_id
  name       = cloudflare_r2_bucket.cms_media.name
  location   = var.location
}

# terraform/modules/cloudflare-r2/variables.tf
variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "location" {
  description = "R2 bucket location"
  type        = string
  default     = "auto"
}
```

### 2.6 環境別設定例
```hcl
# terraform/environments/production/main.tf
module "d1_database" {
  source = "../../modules/cloudflare-d1"
  
  account_id   = var.account_id
  project_name = var.project_name
  environment  = "production"
}

module "r2_bucket" {
  source = "../../modules/cloudflare-r2"
  
  account_id   = var.account_id
  project_name = var.project_name
  environment  = "production"
}

module "workers_app" {
  source = "../../modules/cloudflare-workers"
  
  account_id     = var.account_id
  project_name   = var.project_name
  environment    = "production"
  d1_database_id = module.d1_database.database_id
  r2_bucket_name = module.r2_bucket.bucket_name
  site_url       = "https://${var.custom_domain}"
  jwt_secret     = var.jwt_secret
  custom_domain  = var.custom_domain
  zone_id        = var.zone_id
}

# terraform/environments/production/terraform.tfvars
project_name    = "cms"
custom_domain   = "yourdomain.com"
# account_id, zone_id, jwt_secret等は環境変数で設定
```

## 3. 自動デプロイ（CI/CD）

### 3.1 GitHub Actions設定（Terraform統合版）
```yaml
# .github/workflows/deploy.yml
name: Deploy CMS

on:
  push:
    branches: 
      - main        # Production deployment
      - develop     # Dev environment deployment
    paths-ignore:
      - 'terraform/**' # Terraformの変更は別ワークフローで処理
  pull_request:
    branches: 
      - main        # PR validation for production
      - develop     # PR validation for dev
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deploy to environment'
        required: true
        default: 'dev'
        type: choice
        options:
          - dev
          - production
      branch:
        description: 'Branch to deploy (dev environment only)'
        required: false
        default: 'develop'
        type: string

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

  deploy-dev:
    needs: test
    runs-on: ubuntu-latest
    if: |
      github.ref == 'refs/heads/develop' ||
      (github.event_name == 'workflow_dispatch' && github.event.inputs.environment == 'dev')
    environment: dev
    
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event_name == 'workflow_dispatch' && github.event.inputs.branch || github.ref }}
      
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
      
      - name: Build
        run: bun run build
      
      - name: Deploy to Dev
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: 'dev'
          wranglerVersion: '3.0.0'
      
      - name: Health check
        run: |
          sleep 30
          curl -f https://dev.your-domain.workers.dev/health || exit 1
      
      - name: Deployment info
        run: |
          echo "Deployed branch: ${{ github.event_name == 'workflow_dispatch' && github.event.inputs.branch || github.ref_name }}"
          echo "Environment: dev"
          echo "Trigger: ${{ github.event_name }}"

  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: |
      github.ref == 'refs/heads/main' ||
      (github.event_name == 'workflow_dispatch' && github.event.inputs.environment == 'production')
    environment: production
    
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event_name == 'workflow_dispatch' && 'main' || github.ref }}
      
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
      
      - name: Deployment info
        run: |
          echo "Deployed branch: main"
          echo "Environment: production"
          echo "Trigger: ${{ github.event_name }}"
```

### 3.2 Terraform管理専用ワークフロー
```yaml
# .github/workflows/terraform.yml
name: Terraform Infrastructure

on:
  push:
    branches: 
      - main
      - develop
    paths:
      - 'terraform/**'
  pull_request:
    branches:
      - main
      - develop
    paths:
      - 'terraform/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'development'
        type: choice
        options:
          - development
          - production
      action:
        description: 'Terraform action'
        required: true
        default: 'plan'
        type: choice
        options:
          - plan
          - apply
          - destroy

jobs:
  terraform-plan:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [development, production]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.6.0"
      
      - name: Terraform Init
        run: |
          cd terraform/environments/${{ matrix.environment }}
          terraform init
        env:
          TF_VAR_cloudflare_api_token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          TF_VAR_account_id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          TF_VAR_zone_id: ${{ secrets.CLOUDFLARE_ZONE_ID }}
      
      - name: Terraform Plan
        run: |
          cd terraform/environments/${{ matrix.environment }}
          terraform plan -out=tfplan
        env:
          TF_VAR_cloudflare_api_token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          TF_VAR_account_id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          TF_VAR_zone_id: ${{ secrets.CLOUDFLARE_ZONE_ID }}
          TF_VAR_jwt_secret: ${{ secrets.JWT_SECRET }}
      
      - name: Upload Plan
        uses: actions/upload-artifact@v4
        with:
          name: tfplan-${{ matrix.environment }}
          path: terraform/environments/${{ matrix.environment }}/tfplan

  terraform-apply:
    needs: terraform-plan
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: terraform-production
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.6.0"
      
      - name: Download Plan
        uses: actions/download-artifact@v4
        with:
          name: tfplan-production
          path: terraform/environments/production/
      
      - name: Terraform Init
        run: |
          cd terraform/environments/production
          terraform init
        env:
          TF_VAR_cloudflare_api_token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          TF_VAR_account_id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          TF_VAR_zone_id: ${{ secrets.CLOUDFLARE_ZONE_ID }}
      
      - name: Terraform Apply
        run: |
          cd terraform/environments/production
          terraform apply tfplan
        env:
          TF_VAR_cloudflare_api_token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          TF_VAR_account_id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          TF_VAR_zone_id: ${{ secrets.CLOUDFLARE_ZONE_ID }}
          TF_VAR_jwt_secret: ${{ secrets.JWT_SECRET }}
```

## 4. Terraform運用手順

### 4.1 初回セットアップ
```bash
# 1. Terraformプロジェクト作成
mkdir terraform && cd terraform

# 2. 開発環境のインフラ作成
cd environments/development
terraform init
terraform plan
terraform apply

# 3. 本番環境のインフラ作成
cd ../production
terraform init
terraform plan
terraform apply
```

### 4.2 日常運用
```bash
# インフラ変更の検証
cd terraform/environments/development
terraform plan

# 変更適用
terraform apply

# 状態確認
terraform show
terraform output
```

### 4.3 Terraform State管理
```hcl
# terraform/environments/production/backend.tf
terraform {
  backend "s3" {
    bucket                      = "terraform-state-cms-prod"
    key                         = "terraform.tfstate"
    region                      = "auto"
    endpoint                    = "https://account-id.r2.cloudflarestorage.com"
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
  }
}
```

### 4.4 wrangler.toml の自動生成
```bash
# terraform/scripts/generate-wrangler-config.sh
#!/bin/bash

ENVIRONMENT=$1
cd "terraform/environments/${ENVIRONMENT}"

# Terraform出力から設定値を取得
DB_ID=$(terraform output -raw database_id)
BUCKET_NAME=$(terraform output -raw bucket_name)
WORKER_NAME=$(terraform output -raw worker_name)

# wrangler.toml を自動生成
cat > "../../../wrangler.${ENVIRONMENT}.toml" <<EOF
name = "${WORKER_NAME}"
compatibility_date = "2024-12-01"

[env.${ENVIRONMENT}]
[[env.${ENVIRONMENT}.d1_databases]]
binding = "DB"
database_id = "${DB_ID}"

[[env.${ENVIRONMENT}.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "${BUCKET_NAME}"
EOF

echo "Generated wrangler.${ENVIRONMENT}.toml"
```

## 5. GitHub Environmentsとデプロイ承認フロー

### 5.1 GitHub Environments設定
```yaml
# GitHubリポジトリのSettings > Environmentsで設定

# dev環境
dev:
  deployment_branch_policy:
    protected_branches: false
    custom_branch_policies: true
    custom_branches: ["develop"]
  environment_variables:
    - NODE_ENV: "development"
    - SITE_URL: "https://dev.your-domain.workers.dev"
  secrets:
    - CLOUDFLARE_API_TOKEN: "<dev-environment-token>"

# production環境
production:
  protection_rules:
    - type: required_reviewers
      required_reviewers:
        - admin-user
    - type: wait_timer
      wait_timer: 5 # 5分待機
  deployment_branch_policy:
    protected_branches: true
    custom_branch_policies: false
  environment_variables:
    - NODE_ENV: "production"
    - SITE_URL: "https://your-domain.workers.dev"
  secrets:
    - CLOUDFLARE_API_TOKEN: "<production-token>"

# terraform-production環境（インフラ管理用）
terraform-production:
  protection_rules:
    - type: required_reviewers
      required_reviewers:
        - infra-admin
    - type: wait_timer
      wait_timer: 10 # 10分待機
  deployment_branch_policy:
    protected_branches: true
    custom_branch_policies: false
  secrets:
    - CLOUDFLARE_API_TOKEN: "<terraform-token>"
    - CLOUDFLARE_ACCOUNT_ID: "<account-id>"
    - CLOUDFLARE_ZONE_ID: "<zone-id>"
    - JWT_SECRET: "<jwt-secret>"
```

### 5.2 Secrets管理ベストプラクティス
```bash
# 1. 環境別のCloudflare API Token作成
# - dev環境用: 限定された権限、devリソースのみ
# - production環境用: 本番リソースのみ
# - terraform用: インフラ管理権限

# 2. 最小権限の原則
# Application Deploy:
# - Workers: Edit
# - D1: Read (データベースへの書き込みはアプリから)

# Terraform:
# - Workers: Edit
# - D1: Edit (データベース作成・設定)
# - R2: Edit (バケット作成・設定)
# - Zone: Edit (DNS設定)
# - Account: Read

# 3. 環境別シークレット分離
# GitHubリポジトリ > Settings > Secrets and variables > Actions
# - Repository secrets: 共通設定（少なめに）
# - Environment secrets: 環境固有設定（推奨）
```

## 6. マニュアルデプロイ

### 6.1 GitHub Actions手動デプロイ

#### アプリケーションデプロイ
```bash
# GitHub CLI使用
# dev環境に任意のブランチをデプロイ
gh workflow run deploy.yml -f environment=dev -f branch=feature/new-feature

# dev環境にdevelopブランチをデプロイ（デフォルト）
gh workflow run deploy.yml -f environment=dev

# production環境にmainブランチをデプロイ
gh workflow run deploy.yml -f environment=production
```

#### インフラ管理（Terraform）
```bash
# Terraform plan実行
gh workflow run terraform.yml -f environment=development -f action=plan

# Terraform apply実行（開発環境）
gh workflow run terraform.yml -f environment=development -f action=apply

# Terraform apply実行（本番環境）- 承認が必要
gh workflow run terraform.yml -f environment=production -f action=apply
```

**注意**: 
- アプリケーション: dev環境では任意のブランチ指定可能、production環境では常にmainブランチ
- インフラ: Terraform変更は承認フローあり
- GitHub Web UIからも「Actions」タブで実行可能

### 6.2 ローカルからの直接デプロイ

#### アプリケーションデプロイ
```bash
# 開発環境
wrangler deploy --env dev

# 本番環境
wrangler deploy --env production

# カスタム設定での実行
wrangler deploy --config wrangler.production.toml
```

#### インフラ管理（Terraform）
```bash
# 開発環境のインフラ変更
cd terraform/environments/development
terraform plan
terraform apply

# 本番環境のインフラ変更（要注意）
cd terraform/environments/production
terraform plan
# ← 必ず plan を確認してから apply
terraform apply
```

### 6.3 デプロイ前チェックリスト

#### アプリケーションデプロイ前
```bash
# 1. テスト実行
bun test

# 2. 型チェック
bun run typecheck

# 3. ビルド確認
bun run build

# 4. 設定確認
wrangler whoami

# 5. マイグレーション確認 (必要に応じて)
wrangler d1 migrations list cms-db --env production
```

#### インフラ変更前（Terraform）
```bash
# 1. Terraform設定検証
cd terraform/environments/production
terraform validate

# 2. 変更内容確認
terraform plan

# 3. State状態確認
terraform show

# 4. リソース依存関係確認
terraform graph | dot -Tpng > graph.png

# 5. バックアップ作成
terraform state pull > backup-$(date +%Y%m%d).tfstate
```

### 6.4 ロールバック手順

#### アプリケーションロールバック
```bash
# デプロイ履歴確認
wrangler deployments list

# 特定バージョンにロールバック
wrangler rollback [DEPLOYMENT_ID]

# 緊急時の強制ロールバック
wrangler rollback --force [DEPLOYMENT_ID]
```

#### インフラロールバック（Terraform）
```bash
# 1. 前回のStateから復元
cd terraform/environments/production
terraform state push backup-YYYYMMDD.tfstate

# 2. 特定のリソースのみ元に戻す
terraform import cloudflare_workers_script.cms_app [SCRIPT_NAME]

# 3. 手動でリソース削除（最終手段）
terraform destroy -target=cloudflare_workers_script.cms_app
terraform apply # 再作成
```

## 7. データベースマイグレーション

### 7.1 マイグレーション戦略
```
Development → Production
     ↓           ↓
  Auto apply  Manual apply
```

**Terraformとの関係**:
- データベース作成: Terraform管理
- スキーマ変更: Prismaマイグレーション
- データ投入: アプリケーション起動時 or 手動実行

### 7.2 マイグレーション実行
```bash
# 開発環境（自動）
bun run db:migrate

# 本番環境（手動実行）
# 1. Terraformで作成されたDB IDを確認
cd terraform/environments/production
terraform output database_id

# 2. マイグレーション実行
wrangler d1 migrations list cms-db --env production
wrangler d1 migrations apply cms-db --env production --dry-run  # 事前確認
wrangler d1 migrations apply cms-db --env production
```

### 7.3 マイグレーション失敗時対策
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

## 8. 環境変数・シークレット管理

### 8.1 Terraform vs Wrangler での管理
```
Terraform管理:                  Wrangler管理:
├── 平文の環境変数               ├── シークレット（暗号化）
├── リソースバインディング        ├── 機密性の高い設定値
└── インフラレベルの設定         └── アプリケーション固有の設定
```

### 8.2 Cloudflare環境変数設定
```bash
# シークレット設定（Wrangler）
wrangler secret put JWT_SECRET --env production
wrangler secret put DATABASE_URL --env production

# シークレット一覧確認
wrangler secret list --env production

# シークレット削除
wrangler secret delete OLD_SECRET --env production
```

### 8.3 wrangler.toml設定（Terraform自動生成版）
```toml
# wrangler.production.toml (Terraformから自動生成)
name = "cms-prod"
compatibility_date = "2024-12-01"

[env.production]
# Terraformから自動設定される値
[[env.production.d1_databases]]
binding = "DB"
database_id = "12345678-1234-1234-1234-123456789abc"  # Terraform output

[[env.production.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "cms-media-prod"  # Terraform output

# 平文の環境変数（Terraformで設定）
vars = { 
  NODE_ENV = "production",
  SITE_URL = "https://your-domain.workers.dev"
}
```

**注意**: 
- `wrangler.toml`はTerraform出力から自動生成される
- 手動編集は避け、Terraformで管理する
- シークレットのみwranglerで設定

## 9. カスタムドメイン設定（Terraform管理）

### 9.1 ドメイン設定手順（Terraform版）
```hcl
# terraform/environments/production/terraform.tfvars
custom_domain = "yourdomain.com"
zone_id       = "zone-id-from-cloudflare"

# terraform apply実行でカスタムドメイン自動設定
```

**手順**:
1. Cloudflare Dashboard でドメイン登録
2. Zone IDを`terraform.tfvars`に設定
3. `terraform apply`でDNS設定自動化
4. SSL証明書は自動で設定される

### 9.2 DNS設定（Terraform管理）
```hcl
# terraform/modules/cloudflare-dns/main.tf
resource "cloudflare_record" "root" {
  zone_id = var.zone_id
  name    = var.domain
  value   = "your-worker.your-subdomain.workers.dev"
  type    = "CNAME"
  proxied = true
}

resource "cloudflare_record" "www" {
  zone_id = var.zone_id
  name    = "www"
  value   = var.domain
  type    = "CNAME"
  proxied = true
}
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

## 12. Terraformのメリット・デメリット

### 12.1 メリット
- **再現性**: インフラの状態を宣言的に管理
- **バージョン管理**: インフラの変更履歴をGitで管理
- **チーム開発**: 複数人でのインフラ構築・管理が容易
- **ドリフト検出**: 手動変更を検出・修正可能
- **プレビュー**: 変更前に影響範囲を確認可能

### 12.2 デメリット・注意点
- **学習コスト**: Terraform HCLの習得が必要
- **State管理**: terraform.tfstateファイルの適切な管理が重要
- **初期構築**: 最初のセットアップに時間がかかる
- **プロバイダー依存**: Cloudflareプロバイダーの制約やバグの影響

### 12.3 導入判断基準
```
個人開発（小規模）        チーム開発（中・大規模）
├── 手動設定でも可         ├── Terraform推奨
├── 学習コスト重視         ├── 再現性・保守性重視
└── シンプル優先          └── スケーラビリティ優先
```

## 13. Related Documents

- [monitoring.md](monitoring.md) - Monitoring & Metrics Details
- [../architecture/infrastructure.md](../architecture/infrastructure.md) - Infrastructure Technology Selection & Design Philosophy
- [../implementation/development-guide.md](../implementation/development-guide.md) - Development Guide

## 14. 参考リンク

- [Terraform Cloudflare Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

---

**Last Updated**: 2025-07-02
**Version**: 2.0  
**Status**: Terraform Integrated Deployment Strategy Complete  
**対象**: DevOps・運用チーム（Infrastructure as Code 対応版）
