# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📚 Documentation Structure

**Important**: Comprehensive project documentation is organized in the `docs/` directory:

- **Architecture**: [docs/architecture/](docs/architecture/) - System design, domain models, infrastructure
- **Implementation**: [docs/implementation/](docs/implementation/) - Development guides, testing, DI strategies  
- **Operations**: [docs/operations/](docs/operations/) - Deployment, monitoring, maintenance

**Start here**: [docs/README.md](docs/README.md) for complete navigation guide.

## Project Overview

This is a modern Content Management System (CMS) built with Domain-Driven Design (DDD) principles, using React Router v7 and deployed on Cloudflare Workers. The application implements a clean architecture with TypeScript, Zod validation, and TailwindCSS for a modern, scalable content management platform. The system follows Zero Trust security principles with comprehensive RBAC implementation and Infrastructure as Code (Terraform) deployment strategies. The initial use case is a personal blog service, but the architecture is designed for extensibility to support various content types and enterprise CMS functionalities.

## Architecture & Design Patterns

### DDD Layered Architecture
- **Domain Layer**: Entities, Value Objects, Domain Services, Repository Interfaces
- **Application Layer**: Use Cases (CQRS pattern), DTOs, Application Services
- **Infrastructure Layer**: Repository implementations (Prisma + Cloudflare D1/R2)
- **Presentation Layer**: React Router v7 route handlers, React components

### Technology Stack
- **Frontend**: React Router v7 with SSR support + @react-router/fs-routes
- **Backend**: Cloudflare Workers (edge runtime)
- **Database**: Cloudflare D1 (SQLite) with Prisma ORM
- **File Storage**: Cloudflare R2 for images
- **Authentication**: Cloudflare Access with Zero Trust security model
- **Authorization**: Comprehensive RBAC with domain-driven auth context
- **Styling**: TailwindCSS v4 (JIN-theme inspired design)
- **Validation**: Zod schemas throughout all layers
- **Testing**: Bun Test + Playwright (DORA best practices)
- **Build Tool**: Vite with React Router dev tools
- **Infrastructure**: Terraform for Infrastructure as Code
- **Logging**: Pino for high-performance structured logging
- **Monitoring**: Cloudflare Analytics Engine + external monitoring tools
- **Security**: Zero Trust implementation with device trust and network segmentation

### Project Structure
```
src/
├── domain/
│   ├── cms/                  # CMS bounded context
│   │   ├── entities/         # Content, ContentType, Media entities
│   │   ├── valueObjects/     # ContentId, ContentTitle, ContentSlug, etc.
│   │   ├── services/         # ContentDomainService, MediaDomainService
│   │   ├── repositories/     # Interface definitions
│   │   └── schemas/          # Zod validation schemas
│   └── auth/                # Auth bounded context (RBAC)
│       ├── entities/         # User, Role, Permission entities
│       ├── valueObjects/     # UserId, RoleName, Permission types
│       └── services/         # AuthorizationService
├── application/
│   ├── usecases/             # CreateContent, PublishContent, etc.
│   ├── dto/                  # Request/Response DTOs
│   └── services/             # Transaction, Event handling, Logging
├── infrastructure/
│   ├── repositories/         # Prisma implementations
│   ├── external/             # R2, external APIs
│   ├── di/                   # Dependency injection
│   ├── auth/                 # Cloudflare Access integration
│   ├── logging/              # Pino logger configuration
│   └── security/             # Zero Trust implementations
└── presentation/
    ├── routes/               # React Router route handlers
    └── components/           # React components

app/
├── routes/                   # @react-router/fs-routes file-based routing
├── middleware/               # Authentication, authorization middleware
└── components/               # Shared React components

terraform/
├── modules/                  # Reusable Terraform modules
├── environments/             # Environment-specific configurations
└── main.tf                   # Main Terraform configuration

tests/
├── unit/                     # Domain & Application layer tests
├── integration/              # Repository & API tests
└── e2e/                      # End-to-end user flows
```

## Development Commands

```bash
# Install dependencies
bun install

# Start development server with HMR
bun run dev

# Build for production
bun run build

# Type checking (includes Cloudflare types generation)
bun run typecheck

# Preview production build locally
bun run preview

# Deploy to Cloudflare Workers
bun run deploy

# Generate Cloudflare types
bun run cf-typegen

# Database commands
bun run db:generate    # Generate Prisma client
bun run db:migrate     # Run database migrations
bun run db:seed        # Seed test data

# Infrastructure commands (Terraform)
terraform plan         # Preview infrastructure changes
terraform apply        # Apply infrastructure changes
terraform destroy      # Destroy infrastructure
cd terraform && terraform workspace select dev    # Switch environments

# Testing commands
bun test              # Run all tests
bun test --filter="unit/**/*"     # Run unit tests only
bun test --filter="integration/**/*"  # Run integration tests
bun test --filter="e2e/**/*"      # Run E2E tests
bun test --coverage   # Generate coverage report

# Linting and formatting
bun run lint          # Run Biome linting
bun run lint:fix      # Fix Biome issues automatically
bun run format        # Run Biome formatting
bun run check         # Run Biome check (lint + format)
```

## Key Configuration Files

- `wrangler.jsonc`: Cloudflare Workers configuration
- `react-router.config.ts`: React Router configuration with SSR enabled
- `vite.config.ts`: Vite configuration with Cloudflare, TailwindCSS, and React Router plugins
- `workers/app.ts`: Cloudflare Worker entry point that handles requests
- `prisma/schema.prisma`: Database schema definition
- `bunfig.toml`: Bun Test configuration
- `tailwind.config.ts`: TailwindCSS configuration
- `biome.json`: Biome linting and formatting configuration
- `terraform/main.tf`: Infrastructure as Code configuration
- `terraform/variables.tf`: Terraform variable definitions
- `app/middleware/`: Authentication and authorization middleware
- `src/infrastructure/logging/pino.config.ts`: Pino logging configuration

## Development Guidelines

### DDD Implementation Rules
1. **Domain Layer**: Keep pure business logic, no external dependencies
2. **Application Layer**: Orchestrate domain objects, handle transactions
3. **Infrastructure Layer**: Implement repository interfaces, external integrations
4. **Presentation Layer**: Handle HTTP requests, validation, serialization

### Code Quality Standards
- Use Zod schemas for all validation (domain and application layers)
- Write tests first (TDD approach recommended)
- Follow CQRS pattern for use cases
- Maintain 90%+ test coverage (enforced by fail_on_low_coverage)
- Use dependency injection for loose coupling
- Use Biome for consistent code formatting and linting (35x faster than Prettier)
- Follow Biome's built-in style guidelines for TypeScript/JavaScript
- Implement Zero Trust security principles in all layers
- Use structured logging with Pino for all application events
- Follow RBAC patterns for authorization throughout the application
- Implement proper error handling and audit logging for security events

### Testing Strategy (DORA Best Practices)
- **Unit Tests (70-80%)**: Domain entities, value objects, use cases
- **Integration Tests (15-25%)**: Repository implementations, API endpoints  
- **E2E Tests (5-10%)**: Critical user flows only
- Run tests in CI/CD pipeline
- Maintain fast feedback loops (<30s unit, <5min integration, <15min E2E)

### Naming Conventions
- **Entities**: PascalCase (Content, ContentType, Media)
- **Value Objects**: PascalCase (ContentTitle, ContentSlug, MediaUrl)
- **Use Cases**: PascalCase with UseCase suffix (CreateContentUseCase)
- **Repository Interfaces**: PascalCase with Interface suffix (ContentRepositoryInterface)
- **Repository Implementations**: PascalCase with technology prefix (PrismaContentRepository)

### Development Notes

- The app uses React Router v7's new architecture with @react-router/fs-routes for automatic route generation
- Cloudflare Worker bindings are available through the `AppLoadContext.cloudflare` interface
- TailwindCSS v4 is configured with the Vite plugin
- Type generation for Cloudflare bindings runs automatically after install
- The build process generates both client and server bundles for the edge runtime
- Authentication follows Zero Trust principles with multi-layer security (Cloudflare Access + Application-level RBAC)
- Authorization is implemented through comprehensive RBAC domain model with Role and Permission entities
- Media files are stored in Cloudflare R2 and metadata in D1 database
- All external inputs must be validated using Zod schemas
- Structured logging with Pino provides high-performance request tracing and audit logs
- Infrastructure is managed as code using Terraform for consistent deployments
- Security audit logging captures all authentication, authorization, and sensitive operations
- Content types are extensible and configurable with custom field schemas
- The CMS supports various content types (blog posts, pages, custom types) with role-based content management
- Domain model designed for multi-tenancy, scalability, and enterprise security requirements
- Middleware patterns handle cross-cutting concerns (auth, logging, error handling) at the route level

## 📖 Additional Resources

For detailed information, refer to the comprehensive documentation:

- **Getting Started**: [docs/README.md](docs/README.md) - Navigation and quick start guide
- **System Architecture**: [docs/architecture/overview.md](docs/architecture/overview.md) - Complete system design
- **Development Guide**: [docs/implementation/development-guide.md](docs/implementation/development-guide.md) - Coding standards and workflows
- **Domain Design**: [docs/architecture/domain-design.md](docs/architecture/domain-design.md) - DDD implementation details
- **Security Architecture**: [docs/architecture/authentication-security.md](docs/architecture/authentication-security.md) - Zero Trust security implementation
- **RBAC Domain Model**: [docs/architecture/rbac-domain-model.md](docs/architecture/rbac-domain-model.md) - Role-based access control patterns
- **Infrastructure Design**: [docs/architecture/infrastructure.md](docs/architecture/infrastructure.md) - Cloudflare + Terraform architecture
- **Testing Strategy**: [docs/implementation/testing-strategy.md](docs/implementation/testing-strategy.md) - Test patterns and DORA practices
- **Logging Strategy**: [docs/implementation/logging-strategy.md](docs/implementation/logging-strategy.md) - Pino structured logging patterns
- **Dependency Injection**: [docs/implementation/dependency-injection.md](docs/implementation/dependency-injection.md) - DI container patterns
- **Zero Trust Implementation**: [docs/implementation/zero-trust-security.md](docs/implementation/zero-trust-security.md) - Security implementation guide
- **React Router Middleware**: [docs/implementation/react-router-middleware-patterns.md](docs/implementation/react-router-middleware-patterns.md) - Middleware implementation patterns
- **Deployment**: [docs/operations/deployment.md](docs/operations/deployment.md) - Terraform CI/CD and environment management
- **Monitoring**: [docs/operations/monitoring.md](docs/operations/monitoring.md) - Comprehensive monitoring and alerting
- **Cloudflare Access Setup**: [docs/operations/cloudflare-access-setup.md](docs/operations/cloudflare-access-setup.md) - Zero Trust authentication setup
- **Glossary**: [docs/glossary.md](docs/glossary.md) - Ubiquitous language and terminology
