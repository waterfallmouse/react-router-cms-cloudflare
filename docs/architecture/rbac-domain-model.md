# RBAC (Role-Based Access Control) Domain Model Design

## 1. RBAC Overview

### 1.1 What is RBAC

**Role-Based Access Control (RBAC)** is a security model that assigns roles to users and controls access to resources based on those roles.

```
User → Role → Permission → Resource
 ↑      ↑        ↑         ↑
 User   Role    Permission Resource

Example:
editor → Editor Role → content:create → /admin/content/new
```

### 1.2 RBAC Elements

- **User**: The entity that accesses the system
- **Role**: A collection of permissions
- **Permission**: Authorization for specific resources and operations
- **Resource**: Protected targets (content, media, etc.)

## 2. Domain Model Design

### 2.1 Introduction of Auth Context

認証と認可の責務を分離するため、`Auth`コンテキストを導入します。このコンテキストは、ユーザーの認証情報と認可（RBAC）モデルを管理します。

- **Accountエンティティ**: 認証情報（メールアドレス、パスワードハッシュ、OAuth連携情報など）を管理します。認証方法の追加・変更は、このエンティティに影響が閉じられます。
- **Userエンティティ**: `Account`と1対1で関連付けられ、システム内での役割（Role）や状態（Status）など、認可に関する情報を管理します。

```
Auth Context
├── Account Aggregate (認証)
│   ├── AccountId
│   ├── EmailAddress
│   └── AuthenticationMethod (Value Object)
└── User Aggregate (認可)
    ├── UserId
    ├── AccountId (関連)
    ├── UserName
    └── UserRole (Entity)
```

### 2.2 Basic Entity Structure

```
User Entity (集約ルート)
├── UserId (値オブジェクト)
├── EmailAddress (値オブジェクト)
├── UserName (値オブジェクト)
├── UserRole (エンティティ)
├── UserStatus (値オブジェクト)
└── UserSessions (エンティティ集合)

UserRole Entity
├── RoleId (値オブジェクト)
├── RoleName (値オブジェクト)
├── Permissions (値オブジェクト集合)
└── RoleHierarchy (値オブジェクト)

Permission (値オブジェクト)
├── Resource (文字列)
├── Action (文字列)
└── Scope (オプション)
```

## 3. Value Object Implementation

### 3.1 UserId

```typescript
// src/domain/auth/valueObjects/UserId.ts
import { IdentifierValueObject } from '../../cms/valueObjects/ValueObjectBase';

export class UserId extends IdentifierValueObject {
  isValidFormat(value: string): boolean {
    // UUID v4 形式の検証
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidV4Regex.test(value);
  }

  static create(): UserId {
    return new UserId(this.generateUUID());
  }

  static from(value: string): UserId {
    return new UserId(value);
  }
}
```

### 3.2 EmailAddress

```typescript
// src/domain/auth/valueObjects/EmailAddress.ts
import { StringValueObject } from '../../cms/valueObjects/ValueObjectBase';

export class EmailAddress extends StringValueObject {
  protected readonly minLength = 3;
  protected readonly maxLength = 254; // RFC 5321準拠
  protected readonly pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  static from(value: string): EmailAddress {
    return new EmailAddress(value.toLowerCase().trim());
  }

  getDomain(): string {
    return this.value.split('@')[1];
  }

  getLocalPart(): string {
    return this.value.split('@')[0];
  }

  isCorporateEmail(): boolean {
    const corporateDomains = ['company.com', 'example.corp'];
    return corporateDomains.includes(this.getDomain());
  }
}
```

### 3.3 UserName

```typescript
// src/domain/auth/valueObjects/UserName.ts
import { StringValueObject } from '../../cms/valueObjects/ValueObjectBase';

export class UserName extends StringValueObject {
  protected readonly minLength = 1;
  protected readonly maxLength = 100;
  protected readonly pattern?: RegExp; // 日本語文字も許可

  static from(value: string): UserName {
    return new UserName(value.trim());
  }

  getDisplayName(): string {
    return this.value;
  }

  getInitials(): string {
    return this.value
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
}
```

### 3.4 Permission

```typescript
// src/domain/auth/valueObjects/Permission.ts
export class Permission {
  constructor(
    private readonly resource: string,
    private readonly action: string,
    private readonly scope?: string
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.resource || !this.action) {
      throw new Error('Resource and action are required');
    }

    if (!/^[a-z_]+$/.test(this.resource)) {
      throw new Error('Resource must contain only lowercase letters and underscores');
    }

    if (!/^[a-z_]+$/.test(this.action)) {
      throw new Error('Action must contain only lowercase letters and underscores');
    }
  }

  getResource(): string {
    return this.resource;
  }

  getAction(): string {
    return this.action;
  }

  getScope(): string | undefined {
    return this.scope;
  }

  toString(): string {
    const base = `${this.resource}:${this.action}`;
    return this.scope ? `${base}:${this.scope}` : base;
  }

  equals(other: Permission): boolean {
    return this.resource === other.resource &&
           this.action === other.action &&
           this.scope === other.scope;
  }

  implies(other: Permission): boolean {
    // リソースチェック
    if (this.resource !== '*' && this.resource !== other.resource) {
      return false;
    }

    // アクションチェック
    if (this.action !== '*' && this.action !== other.action) {
      return false;
    }

    // スコープチェック
    if (this.scope && other.scope && this.scope !== '*' && this.scope !== other.scope) {
      return false;
    }

    return true;
  }

  static fromString(permission: string): Permission {
    const parts = permission.split(':');
    
    if (parts.length < 2 || parts.length > 3) {
      throw new Error('Invalid permission format. Expected "resource:action" or "resource:action:scope"');
    }

    return new Permission(parts[0], parts[1], parts[2]);
  }

  static create(resource: string, action: string, scope?: string): Permission {
    return new Permission(resource, action, scope);
  }

  // 定義済み権限
  static readonly ALL = new Permission('*', '*');
  
  // Content permissions
  static readonly CONTENT_READ = new Permission('content', 'read');
  static readonly CONTENT_CREATE = new Permission('content', 'create');
  static readonly CONTENT_UPDATE = new Permission('content', 'update');
  static readonly CONTENT_DELETE = new Permission('content', 'delete');
  static readonly CONTENT_PUBLISH = new Permission('content', 'publish');
  static readonly CONTENT_ARCHIVE = new Permission('content', 'archive');
  
  // Content Type permissions
  static readonly CONTENT_TYPE_READ = new Permission('content_type', 'read');
  static readonly CONTENT_TYPE_CREATE = new Permission('content_type', 'create');
  static readonly CONTENT_TYPE_UPDATE = new Permission('content_type', 'update');
  static readonly CONTENT_TYPE_DELETE = new Permission('content_type', 'delete');
  
  // Media permissions
  static readonly MEDIA_READ = new Permission('media', 'read');
  static readonly MEDIA_UPLOAD = new Permission('media', 'upload');
  static readonly MEDIA_UPDATE = new Permission('media', 'update');
  static readonly MEDIA_DELETE = new Permission('media', 'delete');
  
  // User management permissions
  static readonly USER_READ = new Permission('user', 'read');
  static readonly USER_CREATE = new Permission('user', 'create');
  static readonly USER_UPDATE = new Permission('user', 'update');
  static readonly USER_DELETE = new Permission('user', 'delete');
  static readonly USER_IMPERSONATE = new Permission('user', 'impersonate');
  
  // Role management permissions
  static readonly ROLE_READ = new Permission('role', 'read');
  static readonly ROLE_CREATE = new Permission('role', 'create');
  static readonly ROLE_UPDATE = new Permission('role', 'update');
  static readonly ROLE_DELETE = new Permission('role', 'delete');
  static readonly ROLE_ASSIGN = new Permission('role', 'assign');
  
  // System permissions
  static readonly SYSTEM_CONFIG = new Permission('system', 'config');
  static readonly SYSTEM_BACKUP = new Permission('system', 'backup');
  static readonly SYSTEM_RESTORE = new Permission('system', 'restore');
  static readonly SYSTEM_LOGS = new Permission('system', 'logs');
  static readonly SYSTEM_MONITOR = new Permission('system', 'monitor');
  static readonly SYSTEM_MAINTENANCE = new Permission('system', 'maintenance');
  
  // API permissions
  static readonly API_READ = new Permission('api', 'read');
  static readonly API_WRITE = new Permission('api', 'write');
  static readonly API_ADMIN = new Permission('api', 'admin');
}
```

### 3.5 RoleName and RoleHierarchy

```typescript
// src/domain/auth/valueObjects/RoleName.ts
import { StringValueObject } from '../../cms/valueObjects/ValueObjectBase';

export class RoleName extends StringValueObject {
  protected readonly minLength = 2;
  protected readonly maxLength = 50;
  protected readonly pattern = /^[a-z][a-z0-9_]*$/; // snake_case

  static from(value: string): RoleName {
    return new RoleName(value.toLowerCase());
  }

  static readonly SUPER_ADMIN = new RoleName('super_admin');
  static readonly ADMIN = new RoleName('admin');
  static readonly PUBLISHER = new RoleName('publisher');
  static readonly EDITOR = new RoleName('editor');
  static readonly AUTHOR = new RoleName('author');
  static readonly VIEWER = new RoleName('viewer');
  static readonly GUEST = new RoleName('guest');
}

// src/domain/auth/valueObjects/RoleHierarchy.ts
export class RoleHierarchy {
  constructor(
    private readonly level: number,
    private readonly parentRole?: RoleName
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.level < 0 || this.level > 100) {
      throw new Error('Role level must be between 0 and 100');
    }
  }

  getLevel(): number {
    return this.level;
  }

  getParentRole(): RoleName | undefined {
    return this.parentRole;
  }

  isHigherThan(other: RoleHierarchy): boolean {
    return this.level > other.level;
  }

  isEqualTo(other: RoleHierarchy): boolean {
    return this.level === other.level;
  }

  canManage(other: RoleHierarchy): boolean {
    return this.level > other.level;
  }

  static readonly HIERARCHY = {
    [RoleName.SUPER_ADMIN.getValue()]: new RoleHierarchy(100),
    [RoleName.ADMIN.getValue()]: new RoleHierarchy(80, RoleName.SUPER_ADMIN),
    [RoleName.PUBLISHER.getValue()]: new RoleHierarchy(60, RoleName.ADMIN),
    [RoleName.EDITOR.getValue()]: new RoleHierarchy(40, RoleName.PUBLISHER),
    [RoleName.AUTHOR.getValue()]: new RoleHierarchy(20, RoleName.EDITOR),
    [RoleName.VIEWER.getValue()]: new RoleHierarchy(10, RoleName.AUTHOR),
    [RoleName.GUEST.getValue()]: new RoleHierarchy(0, RoleName.VIEWER),
  };
}
```

### 3.6 UserStatus

```typescript
// src/domain/auth/valueObjects/UserStatus.ts
export class UserStatus {
  private static readonly VALID_STATUSES = [
    'active',
    'inactive', 
    'suspended',
    'locked',
    'pending_verification'
  ] as const;

  constructor(private readonly status: typeof UserStatus.VALID_STATUSES[number]) {
    this.validate();
  }

  private validate(): void {
    if (!UserStatus.VALID_STATUSES.includes(this.status)) {
      throw new Error(`Invalid user status: ${this.status}`);
    }
  }

  getValue(): string {
    return this.status;
  }

  isActive(): boolean {
    return this.status === 'active';
  }

  isInactive(): boolean {
    return this.status === 'inactive';
  }

  isSuspended(): boolean {
    return this.status === 'suspended';
  }

  isLocked(): boolean {
    return this.status === 'locked';
  }

  isPendingVerification(): boolean {
    return this.status === 'pending_verification';
  }

  canLogin(): boolean {
    return this.status === 'active';
  }

  equals(other: UserStatus): boolean {
    return this.status === other.status;
  }

  static readonly ACTIVE = new UserStatus('active');
  static readonly INACTIVE = new UserStatus('inactive');
  static readonly SUSPENDED = new UserStatus('suspended');
  static readonly LOCKED = new UserStatus('locked');
  static readonly PENDING_VERIFICATION = new UserStatus('pending_verification');

  static from(status: string): UserStatus {
    return new UserStatus(status as any);
  }
}
```

## 4. Entity Implementation

### 4.1 UserRole Entity

```typescript
// src/domain/auth/entities/UserRole.ts
export class UserRole {
  constructor(
    private readonly id: RoleId,
    private readonly name: RoleName,
    private readonly permissions: Permission[],
    private readonly hierarchy: RoleHierarchy,
    private displayName: string,
    private description: string | null = null,
    private readonly isSystemRole: boolean = false,
    private isActive: boolean = true,
    private readonly createdAt: Date = new Date(),
    private updatedAt: Date = new Date()
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.permissions.length === 0 && !this.isSystemRole) {
      throw new Error('Role must have at least one permission');
    }
  }

  // === Getters ===
  getId(): RoleId {
    return this.id;
  }

  getName(): RoleName {
    return this.name;
  }

  getDisplayName(): string {
    return this.displayName;
  }

  getDescription(): string | null {
    return this.description;
  }

  getPermissions(): Permission[] {
    return [...this.permissions];
  }

  getHierarchy(): RoleHierarchy {
    return this.hierarchy;
  }

  isSystemRole(): boolean {
    return this.isSystemRole;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  // === Core Business Logic ===

  hasPermission(permission: Permission): boolean {
    if (!this.isActive) {
      return false;
    }

    return this.permissions.some(p => p.implies(permission));
  }

  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  hasAllPermissions(permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  canAccessResource(resource: string, action: string, scope?: string): boolean {
    const permission = Permission.create(resource, action, scope);
    return this.hasPermission(permission);
  }

  canManageRole(otherRole: UserRole): boolean {
    if (!this.isActive) {
      return false;
    }

    // システムロールは他のロールを管理できない（super_admin除く）
    if (otherRole.isSystemRole && !this.name.equals(RoleName.SUPER_ADMIN)) {
      return false;
    }

    // 階層レベルでの管理権限確認
    return this.hierarchy.canManage(otherRole.hierarchy);
  }

  // === Role Management ===

  addPermission(permission: Permission): void {
    if (this.isSystemRole) {
      throw new Error('Cannot modify system role permissions');
    }

    if (!this.hasPermission(permission)) {
      this.permissions.push(permission);
      this.updatedAt = new Date();
    }
  }

  removePermission(permission: Permission): void {
    if (this.isSystemRole) {
      throw new Error('Cannot modify system role permissions');
    }

    const index = this.permissions.findIndex(p => p.equals(permission));
    if (index !== -1) {
      this.permissions.splice(index, 1);
      this.updatedAt = new Date();
    }
  }

  updateDisplayName(displayName: string): void {
    this.displayName = displayName;
    this.updatedAt = new Date();
  }

  updateDescription(description: string | null): void {
    this.description = description;
    this.updatedAt = new Date();
  }

  activate(): void {
    if (this.isSystemRole) {
      throw new Error('Cannot modify system role status');
    }

    this.isActive = true;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    if (this.isSystemRole) {
      throw new Error('Cannot modify system role status');
    }

    this.isActive = false;
    this.updatedAt = new Date();
  }

  // === Factory Methods ===

  static create(
    name: RoleName,
    displayName: string,
    permissions: Permission[],
    description?: string
  ): UserRole {
    const id = RoleId.create();
    const hierarchy = RoleHierarchy.HIERARCHY[name.getValue()];
    
    if (!hierarchy) {
      throw new Error(`Unknown role hierarchy for: ${name.getValue()}`);
    }

    return new UserRole(
      id, name, permissions, hierarchy, 
      displayName, description
    );
  }

  static reconstruct(
    id: RoleId,
    name: RoleName,
    permissions: Permission[],
    hierarchy: RoleHierarchy,
    displayName: string,
    description: string | null,
    isSystemRole: boolean,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date
  ): UserRole {
    return new UserRole(
      id, name, permissions, hierarchy,
      displayName, description, isSystemRole,
      isActive, createdAt, updatedAt
    );
  }

  // === Predefined System Roles ===

  static readonly SUPER_ADMIN = UserRole.createSystemRole(
    RoleName.SUPER_ADMIN,
    'スーパー管理者',
    [Permission.ALL],
    'システム全体への完全な権限を持つ'
  );

  static readonly ADMIN = UserRole.createSystemRole(
    RoleName.ADMIN,
    '管理者',
    [
      Permission.CONTENT_READ, Permission.CONTENT_CREATE, Permission.CONTENT_UPDATE, 
      Permission.CONTENT_DELETE, Permission.CONTENT_PUBLISH, Permission.CONTENT_ARCHIVE,
      Permission.CONTENT_TYPE_READ, Permission.CONTENT_TYPE_CREATE, Permission.CONTENT_TYPE_UPDATE,
      Permission.MEDIA_READ, Permission.MEDIA_UPLOAD, Permission.MEDIA_UPDATE, Permission.MEDIA_DELETE,
      Permission.USER_READ, Permission.USER_CREATE, Permission.USER_UPDATE,
      Permission.ROLE_READ, Permission.ROLE_ASSIGN,
      Permission.SYSTEM_CONFIG, Permission.SYSTEM_MONITOR, Permission.SYSTEM_BACKUP,
      Permission.API_READ, Permission.API_WRITE
    ],
    'ユーザー管理・システム設定が可能'
  );

  static readonly PUBLISHER = UserRole.createSystemRole(
    RoleName.PUBLISHER,
    'パブリッシャー',
    [
      Permission.CONTENT_READ, Permission.CONTENT_CREATE, Permission.CONTENT_UPDATE, 
      Permission.CONTENT_DELETE, Permission.CONTENT_PUBLISH, Permission.CONTENT_ARCHIVE,
      Permission.CONTENT_TYPE_READ,
      Permission.MEDIA_READ, Permission.MEDIA_UPLOAD, Permission.MEDIA_UPDATE, Permission.MEDIA_DELETE,
      Permission.API_READ, Permission.API_WRITE
    ],
    'コンテンツの公開・削除が可能'
  );

  static readonly EDITOR = UserRole.createSystemRole(
    RoleName.EDITOR,
    'エディター',
    [
      Permission.CONTENT_READ, Permission.CONTENT_CREATE, Permission.CONTENT_UPDATE,
      Permission.CONTENT_TYPE_READ,
      Permission.MEDIA_READ, Permission.MEDIA_UPLOAD, Permission.MEDIA_UPDATE,
      Permission.API_READ
    ],
    'コンテンツの作成・編集が可能'
  );

  static readonly AUTHOR = UserRole.createSystemRole(
    RoleName.AUTHOR,
    '作成者',
    [
      Permission.CONTENT_READ, Permission.CONTENT_CREATE,
      Permission.CONTENT_TYPE_READ,
      Permission.MEDIA_READ, Permission.MEDIA_UPLOAD,
      Permission.API_READ
    ],
    'コンテンツの作成が可能'
  );

  static readonly VIEWER = UserRole.createSystemRole(
    RoleName.VIEWER,
    '閲覧者',
    [
      Permission.CONTENT_READ,
      Permission.CONTENT_TYPE_READ,
      Permission.MEDIA_READ
    ],
    '閲覧のみ可能'
  );

  private static createSystemRole(
    name: RoleName,
    displayName: string,
    permissions: Permission[],
    description: string
  ): UserRole {
    const id = RoleId.create();
    const hierarchy = RoleHierarchy.HIERARCHY[name.getValue()];
    
    return new UserRole(
      id, name, permissions, hierarchy,
      displayName, description, true, true
    );
  }
}
```

### 4.2 User Entity (Aggregate Root)

```typescript
// src/domain/auth/entities/User.ts
export class User {
  constructor(
    private readonly id: UserId,
    private readonly email: EmailAddress,
    private name: UserName,
    private role: UserRole,
    private status: UserStatus,
    private lastLoginAt: Date | null = null,
    private passwordChangedAt: Date | null = null,
    private readonly createdAt: Date = new Date(),
    private updatedAt: Date = new Date()
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.email || !this.name || !this.role) {
      throw new Error('User requires email, name, and role');
    }
  }

  // === Getters ===
  getId(): UserId {
    return this.id;
  }

  getEmail(): EmailAddress {
    return this.email;
  }

  getName(): UserName {
    return this.name;
  }

  getRole(): UserRole {
    return this.role;
  }

  getStatus(): UserStatus {
    return this.status;
  }

  getLastLoginAt(): Date | null {
    return this.lastLoginAt;
  }

  getPasswordChangedAt(): Date | null {
    return this.passwordChangedAt;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  // === Core Business Logic ===

  canLogin(): boolean {
    return this.status.canLogin() && this.role.getIsActive();
  }

  hasPermission(permission: Permission): boolean {
    if (!this.canLogin()) {
      return false;
    }

    return this.role.hasPermission(permission);
  }

  hasAnyPermission(permissions: Permission[]): boolean {
    if (!this.canLogin()) {
      return false;
    }

    return this.role.hasAnyPermission(permissions);
  }

  canAccessResource(resource: string, action: string, scope?: string): boolean {
    const permission = Permission.create(resource, action, scope);
    return this.hasPermission(permission);
  }

  canManageUser(otherUser: User): boolean {
    if (!this.canLogin()) {
      return false;
    }

    // 自分自身は管理できない（一部操作除く）
    if (this.id.equals(otherUser.id)) {
      return false;
    }

    // ロール階層での管理権限確認
    return this.role.canManageRole(otherUser.role);
  }

  canAssignRole(targetRole: UserRole): boolean {
    if (!this.canLogin()) {
      return false;
    }

    // Role assignment permission必須
    if (!this.hasPermission(Permission.ROLE_ASSIGN)) {
      return false;
    }

    // 自分より上位のロールは割り当てできない
    return this.role.canManageRole(targetRole);
  }

  // === User Management ===

  updateName(name: UserName): void {
    this.name = name;
    this.updatedAt = new Date();
  }

  changeRole(newRole: UserRole, changedBy: User): void {
    // 権限チェック
    if (!changedBy.canAssignRole(newRole)) {
      throw new Error('Insufficient permission to assign this role');
    }

    // 現在のロールより上位は自分では割り当てできない
    if (!changedBy.role.canManageRole(this.role)) {
      throw new Error('Cannot change role of higher level user');
    }

    this.role = newRole;
    this.updatedAt = new Date();
  }

  activate(activatedBy: User): void {
    if (!activatedBy.hasPermission(Permission.USER_UPDATE)) {
      throw new Error('Insufficient permission to activate user');
    }

    if (!activatedBy.canManageUser(this)) {
      throw new Error('Cannot activate higher level user');
    }

    this.status = UserStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  suspend(suspendedBy: User, reason?: string): void {
    if (!suspendedBy.hasPermission(Permission.USER_UPDATE)) {
      throw new Error('Insufficient permission to suspend user');
    }

    if (!suspendedBy.canManageUser(this)) {
      throw new Error('Cannot suspend higher level user');
    }

    this.status = UserStatus.SUSPENDED;
    this.updatedAt = new Date();

    // 監査ログに記録
    // TODO: Domain Eventで実装
  }

  lock(reason?: string): void {
    this.status = UserStatus.LOCKED;
    this.updatedAt = new Date();
  }

  unlock(unlockedBy: User): void {
    if (!unlockedBy.hasPermission(Permission.USER_UPDATE)) {
      throw new Error('Insufficient permission to unlock user');
    }

    this.status = UserStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  recordLogin(): void {
    this.lastLoginAt = new Date();
    this.updatedAt = new Date();
  }

  recordPasswordChange(): void {
    this.passwordChangedAt = new Date();
    this.updatedAt = new Date();
  }

  // === Factory Methods ===

  static create(
    email: EmailAddress,
    name: UserName,
    role: UserRole
  ): User {
    const id = UserId.create();
    const status = UserStatus.PENDING_VERIFICATION;

    return new User(id, email, name, role, status);
  }

  static reconstruct(
    id: UserId,
    email: EmailAddress,
    name: UserName,
    role: UserRole,
    status: UserStatus,
    lastLoginAt: Date | null,
    passwordChangedAt: Date | null,
    createdAt: Date,
    updatedAt: Date
  ): User {
    return new User(
      id, email, name, role, status,
      lastLoginAt, passwordChangedAt,
      createdAt, updatedAt
    );
  }
}
```

## 5. Domain Services

### 5.1 RoleManagementService

```typescript
// src/domain/auth/services/RoleManagementService.ts
export class RoleManagementService {
  constructor(
    private roleRepository: UserRoleRepositoryInterface,
    private userRepository: UserRepositoryInterface
  ) {}

  async canDeleteRole(role: UserRole): Promise<boolean> {
    // システムロールは削除できない
    if (role.isSystemRole()) {
      return false;
    }

    // 使用中のロールは削除できない
    const usersWithRole = await this.userRepository.findByRole(role.getId());
    return usersWithRole.length === 0;
  }

  async validateRoleAssignment(
    user: User,
    targetRole: UserRole,
    assignedBy: User
  ): Promise<RoleAssignmentValidation> {
    // 基本権限チェック
    if (!assignedBy.canAssignRole(targetRole)) {
      return {
        valid: false,
        reason: 'Insufficient permission to assign this role'
      };
    }

    // ロール階層チェック
    if (!assignedBy.role.canManageRole(user.role)) {
      return {
        valid: false,
        reason: 'Cannot modify role of higher level user'
      };
    }

    // 自分より上位のロールは割り当てできない
    if (!assignedBy.role.canManageRole(targetRole)) {
      return {
        valid: false,
        reason: 'Cannot assign higher level role'
      };
    }

    // ビジネスルール: 特定の組み合わせの制限
    if (await this.hasConflictingRoleAssignment(user, targetRole)) {
      return {
        valid: false,
        reason: 'Role assignment conflicts with business rules'
      };
    }

    return { valid: true };
  }

  async getEffectivePermissions(user: User): Promise<Permission[]> {
    const rolePermissions = user.getRole().getPermissions();
    
    // 将来的に: グループ権限、一時的権限なども考慮
    // const groupPermissions = await this.getGroupPermissions(user);
    // const temporaryPermissions = await this.getTemporaryPermissions(user);
    
    return rolePermissions;
  }

  private async hasConflictingRoleAssignment(
    user: User, 
    targetRole: UserRole
  ): Promise<boolean> {
    // ビジネスルール例:
    // - 外部ユーザーにadminロールは割り当て不可
    if (!user.getEmail().isCorporateEmail() && 
        targetRole.getName().equals(RoleName.ADMIN)) {
      return true;
    }

    return false;
  }
}

interface RoleAssignmentValidation {
  valid: boolean;
  reason?: string;
}
```

### 5.2 UserAuthorizationService

```typescript
// src/domain/auth/services/UserAuthorizationService.ts
export class UserAuthorizationService {
  constructor(
    private userRepository: UserRepositoryInterface,
    private sessionRepository: UserSessionRepositoryInterface
  ) {}

  async authorizeResourceAccess(
    user: User,
    resource: string,
    action: string,
    context?: AuthorizationContext
  ): Promise<AuthorizationResult> {
    // 基本権限チェック
    if (!user.canAccessResource(resource, action)) {
      return {
        authorized: false,
        reason: 'Insufficient permissions'
      };
    }

    // コンテキスト基準チェック
    if (context) {
      const contextResult = await this.checkContextualAuthorization(user, resource, action, context);
      if (!contextResult.authorized) {
        return contextResult;
      }
    }

    // リアルタイム制約チェック
    const constraintResult = await this.checkRuntimeConstraints(user, resource, action);
    if (!constraintResult.authorized) {
      return constraintResult;
    }

    return { authorized: true };
  }

  private async checkContextualAuthorization(
    user: User,
    resource: string,
    action: string,
    context: AuthorizationContext
  ): Promise<AuthorizationResult> {
    // 時間制約
    if (context.timeRestriction && !this.isWithinAllowedTime(context.timeRestriction)) {
      return {
        authorized: false,
        reason: 'Access outside allowed time window'
      };
    }

    // 地理的制約
    if (context.locationRestriction && !this.isAllowedLocation(context.locationRestriction)) {
      return {
        authorized: false,
        reason: 'Access from unauthorized location'
      };
    }

    // デバイス制約
    if (context.deviceRestriction && !await this.isAuthorizedDevice(user, context.deviceRestriction)) {
      return {
        authorized: false,
        reason: 'Unauthorized device'
      };
    }

    return { authorized: true };
  }

  private async checkRuntimeConstraints(
    user: User,
    resource: string,
    action: string
  ): Promise<AuthorizationResult> {
    // 同時セッション制限
    const activeSessions = await this.sessionRepository.findActiveSessionsByUser(user.getId());
    if (activeSessions.length > this.getMaxSessionsForRole(user.getRole())) {
      return {
        authorized: false,
        reason: 'Maximum concurrent sessions exceeded'
      };
    }

    // レート制限
    if (await this.isRateLimited(user, resource, action)) {
      return {
        authorized: false,
        reason: 'Rate limit exceeded'
      };
    }

    return { authorized: true };
  }

  private getMaxSessionsForRole(role: UserRole): number {
    const limits = {
      [RoleName.SUPER_ADMIN.getValue()]: 10,
      [RoleName.ADMIN.getValue()]: 5,
      [RoleName.PUBLISHER.getValue()]: 3,
      [RoleName.EDITOR.getValue()]: 2,
      [RoleName.AUTHOR.getValue()]: 1,
      [RoleName.VIEWER.getValue()]: 1
    };

    return limits[role.getName().getValue()] || 1;
  }
}

interface AuthorizationContext {
  timeRestriction?: TimeRestriction;
  locationRestriction?: LocationRestriction;
  deviceRestriction?: DeviceRestriction;
}

interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  requiredActions?: string[];
}
```

## 6. Events

### 6.1 User-Related Events

```typescript
// src/domain/auth/events/UserRoleChangedEvent.ts
export class UserRoleChangedEvent implements DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly previousRole: UserRole,
    public readonly newRole: UserRole,
    public readonly changedBy: UserId,
    public readonly reason: string | null,
    public readonly occurredAt: Date = new Date()
  ) {}

  getEventName(): string {
    return 'UserRoleChanged';
  }

  getAggregateId(): string {
    return this.userId.getValue();
  }
}

// src/domain/auth/events/UserSuspendedEvent.ts
export class UserSuspendedEvent implements DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly suspendedBy: UserId,
    public readonly reason: string | null,
    public readonly occurredAt: Date = new Date()
  ) {}

  getEventName(): string {
    return 'UserSuspended';
  }

  getAggregateId(): string {
    return this.userId.getValue();
  }
}

// src/domain/auth/events/RolePermissionsChangedEvent.ts
export class RolePermissionsChangedEvent implements DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly addedPermissions: Permission[],
    public readonly removedPermissions: Permission[],
    public readonly changedBy: UserId,
    public readonly occurredAt: Date = new Date()
  ) {}

  getEventName(): string {
    return 'RolePermissionsChanged';
  }

  getAggregateId(): string {
    return this.roleId.getValue();
  }
}
```

## 7. Repository Interfaces

### 7.1 UserRepository

```typescript
// src/domain/auth/repositories/UserRepositoryInterface.ts
export interface UserRepositoryInterface {
  // 基本CRUD
  save(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: EmailAddress): Promise<User | null>;
  delete(id: UserId): Promise<void>;

  // クエリ
  findByRole(roleId: RoleId): Promise<User[]>;
  findByStatus(status: UserStatus): Promise<User[]>;
  findActiveUsers(): Promise<User[]>;
  findUsersWithPermission(permission: Permission): Promise<User[]>;

  // 検索
  searchUsers(criteria: UserSearchCriteria): Promise<UserSearchResult>;
  
  // 統計
  countUsersByRole(): Promise<Map<RoleId, number>>;
  countActiveUsers(): Promise<number>;
}

export interface UserSearchCriteria {
  email?: string;
  name?: string;
  roleId?: RoleId;
  status?: UserStatus;
  createdAfter?: Date;
  createdBefore?: Date;
  page: number;
  limit: number;
}

export interface UserSearchResult {
  users: User[];
  totalCount: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### 7.2 UserRoleRepository

```typescript
// src/domain/auth/repositories/UserRoleRepositoryInterface.ts
export interface UserRoleRepositoryInterface {
  // 基本CRUD
  save(role: UserRole): Promise<void>;
  findById(id: RoleId): Promise<UserRole | null>;
  findByName(name: RoleName): Promise<UserRole | null>;
  delete(id: RoleId): Promise<void>;

  // クエリ
  findAll(): Promise<UserRole[]>;
  findActiveRoles(): Promise<UserRole[]>;
  findSystemRoles(): Promise<UserRole[]>;
  findCustomRoles(): Promise<UserRole[]>;
  findRolesWithPermission(permission: Permission): Promise<UserRole[]>;

  // 階層関連
  findRolesByHierarchyLevel(level: number): Promise<UserRole[]>;
  findSubordinateRoles(role: UserRole): Promise<UserRole[]>;
}
```

## 8. Usage Examples

### 8.1 Basic Permission Check

```typescript
// app/routes/admin.content.new.tsx
export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.user as User;
  
  // 権限チェック
  if (!user.hasPermission(Permission.CONTENT_CREATE)) {
    throw new Response('Forbidden', { status: 403 });
  }

  // ビジネスロジック実行
  const formData = await request.formData();
  // ...
}
```

### 8.2 Dynamic Permission Check

```typescript
// app/routes/admin.users.$userId.role.tsx
export async function action({ request, params, context }: ActionFunctionArgs) {
  const currentUser = context.user as User;
  const targetUserId = UserId.from(params.userId);
  
  // 対象ユーザー取得
  const userRepository = container.resolve<UserRepositoryInterface>(TOKENS.UserRepository);
  const targetUser = await userRepository.findById(targetUserId);
  
  if (!targetUser) {
    throw new Response('User not found', { status: 404 });
  }

  // 動的権限チェック
  if (!currentUser.canManageUser(targetUser)) {
    throw new Response('Cannot manage this user', { status: 403 });
  }

  // ロール変更処理
  const formData = await request.formData();
  const newRoleName = RoleName.from(formData.get('role') as string);
  
  const roleRepository = container.resolve<UserRoleRepositoryInterface>(TOKENS.UserRoleRepository);
  const newRole = await roleRepository.findByName(newRoleName);
  
  if (!newRole) {
    throw new Response('Role not found', { status: 404 });
  }

  // ロール割り当て権限チェック
  if (!currentUser.canAssignRole(newRole)) {
    throw new Response('Cannot assign this role', { status: 403 });
  }

  // ロール変更実行
  targetUser.changeRole(newRole, currentUser);
  await userRepository.save(targetUser);
  
  return redirect('/admin/users');
}
```

## 9. Related Documents

- [authentication-security.md](authentication-security.md) - Authentication & Security Architecture
- [../implementation/zero-trust-security.md](../implementation/zero-trust-security.md) - Zero Trust Security Implementation Strategy
- [domain-design.md](domain-design.md) - Domain Model Design
- [../implementation/react-router-middleware-patterns.md](../implementation/react-router-middleware-patterns.md) - React Router Middleware Implementation Patterns

---

**Last Updated**: 2025-07-02
**Version**: 2.0  
**Status**: Domain Model Design Complete  
**Compliance**: RBAC Standards & DDD Principles
