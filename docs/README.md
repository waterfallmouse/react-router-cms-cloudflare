# CMS Project Documentation

## 📋 Document Structure

The documentation for this project is organized as follows.

It is recommended to first read [glossary.md](glossary.md) to understand the project's ubiquitous language.

### 🏗️ Architecture

| Document | Contents | Reading Order |
|---|---|---|
| [overview.md](architecture/overview.md) | **Project Overview** - Tech stack, functional requirements, system design | 📖 **1st** |
| [domain-design.md](architecture/domain-design.md) | **Domain Model Design** - DDD implementation, entities, value objects | 📖 **2nd** |
| [application-layer.md](architecture/application-layer.md) | **Application Layer Design** - UseCases, DTOs, transactions | 📖 **3rd** |
| [infrastructure.md](architecture/infrastructure.md) | **Infrastructure & Tech Selection** - Database, storage, deployment | 📖 **4th** |

### 🛠️ Implementation

| Document | Contents | Audience |
|---|---|---|
| [development-guide.md](implementation/development-guide.md) | **Development Guide** - Commands, environment setup, coding standards | 👨‍💻 **All Developers** |
| [dependency-injection.md](implementation/dependency-injection.md) | **DI Strategy** - Container design, Decorator implementation | 👨‍💻 **Architects** |
| [testing-strategy.md](implementation/testing-strategy.md) | **Testing Strategy** - DORA compliance, test pyramid | 👨‍💻 **All Developers** |
| [logging-strategy.md](implementation/logging-strategy.md) | **Logging Strategy** - Structured logging, tracing | 👨‍💻 **Developers & Ops** |

### 🚀 Operations

| Document | Contents | Audience |
|---|---|---|
| [deployment.md](operations/deployment.md) | **Deployment Strategy** - CI/CD, environment management | 🔧 **DevOps** |
| [monitoring.md](operations/monitoring.md) | **Monitoring & Metrics** - Dashboards, alerts | 🔧 **Operations Team** |

## 🎯 Quick Start

### For Newcomers
1. [overview.md](architecture/overview.md) - Understand the project overview
2. [development-guide.md](implementation/development-guide.md) - Set up the development environment
3. [domain-design.md](architecture/domain-design.md) - Understand the domain model

### For Implementers
1. [application-layer.md](architecture/application-layer.md) - Implement the application layer
2. [dependency-injection.md](implementation/dependency-injection.md) - Implement DI
3. [testing-strategy.md](implementation/testing-strategy.md) - Implement tests

### For Operators
1. [infrastructure.md](architecture/infrastructure.md) - Understand the infrastructure
2. [deployment.md](operations/deployment.md) - Follow deployment procedures
3. [monitoring.md](operations/monitoring.md) - Configure monitoring

## 🔗 Related Resources

- **Project Root**: [CLAUDE.md](../CLAUDE.md) - Project implementation guide for Claude Code
- **Source Code**: `src/` directory
- **Test Code**: `tests/` directory

## 📝 Document Update Rules

1. **On Design Change**: Update the corresponding architecture document.
2. **On Implementation Procedure Change**: Update the implementation document.
3. **On Operational Procedure Change**: Update the operations document.
4. **For Significant Changes**: Update [CLAUDE.md](../CLAUDE.md) as well.

---

**Last Updated**: 2025-07-02
**Version**: 2.0
