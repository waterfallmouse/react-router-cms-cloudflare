# React Router v7 ルーティング設計 (@react-router/fs-routes)

## 1. 設計方針

### 1.1 基本原則

1. **File-based Routing**: `@react-router/fs-routes` パッケージによる自動ルート生成を採用し、ファイル構造がURL構造に直接マッピングされる
2. **Colocation**: 関連するコンポーネント、hooks、utilities を同じディレクトリにまとめる
3. **DDD統合**: ドメイン駆動設計のUse Casesをroute actionsで直接呼び出す
4. **型安全性**: React Router v7の型システムを最大活用
5. **セキュリティファースト**: Middlewareによる認証・認可をroute levelで適用
6. **設定レス**: ファイル命名規則に従うことで、manual route configurationを排除

### 1.2 技術スタック連携

- **Backend**: Cloudflare Workers + React Router v7 SSR
- **Routing**: `@react-router/fs-routes` による自動ルート生成
- **Domain Layer**: DDD Use Cases との直接統合
- **Authentication**: Cloudflare Access + Server-side Middleware
- **Validation**: Zod schemas for route parameters and form data
- **Type Safety**: TypeScript + React Router v7 type generation

## 2. ディレクトリ構造

### 2.1 @react-router/fs-routes フォルダベース構成（推奨）

```
app/
├── routes/                          # ルート定義（自動ルート生成）
│   ├── _index/                      # トップページ (/)
│   │   └── route.tsx
│   │
│   ├── posts/                       # 投稿エリアレイアウト (/posts)
│   │   ├── route.tsx                # レイアウトコンポーネント
│   │   ├── PostCard.tsx             # 投稿関連コンポーネント
│   │   ├── PostList.tsx
│   │   ├── PostMeta.tsx
│   │   └── use-posts.ts             # カスタムフック
│   │
│   ├── posts._index/                # 投稿一覧ページ (/posts)
│   │   ├── route.tsx
│   │   ├── PostListView.tsx
│   │   └── use-post-list.ts
│   │
│   ├── posts.$slug/                 # 個別投稿ページ (/posts/:slug)
│   │   ├── route.tsx
│   │   ├── PostDetailView.tsx
│   │   ├── PostComments.tsx
│   │   └── use-post-detail.ts
│   │
│   ├── pages/                       # ページエリアレイアウト (/pages)
│   │   ├── route.tsx
│   │   └── PageContent.tsx
│   │
│   ├── pages._index/                # ページ一覧 (/pages)
│   │   └── route.tsx
│   │
│   ├── pages.$slug/                 # 個別ページ (/pages/:slug)
│   │   ├── route.tsx
│   │   └── PageDetailView.tsx
│   │
│   ├── api.public.posts/            # 公開API: 投稿一覧 (/api/public/posts)
│   │   ├── route.tsx
│   │   └── posts-serializer.ts
│   │
│   ├── api.public.pages/            # 公開API: ページ一覧 (/api/public/pages)
│   │   └── route.tsx
│   │
│   ├── api.admin.content/           # 管理API: コンテンツ (/api/admin/content)
│   │   ├── route.tsx
│   │   └── content-handlers.ts
│   │
│   ├── api.admin.media/             # 管理API: メディア (/api/admin/media)
│   │   └── route.tsx
│   │
│   ├── admin/                       # 管理エリアレイアウト (/admin)
│   │   ├── route.tsx                # 管理画面共通レイアウト
│   │   ├── AdminShell.tsx           # 管理画面シェル
│   │   ├── AdminNavigation.tsx      # ナビゲーション
│   │   └── use-admin-auth.ts        # 認証フック
│   │
│   ├── admin._index/                # 管理ダッシュボード (/admin)
│   │   ├── route.tsx
│   │   ├── Dashboard.tsx
│   │   ├── StatsCard.tsx
│   │   └── use-dashboard-stats.ts
│   │
│   ├── admin.content/               # コンテンツ管理レイアウト (/admin/content)
│   │   ├── route.tsx
│   │   ├── ContentNavigation.tsx
│   │   └── ContentLayout.tsx
│   │
│   ├── admin.content._index/        # コンテンツ一覧 (/admin/content)
│   │   ├── route.tsx
│   │   ├── ContentTable.tsx
│   │   ├── ContentFilters.tsx
│   │   └── use-content-list.ts
│   │
│   ├── admin.content.new/           # 新規作成 (/admin/content/new)
│   │   ├── route.tsx
│   │   ├── ContentForm.tsx
│   │   ├── ContentEditor.tsx
│   │   ├── use-content-form.ts
│   │   └── validation-schemas.ts
│   │
│   ├── admin.content.$id/           # コンテンツ詳細レイアウト (/admin/content/:id)
│   │   ├── route.tsx
│   │   └── ContentDetailLayout.tsx
│   │
│   ├── admin.content.$id._index/    # コンテンツ詳細 (/admin/content/:id)
│   │   ├── route.tsx
│   │   ├── ContentDetail.tsx
│   │   └── use-content-detail.ts
│   │
│   ├── admin.content.$id.edit/      # 編集 (/admin/content/:id/edit)
│   │   ├── route.tsx
│   │   ├── ContentEditForm.tsx
│   │   └── use-content-edit.ts
│   │
│   ├── admin.media/                 # メディア管理レイアウト (/admin/media)
│   │   ├── route.tsx
│   │   └── MediaLayout.tsx
│   │
│   ├── admin.media._index/          # メディア一覧 (/admin/media)
│   │   ├── route.tsx
│   │   ├── MediaGrid.tsx
│   │   ├── MediaCard.tsx
│   │   └── use-media-list.ts
│   │
│   ├── admin.media.upload/          # アップロード (/admin/media/upload)
│   │   ├── route.tsx
│   │   ├── MediaUploader.tsx
│   │   ├── UploadProgress.tsx
│   │   └── use-media-upload.ts
│   │
│   ├── admin.system/                # システム管理レイアウト (/admin/system)
│   │   ├── route.tsx
│   │   └── SystemLayout.tsx
│   │
│   ├── admin.system._index/         # システム概要 (/admin/system)
│   │   ├── route.tsx
│   │   ├── SystemOverview.tsx
│   │   └── use-system-stats.ts
│   │
│   ├── admin.system.users/          # ユーザー管理 (/admin/system/users)
│   │   ├── route.tsx
│   │   ├── UserTable.tsx
│   │   ├── UserForm.tsx
│   │   └── use-user-management.ts
│   │
│   └── admin.system.settings/       # 設定 (/admin/system/settings)
│       ├── route.tsx
│       ├── SystemSettings.tsx
│       ├── SettingsForm.tsx
│       └── use-settings.ts
│
├── _components/                     # 共通コンポーネント
│   ├── Layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Sidebar.tsx
│   │   └── AdminShell.tsx
│   ├── UI/                         # 汎用UIコンポーネント
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── Toast.tsx
│   └── Forms/                      # フォーム関連
│       ├── FormField.tsx
│       └── ValidationMessage.tsx
│
├── _middleware/                     # 共通Middleware
│   ├── authentication.ts
│   ├── authorization.ts
│   ├── audit-logging.ts
│   └── error-handling.ts
│
├── _hooks/                         # 共通hooks
│   ├── useAuth.ts
│   ├── useToast.ts
│   └── useLocalStorage.ts
│
└── _utils/                         # 共通ユーティリティ
    ├── validation.ts
    ├── formatting.ts
    └── api-client.ts
```

### 2.2 フォルダベース vs ドット記法

#### 推奨：フォルダベース構成
```
routes/
├── _index/
│   └── route.tsx                 → /
├── about/
│   └── route.tsx                 → /about
├── posts/
│   ├── route.tsx                 → /posts (レイアウト)
│   ├── PostCard.tsx              # コロケーション
│   └── use-posts.ts              # カスタムフック
├── posts._index/
│   ├── route.tsx                 → /posts (インデックス)
│   └── PostListView.tsx          # 関連コンポーネント
├── posts.$slug/
│   ├── route.tsx                 → /posts/:slug
│   ├── PostDetailView.tsx
│   └── use-post-detail.ts
├── admin/
│   ├── route.tsx                 → /admin (レイアウト)
│   ├── AdminShell.tsx            # 管理画面共通UI
│   └── use-admin-auth.ts         # 認証フック
├── admin._index/
│   └── route.tsx                 → /admin
├── admin.content/
│   ├── route.tsx                 → /admin/content (レイアウト)
│   └── ContentNavigation.tsx     # コンテンツ管理ナビ
├── admin.content._index/
│   ├── route.tsx                 → /admin/content
│   ├── ContentTable.tsx          # コンテンツテーブル
│   └── use-content-list.ts       # データフェッチフック
├── admin.content.new/
│   ├── route.tsx                 → /admin/content/new
│   ├── ContentForm.tsx           # フォームコンポーネント
│   ├── ContentEditor.tsx         # エディタコンポーネント
│   └── validation-schemas.ts     # バリデーション
├── admin.content.$id/
│   ├── route.tsx                 → /admin/content/:id (レイアウト)
│   └── ContentDetailLayout.tsx   # 詳細画面レイアウト
├── admin.content.$id._index/
│   ├── route.tsx                 → /admin/content/:id
│   └── ContentDetail.tsx         # 詳細表示
└── admin.content.$id.edit/
    ├── route.tsx                 → /admin/content/:id/edit
    ├── ContentEditForm.tsx       # 編集フォーム
    └── use-content-edit.ts       # 編集ロジック
```

#### フォルダベースの利点
1. **コロケーション**: 関連ファイルを同じフォルダにまとめる
2. **視認性**: ファイル名が短く、構造が明確
3. **保守性**: 機能単位での管理が容易
4. **スケーラビリティ**: 大規模プロジェクトでも整理しやすい

#### 代替：ドット記法（シンプルなケース）
```
routes/
├── _index.tsx                    → /
├── about.tsx                     → /about
├── posts.tsx                     → /posts (レイアウト)
├── posts._index.tsx              → /posts
├── posts.$slug.tsx               → /posts/:slug
├── admin.tsx                     → /admin (レイアウト)
├── admin._index.tsx              → /admin
├── admin.content.tsx             → /admin/content (レイアウト)
├── admin.content._index.tsx      → /admin/content
├── admin.content.new.tsx         → /admin/content/new
├── admin.content.$id.tsx         → /admin/content/:id (レイアウト)
├── admin.content.$id._index.tsx  → /admin/content/:id
└── admin.content.$id.edit.tsx    → /admin/content/:id/edit
```

#### 命名規則
- **Route modules**: 各フォルダ内の `route.tsx` がルートモジュール
- **Components**: `ComponentName.tsx` (PascalCase)
- **Hooks**: `use-hook-name.ts` (kebab-case with "use" prefix)
- **Utilities**: `utility-name.ts` (kebab-case)
- **Types**: `types.ts` または `component-name.types.ts`
- **Constants**: `constants.ts`

## 3. Route Configuration

### 3.1 @react-router/fs-routes セットアップ

#### インストール
```bash
npm install @react-router/fs-routes
```

#### 基本設定
```typescript
// app/routes.ts
import { flatRoutes } from "@react-router/fs-routes";
import type { RouteConfig } from "@react-router/dev/routes";

export default flatRoutes() satisfies RouteConfig;
```

#### カスタム設定（オプション）
```typescript
// app/routes.ts
import { flatRoutes } from "@react-router/fs-routes";
import type { RouteConfig } from "@react-router/dev/routes";

export default flatRoutes({
  // ルートディレクトリの指定（デフォルト: "routes"）
  rootDirectory: "routes",
  
  // 無視するファイルパターン
  ignoredRouteFiles: [
    "**/.*",              // 隠しファイル
    "**/*.test.{js,jsx,ts,tsx}",  // テストファイル
    "**/*.spec.{js,jsx,ts,tsx}",  // スペックファイル
    "**/README.md",       // ドキュメントファイル
    "**/_components/**",  // コンポーネントディレクトリ
    "**/_hooks/**",       # フックディレクトリ
    "**/_utils/**"        # ユーティリティディレクトリ
  ]
}) satisfies RouteConfig;
```

### 3.2 自動ルート生成の動作

@react-router/fs-routesは、フォルダ構造またはファイル名に基づいて自動的にルート構造を生成します：

#### フォルダベース構造
```
routes/
├── _index/route.tsx              # / (root index)
├── posts/route.tsx               # /posts (layout)
├── posts._index/route.tsx        # /posts (posts index)  
├── posts.$slug/route.tsx         # /posts/:slug
├── admin/route.tsx               # /admin (layout)
├── admin._index/route.tsx        # /admin (admin index)
├── admin.content/route.tsx       # /admin/content (layout)
├── admin.content._index/route.tsx # /admin/content (content index)
├── admin.content.new/route.tsx   # /admin/content/new
├── admin.content.$id/route.tsx   # /admin/content/:id (layout)
├── admin.content.$id._index/route.tsx # /admin/content/:id (content detail)
├── admin.content.$id.edit/route.tsx # /admin/content/:id/edit
└── api.admin.content/route.tsx   # /api/admin/content (API endpoint)
```

**生成されるルート構造（同じ結果）**:
```
/                           # _index/route.tsx
/posts                      # posts/route.tsx + posts._index/route.tsx
/posts/:slug                # posts.$slug/route.tsx
/admin                      # admin/route.tsx + admin._index/route.tsx
/admin/content              # admin.content/route.tsx + admin.content._index/route.tsx
/admin/content/new          # admin.content.new/route.tsx
/admin/content/:id          # admin.content.$id/route.tsx + admin.content.$id._index/route.tsx
/admin/content/:id/edit     # admin.content.$id.edit/route.tsx
/api/admin/content          # api.admin.content/route.tsx
```

#### フォルダとファイルの等価性
```
posts.tsx               ≡ posts/route.tsx
posts._index.tsx        ≡ posts._index/route.tsx  
posts.$slug.tsx         ≡ posts.$slug/route.tsx
admin.content.new.tsx   ≡ admin.content.new/route.tsx
```
```

## 4. 認証・認可統合

### 4.1 Admin Layout での認証

```typescript
// app/routes/admin/route.tsx
import type { Route } from "./+types/route";
import { Outlet } from "react-router";
import { redirect } from "react-router";
import { authenticationMiddleware, auditLoggingMiddleware } from "~/middleware";
import { AdminShell } from "./AdminShell";

// Server-side middleware: 全admin/* routesで認証必須
export const unstable_middleware = [
  authenticationMiddleware,
  auditLoggingMiddleware
];

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get('user');
  
  if (!user) {
    const url = new URL(request.url);
    throw redirect(`/admin/login?redirect=${encodeURIComponent(url.pathname)}`);
  }
  
  return { 
    user: {
      id: user.getId().getValue(),
      name: user.getName().getValue(),
      email: user.getEmail().getValue(),
      role: user.getRole().getName()
    }
  };
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  return (
    <AdminShell user={loaderData.user}>
      <Outlet />
    </AdminShell>
  );
}
```

```typescript
// app/routes/admin/AdminShell.tsx
import { ReactNode } from "react";
import { AdminNavigation } from "./AdminNavigation";
import { useAdminAuth } from "./use-admin-auth";

interface AdminShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  children: ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  return (
    <div className="admin-shell">
      <AdminNavigation user={user} />
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
```

### 4.2 機能別権限制御

```typescript
// app/routes/admin.content.new/route.tsx
import type { Route } from "./+types/route";
import { redirect } from "react-router";
import { requirePermission } from "~/middleware/authorization";
import { Permission } from "~/domain/auth/valueObjects/Permission";
import { CreateContentUseCase } from "~/application/use-cases/CreateContentUseCase";
import { CreateContentRequestSchema } from "~/application/dto/CreateContentRequest";
import { container } from "~/infrastructure/di/container";
import { ContentForm } from "./ContentForm";

// Content作成権限必須
export const unstable_middleware = [
  requirePermission(Permission.CONTENT_CREATE)
];

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get('user');
  const formData = await request.formData();
  
  // Zodバリデーション
  const createRequest = CreateContentRequestSchema.parse({
    title: formData.get('title'),
    body: formData.get('body'),
    contentTypeId: formData.get('contentTypeId'),
    authorId: user.getId().getValue()
  });
  
  // DDD Use Case実行
  const useCase = container.resolve(CreateContentUseCase);
  const result = await useCase.execute(createRequest);
  
  return redirect(`/admin/content/${result.id}`);
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get('user');
  
  // Content types取得など
  const getContentTypesUseCase = container.resolve(GetContentTypesUseCase);
  const contentTypes = await getContentTypesUseCase.execute();
  
  return { 
    user: {
      name: user.getName().getValue(),
      email: user.getEmail().getValue()
    },
    contentTypes
  };
}

export default function NewContent({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <ContentForm 
      contentTypes={loaderData.contentTypes}
      user={loaderData.user}
      errors={actionData?.errors}
    />
  );
}
```

```typescript
// app/routes/admin.content.new/ContentForm.tsx
import { Form } from "react-router";
import { ContentEditor } from "./ContentEditor";
import { useContentForm } from "./use-content-form";

interface ContentFormProps {
  contentTypes: Array<{id: string; name: string}>;
  user: {name: string; email: string};
  errors?: Record<string, string[]>;
}

export function ContentForm({ contentTypes, user, errors }: ContentFormProps) {
  const { formState, handleInputChange } = useContentForm();
  
  return (
    <Form method="post" className="content-form">
      <div className="form-field">
        <label htmlFor="title">タイトル</label>
        <input 
          id="title" 
          name="title" 
          value={formState.title}
          onChange={handleInputChange}
          aria-invalid={errors?.title ? "true" : "false"}
        />
        {errors?.title && <span className="error">{errors.title[0]}</span>}
      </div>
      
      <div className="form-field">
        <label htmlFor="contentTypeId">コンテンツタイプ</label>
        <select id="contentTypeId" name="contentTypeId">
          {contentTypes.map(type => (
            <option key={type.id} value={type.id}>{type.name}</option>
          ))}
        </select>
      </div>
      
      <ContentEditor 
        name="body"
        value={formState.body}
        onChange={handleInputChange}
        error={errors?.body?.[0]}
      />
      
      <button type="submit">作成</button>
    </Form>
  );
}
```

## 5. API Routes 設計

### 5.1 公開API

```typescript
// app/routes/api.public.posts/route.tsx
import type { Route } from "./+types/route";
import { GetPublishedContentListUseCase } from "~/application/use-cases/GetPublishedContentListUseCase";
import { container } from "~/infrastructure/di/container";
import { serializePosts } from "./posts-serializer";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  
  const useCase = container.resolve(GetPublishedContentListUseCase);
  const result = await useCase.execute({ page, limit });
  
  return Response.json(serializePosts(result), {
    headers: {
      'Cache-Control': 'public, max-age=300' // 5分キャッシュ
    }
  });
}
```

```typescript
// app/routes/api.public.posts/posts-serializer.ts
import { PublishedContent } from "~/domain/cms/entities/Content";

export function serializePosts(posts: PublishedContent[]) {
  return posts.map(post => ({
    id: post.getId().getValue(),
    title: post.getTitle().getValue(),
    slug: post.getSlug().getValue(),
    excerpt: post.getExcerpt(),
    publishedAt: post.getPublishedAt()?.toISOString(),
    author: {
      name: post.getAuthor().getName().getValue()
    }
  }));
}
```

### 5.2 管理API

```typescript
// app/routes/api.admin.content/route.tsx
import type { Route } from "./+types/route";
import { requirePermission } from "~/middleware/authorization";
import { Permission } from "~/domain/auth/valueObjects/Permission";
import { 
  handleGetContent, 
  handleCreateContent, 
  handleUpdateContent, 
  handleDeleteContent 
} from "./content-handlers";

export const unstable_middleware = [
  requirePermission(Permission.CONTENT_MANAGE)
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const method = request.method;
  
  switch (method) {
    case 'GET':
      return handleGetContent(request, context);
    case 'POST':
      return handleCreateContent(request, context);
    case 'PUT':
      return handleUpdateContent(request, context);
    case 'DELETE':
      return handleDeleteContent(request, context);
    default:
      return new Response('Method not allowed', { status: 405 });
  }
}

// Alias for all HTTP methods
export { loader as action };
```

```typescript
// app/routes/api.admin.content/content-handlers.ts
import { container } from "~/infrastructure/di/container";
import { GetContentListUseCase } from "~/application/use-cases/GetContentListUseCase";
import { CreateContentUseCase } from "~/application/use-cases/CreateContentUseCase";
import { UpdateContentUseCase } from "~/application/use-cases/UpdateContentUseCase";
import { DeleteContentUseCase } from "~/application/use-cases/DeleteContentUseCase";

export async function handleGetContent(request: Request, context: any) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const search = url.searchParams.get('search') || '';
  
  const useCase = container.resolve(GetContentListUseCase);
  const result = await useCase.execute({ page, search, limit: 20 });
  
  return Response.json(result);
}

export async function handleCreateContent(request: Request, context: any) {
  const data = await request.json();
  const user = context.get('user');
  
  const useCase = container.resolve(CreateContentUseCase);
  const result = await useCase.execute({
    ...data,
    authorId: user.getId().getValue()
  });
  
  return Response.json(result, { status: 201 });
}

export async function handleUpdateContent(request: Request, context: any) {
  const data = await request.json();
  const user = context.get('user');
  
  const useCase = container.resolve(UpdateContentUseCase);
  const result = await useCase.execute({
    ...data,
    updatedBy: user.getId().getValue()
  });
  
  return Response.json(result);
}

export async function handleDeleteContent(request: Request, context: any) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  
  if (!id) {
    return new Response('Content ID required', { status: 400 });
  }
  
  const useCase = container.resolve(DeleteContentUseCase);
  await useCase.execute({ id });
  
  return new Response(null, { status: 204 });
}
```

## 6. 型安全性の確保

### 6.1 Route Parameter Validation

```typescript
// app/routes/posts.$slug.tsx
import type { Route } from "./+types/posts.$slug";
import { GetContentDetailUseCase } from "~/application/use-cases/GetContentDetailUseCase";
import { ContentSlugSchema } from "~/domain/cms/schemas/ValidationSchemas";
import { container } from "~/infrastructure/di/container";

export async function loader({ params }: Route.LoaderArgs) {
  // Route parameterの型安全バリデーション
  const validatedParams = ContentSlugSchema.parse(params);
  
  const useCase = container.resolve(GetContentDetailUseCase);
  const content = await useCase.execute({ 
    slug: validatedParams.slug 
  });
  
  if (!content) {
    throw new Response("Not Found", { status: 404 });
  }
  
  return { content };
}

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data.content.title} | My Blog` },
    { name: "description", content: data.content.excerpt },
    { property: "og:title", content: data.content.title },
    { property: "og:description", content: data.content.excerpt }
  ];
}

export default function PostDetail({ loaderData }: Route.ComponentProps) {
  return <PostDetailView content={loaderData.content} />;
}
```

### 6.2 Form Action Validation

```typescript
// app/routes/admin.content.$id.edit.tsx
import type { Route } from "./+types/admin.content.$id.edit";
import { UpdateContentRequestSchema } from "~/application/dto/UpdateContentRequest";
import { UpdateContentUseCase } from "~/application/use-cases/UpdateContentUseCase";
import { container } from "~/infrastructure/di/container";
import { z } from "zod";

export async function action({ request, params, context }: Route.ActionArgs) {
  const user = context.get('user');
  const formData = await request.formData();
  
  try {
    // Form dataとparametersの両方をバリデーション
    const updateRequest = UpdateContentRequestSchema.parse({
      id: params.id,
      title: formData.get('title'),
      body: formData.get('body'),
      status: formData.get('status'),
      updatedBy: user.getId().getValue()
    });
    
    const useCase = container.resolve(UpdateContentUseCase);
    const result = await useCase.execute(updateRequest);
    
    return { success: true, content: result };
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.flatten().fieldErrors 
      };
    }
    
    throw error;
  }
}
```

## 7. Performance 最適化

### 7.1 Code Splitting by Route

```typescript
// app/routes/admin.content.tsx
import { Suspense } from "react";
import { Outlet } from "react-router";
import { ContentNavigationSkeleton } from "~/_components/UI/Skeletons";

export default function ContentLayout() {
  return (
    <div className="content-management-layout">
      <ContentNavigation />
      <main className="content-main">
        <Suspense fallback={<ContentNavigationSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
```

### 7.2 Data Loading Optimization

```typescript
// app/routes/admin.content._index.tsx
import type { Route } from "./+types/admin.content._index";
import { GetContentListUseCase } from "~/application/use-cases/GetContentListUseCase";
import { GetContentTypesUseCase } from "~/application/use-cases/GetContentTypesUseCase";
import { container } from "~/infrastructure/di/container";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const search = url.searchParams.get('search') || '';
  
  // Use Caseによる効率的なデータ取得
  const [contentList, contentTypes] = await Promise.all([
    container.resolve(GetContentListUseCase).execute({ 
      page, 
      search,
      limit: 20 
    }),
    container.resolve(GetContentTypesUseCase).execute()
  ]);
  
  return { 
    contentList, 
    contentTypes,
    pagination: {
      current: page,
      hasNext: contentList.length === 20
    }
  };
}
```

## 8. Error Handling Strategy

### 8.1 Route Level Error Boundaries

```typescript
// app/routes/admin.content.new.tsx
import type { Route } from "./+types/admin.content.new";
import { ValidationError, AuthorizationError } from "~/domain/errors";
import { ContentFormError, AccessDeniedMessage, GeneralError } from "~/_components/UI/Errors";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  console.error('Content creation error:', error);
  
  if (error instanceof ValidationError) {
    return (
      <ContentFormError 
        message="入力内容に問題があります"
        details={error.details}
      />
    );
  }
  
  if (error instanceof AuthorizationError) {
    return (
      <AccessDeniedMessage 
        message="コンテンツを作成する権限がありません"
      />
    );
  }
  
  return (
    <GeneralError 
      message="コンテンツの作成中にエラーが発生しました"
      retry={() => window.location.reload()}
    />
  );
}
```

## 9. 実装チェックリスト

### 9.1 基本構造
- [ ] @react-router/fs-routesパッケージのインストール
- [ ] routes.tsの@react-router/fs-routes設定
- [ ] ファイル命名規則に従ったroute filesの作成
- [ ] 公開エリア (posts, pages) 実装
- [ ] 管理エリア (admin) 実装  
- [ ] API routes実装（ドット記法使用）

### 9.2 認証・認可
- [ ] Admin layout middleware設定
- [ ] 機能別権限制御middleware
- [ ] ログイン・ログアウト処理
- [ ] セッション管理

### 9.3 型安全性
- [ ] Route parameter validation
- [ ] Form action validation
- [ ] API response typing
- [ ] Error type handling

### 9.4 Performance
- [ ] Code splitting確認
- [ ] Data loading optimization
- [ ] Caching strategy実装
- [ ] Bundle size monitoring

### 9.5 Testing
- [ ] Route integration tests
- [ ] Middleware unit tests
- [ ] Form submission tests
- [ ] Error boundary tests

## 10. Related Documents

- [React Router v7 Middleware Implementation Patterns](../implementation/react-router-middleware-patterns.md)
- [Authentication & Security Architecture](authentication-security.md)
- [Domain Design](domain-design.md)
- [Development Implementation Guide](../implementation/development-guide.md)

---

**Last Updated**: 2025-07-02
**Version**: 2.0  
**Status**: @react-router/fs-routes Compatible  
**React Router**: v7 + @react-router/fs-routes対応