# Gemini Project Configuration

This file provides project-specific context and instructions for Gemini.

## Project Overview

This is an enterprise-grade Content Management System (CMS) built with Domain-Driven Design (DDD) principles, React Router v7, and deployed on Cloudflare Workers. The system implements Zero Trust security architecture, Infrastructure as Code with Terraform, and comprehensive RBAC for authorization. The architecture follows clean architecture patterns with extensive documentation and DORA-compliant testing strategies.

## Key Scripts

### Development & Build
- `bun run dev`: Starts the development server with HMR.
- `bun run build`: Builds the application for production.
- `bun run preview`: Preview production build locally.
- `bun run typecheck`: Type checking (includes Cloudflare types generation).
- `bun run cf-typegen`: Generate Cloudflare types.

### Testing (DORA Best Practices)
- `bun test`: Runs all tests.
- `bun test --filter="unit/**/*"`: Run unit tests only.
- `bun test --filter="integration/**/*"`: Run integration tests.
- `bun test --filter="e2e/**/*"`: Run E2E tests.
- `bun test --coverage`: Generate coverage report.

### Code Quality
- `bun run lint`: Run Biome linting.
- `bun run lint:fix`: Fix Biome issues automatically.
- `bun run format`: Run Biome formatting.
- `bun run check`: Run Biome check (lint + format).

### Database
- `bun run db:generate`: Generate Prisma client.
- `bun run db:migrate`: Apply database migrations.
- `bun run db:seed`: Seed test data.

### Infrastructure & Deployment
- `bun run deploy`: Deploys the application to Cloudflare Workers.
- `terraform plan`: Preview infrastructure changes.
- `terraform apply`: Apply infrastructure changes.
- `terraform destroy`: Destroy infrastructure.

## Key Dependencies

### Core Framework
- **React:** Frontend library for building user interfaces.
- **React Router v7:** Declarative routing with SSR and @react-router/fs-routes.
- **Cloudflare Workers:** Edge runtime serverless execution environment.

### Data & Validation
- **Prisma:** Next-generation ORM for TypeScript with Cloudflare D1 support.
- **Zod:** TypeScript-first schema validation with static type inference.
- **Cloudflare D1:** SQLite database at the edge.
- **Cloudflare R2:** Object storage for media files.

### Development & Build Tools
- **Vite:** Fast build tool with React Router plugin.
- **TypeScript:** Static type checking throughout the stack.
- **Bun:** JavaScript runtime and package manager.
- **Biome:** Fast linting and formatting (35x faster than Prettier).

### Security & Authentication
- **Cloudflare Access:** Zero Trust network access.
- **JWT:** Token-based authentication and authorization.
- **RBAC:** Role-based access control domain model.

### Infrastructure & Monitoring
- **Terraform:** Infrastructure as Code for Cloudflare resources.
- **Pino:** High-performance structured logging.
- **Cloudflare Analytics Engine:** Log aggregation and metrics.

### Testing
- **Bun Test:** Fast unit and integration testing.
- **Playwright:** End-to-end testing framework.
- **DORA Metrics:** Deployment frequency, lead time, and failure rate tracking.

## Project Structure

### Application Code
- `app/`: React Router v7 application with file-based routing and middleware.
- `src/`: Backend application logic following Domain-Driven Design (DDD) principles.
  - `domain/`: Domain entities, value objects, and services (cms and auth contexts).
  - `application/`: Use cases, DTOs, and application services (CQRS pattern).
  - `infrastructure/`: Repository implementations, external integrations, and DI.
  - `presentation/`: Route handlers and React components.

### Infrastructure & Configuration
- `terraform/`: Infrastructure as Code for Cloudflare resources management.
- `prisma/`: Database schema, migrations, and seed scripts.
- `workers/`: Cloudflare Worker entry point and configuration.

### Testing & Quality
- `tests/`: Comprehensive test suite following DORA best practices.
  - `unit/`: Domain and application layer tests (70-80% coverage).
  - `integration/`: Repository and API tests (15-25% coverage).
  - `e2e/`: End-to-end user flows (5-10% coverage).

### Documentation
- `docs/`: Comprehensive technical documentation organized by:
  - `architecture/`: System design, domain models, security architecture.
  - `implementation/`: Development guides, testing, DI strategies.
  - `operations/`: Deployment, monitoring, and maintenance procedures.

## Architecture Patterns

### Domain-Driven Design (DDD)
- **Bounded Contexts:** Separate CMS and Auth domains with clear boundaries.
- **Entities & Value Objects:** Rich domain models with business logic encapsulation.
- **Repository Pattern:** Abstract data access with interface segregation.
- **Domain Services:** Complex business logic coordination.

### Application Architecture
- **CQRS:** Separated command and query responsibilities.
- **Clean Architecture:** Dependency inversion and layer separation.
- **Event-Driven:** Domain events for loose coupling between contexts.

### Security Architecture
- **Zero Trust:** Multi-layer security with identity verification and device trust.
- **RBAC:** Comprehensive role-based access control with permissions.
- **Audit Logging:** Security event tracking and monitoring.

## Development Guidelines

### Code Quality
- Follow DDD principles for domain modeling.
- Use Zod schemas for all validation across layers.
- Implement CQRS pattern for use cases.
- Maintain 90%+ test coverage.
- Use structured logging with Pino.
- Follow Zero Trust security principles.

### Testing Strategy
- Test-driven development (TDD) approach.
- DORA-compliant testing with fast feedback loops.
- Unit tests for domain logic and use cases.
- Integration tests for repositories and external services.
- E2E tests for critical user flows.

### Security Best Practices
- Implement authentication at edge (Cloudflare Access).
- Use RBAC for fine-grained authorization.
- Validate all inputs with Zod schemas.
- Log security events for audit trails.
- Follow principle of least privilege.
