# Glossary

This document defines the ubiquitous language used throughout the project to maintain consistency.

| Term | Description | Related Context |
|---|---|---|
| **Content** | The basic unit of information managed by the CMS, such as articles, pages, or product information. | `Content Aggregate` |
| **ContentType** | A template that defines the structure and behavior of content, such as "Blog Post" or "Static Page". | `ContentType Aggregate` |
| **Slug** | A human-readable string used to uniquely identify content within a URL. | `Content` |
| **Media** | Files associated with content, such as images, videos, or documents. | `Media Aggregate` |
| **User** | The subject that uses the system. The target of authentication and authorization. | `Auth Context` |
| **Account** | An entity that manages a user's authentication credentials (email, password, etc.). | `Auth Context` |
| **Role** | A role assigned to a user. A collection of permissions. e.g., "Editor", "Administrator". | `Auth Context` |
| **Permission** | Permission to perform an operation on a specific resource, such as "content:create". | `Auth Context` |
| **Entity** | A domain object that has a unique ID and whose state changes throughout its lifecycle. | `Domain Layer` |
| **Value Object** | An immutable object defined by its attributes, without a unique ID. | `Domain Layer` |
| **Aggregate** | A cluster of one or more entities and value objects that serves as a consistency boundary. Has an aggregate root. | `Domain Layer` |
| **Domain Service** | Domain-specific logic that does not belong to a specific entity or value object. | `Domain Layer` |
| **Repository** | An interface that abstracts the persistence of aggregates. | `Domain Layer` / `Infrastructure Layer` |
| **Use Case** | A class that represents a specific operation of the application. Executes commands or queries. | `Application Layer` |
| **DTO (Data Transfer Object)** | An object for transferring data between layers. It is serializable. | `Application Layer` |
| **Domain Event** | An object that represents a significant event that occurred within the domain. | `Domain Layer` |

---

**Last Updated**: 2025-07-02
**Version**: 2.0  
**Status**: Ubiquitous Language Complete  
**対象**: 開発チーム全員