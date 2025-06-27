// Basic type definitions for the CMS
// These types support the Domain-Driven Design architecture

export type ContentStatus = 'draft' | 'published' | 'archived'

export type ContentTypeField = {
  type: 'string' | 'text' | 'number' | 'boolean' | 'date' | 'media'
  required: boolean
  maxLength?: number
  minLength?: number
  validation?: string // regex pattern
}

export type ContentTypeSchema = {
  [fieldName: string]: ContentTypeField
}

// Base content interface following DDD principles
export interface ContentData {
  id: string
  title: string
  slug: string
  body: string
  excerpt?: string
  status: ContentStatus
  createdAt: Date
  updatedAt: Date
  contentTypeId: string
}

export interface ContentTypeData {
  id: string
  name: string
  displayName: string
  description?: string
  fields: ContentTypeSchema
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MediaData {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  r2Key: string
  alt?: string
  caption?: string
  createdAt: Date
  updatedAt: Date
  contentId?: string
}

// Domain event types
export interface DomainEvent {
  id: string
  type: string
  aggregateId: string
  aggregateType: string
  eventData: Record<string, any>
  occurredAt: Date
  version: number
}

export interface ContentCreatedEvent extends DomainEvent {
  type: 'ContentCreated'
  aggregateType: 'Content'
  eventData: {
    title: string
    slug: string
    contentType: string
    status: ContentStatus
  }
}

export interface ContentPublishedEvent extends DomainEvent {
  type: 'ContentPublished'
  aggregateType: 'Content'
  eventData: {
    title: string
    slug: string
    publishedAt: Date
  }
}

// Application layer types
export interface CreateContentRequest {
  title: string
  slug?: string
  body: string
  excerpt?: string
  contentTypeId: string
  status?: ContentStatus
}

export interface UpdateContentRequest {
  id: string
  title?: string
  slug?: string
  body?: string
  excerpt?: string
  status?: ContentStatus
}

export interface ContentResponse {
  id: string
  title: string
  slug: string
  body: string
  excerpt?: string
  status: ContentStatus
  createdAt: string
  updatedAt: string
  contentType: {
    id: string
    name: string
    displayName: string
  }
  media?: MediaResponse[]
}

export interface ContentListResponse {
  items: ContentResponse[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface MediaResponse {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  alt?: string
  caption?: string
  createdAt: string
  updatedAt: string
}

export interface UploadMediaRequest {
  file: File
  alt?: string
  caption?: string
  contentId?: string
}

// Error types
export class DomainError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'DomainError'
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT')
    this.name = 'ConflictError'
  }
}