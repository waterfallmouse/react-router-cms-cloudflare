# Gemini Backend Configuration

This file provides project-specific context and instructions for the backend application following Domain-Driven Design (DDD) principles.

## Backend Architecture

The backend implements a clean architecture with Domain-Driven Design (DDD) principles, organized into the following layers:

### Domain Layer (`src/domain/`)
- **Bounded Contexts:** 
  - `cms/`: Content management domain with entities (Content, ContentType, Media)
  - `auth/`: Authentication and authorization domain with RBAC implementation
- **Entities:** Rich domain models with business logic encapsulation
- **Value Objects:** Immutable objects representing domain concepts (ContentId, ContentTitle, etc.)
- **Domain Services:** Complex business logic coordination (ContentDomainService)
- **Repository Interfaces:** Abstract data access contracts
- **Domain Events:** Event-driven communication between bounded contexts

### Application Layer (`src/application/`)
- **Use Cases:** CQRS pattern implementation (CreateContentUseCase, PublishContentUseCase)
- **DTOs:** Request/Response data transfer objects with Zod validation
- **Application Services:** Transaction management, event dispatching
- **Query Services:** Read-optimized services for CQRS query side

### Infrastructure Layer (`src/infrastructure/`)
- **Repository Implementations:** Prisma-based implementations for Cloudflare D1
- **External Integrations:** Cloudflare R2 for file storage, Analytics Engine for logging
- **Dependency Injection:** Container and service registration
- **Authentication:** Cloudflare Access JWT verification and RBAC enforcement
- **Logging:** Pino structured logging with request tracing
- **Security:** Zero Trust security implementations

### Presentation Layer (`src/presentation/`)
- **Route Handlers:** React Router v7 action and loader functions
- **Components:** Server-side React components for SSR
- **Middleware Integration:** Authentication and authorization middleware

## Key Technologies & Libraries

### Core Framework
- **Prisma:** Next-generation ORM with Cloudflare D1 support for edge databases
- **Zod:** TypeScript-first schema validation with static type inference
- **React Router v7:** Server-side routing with loaders and actions

### Domain-Driven Design Tools
- **TypeScript:** Strong typing for domain modeling and interfaces
- **Custom Decorators:** Dependency injection and cross-cutting concerns
- **Event System:** Domain event dispatching for loose coupling

### Security & Authentication
- **Cloudflare Access:** Zero Trust network access with JWT verification
- **RBAC Domain Model:** Role-based access control with Permission entities
- **Audit Logging:** Security event tracking and compliance

### Monitoring & Observability
- **Pino:** High-performance structured logging optimized for Cloudflare Workers
- **OpenTelemetry:** Distributed tracing and performance monitoring
- **Cloudflare Analytics Engine:** Log aggregation and real-time metrics

## Development Patterns

### Domain-Driven Design Implementation
- **Ubiquitous Language:** Consistent terminology across domain and code
- **Aggregate Roots:** Transaction boundaries and consistency enforcement
- **Repository Pattern:** Abstract data access with dependency inversion
- **Domain Events:** Loose coupling between bounded contexts

### CQRS (Command Query Responsibility Segregation)
- **Command Side:** Write operations through Use Cases with business logic
- **Query Side:** Read operations through optimized Query Services
- **Separate Models:** Different data representations for reads and writes

### Security-First Development
- **Zero Trust Principles:** Verify every request and user
- **Input Validation:** Zod schemas at all boundaries
- **Authorization:** RBAC checks at domain and application levels
- **Audit Logging:** Track all security-sensitive operations

### Testing Strategy
- **Unit Tests:** Domain entities, value objects, and use cases (70-80%)
- **Integration Tests:** Repository implementations and external services (15-25%)
- **Contract Tests:** API contracts and domain interfaces
- **Security Tests:** Authentication, authorization, and input validation

## Code Organization Guidelines

### File Naming Conventions
- **Entities:** PascalCase (Content.ts, ContentType.ts)
- **Value Objects:** PascalCase (ContentId.ts, ContentTitle.ts)
- **Use Cases:** PascalCase with UseCase suffix (CreateContentUseCase.ts)
- **Repositories:** Interface suffix (ContentRepositoryInterface.ts)
- **Implementations:** Technology prefix (PrismaContentRepository.ts)

### Import Guidelines
- **Domain Layer:** No external dependencies except TypeScript utilities
- **Application Layer:** Import from domain layer and external interfaces only
- **Infrastructure Layer:** Can import from all layers for implementation

### Error Handling
- **Domain Errors:** Custom error classes for business rule violations
- **Application Errors:** Use case specific errors with proper error codes
- **Infrastructure Errors:** External service failures with retry strategies

## Performance Considerations

### Cloudflare Workers Optimization
- **Cold Start Minimization:** Lazy loading and efficient imports
- **Memory Management:** Careful object creation and garbage collection
- **Bundle Size:** Tree-shaking and code splitting
- **Edge Caching:** Leverage Cloudflare's global CDN

### Database Optimization
- **Query Optimization:** Efficient Prisma queries with proper indexing
- **Connection Pooling:** Prisma connection management for D1
- **Caching Strategy:** Edge caching for read-heavy operations

## Security Implementation

### Authentication Flow
1. **Edge Authentication:** Cloudflare Access JWT verification
2. **Application Authentication:** User context loading and session management
3. **Authorization:** RBAC permission checks at use case level

### Data Protection
- **Input Sanitization:** Zod validation at all entry points
- **Output Encoding:** Proper data serialization and encoding
- **Audit Logging:** Comprehensive security event logging
- **Encryption:** Sensitive data encryption at rest and in transit

## Related Documentation

For comprehensive implementation details, refer to:
- [Domain Design](../docs/architecture/domain-design.md) - Complete domain model documentation
- [Application Layer](../docs/architecture/application-layer.md) - Use case and service patterns
- [Security Architecture](../docs/architecture/authentication-security.md) - Zero Trust implementation
- [RBAC Domain Model](../docs/architecture/rbac-domain-model.md) - Authorization patterns
- [Testing Strategy](../docs/implementation/testing-strategy.md) - DORA-compliant testing approach
- [Logging Strategy](../docs/implementation/logging-strategy.md) - Pino structured logging
- [Dependency Injection](../docs/implementation/dependency-injection.md) - DI container patterns