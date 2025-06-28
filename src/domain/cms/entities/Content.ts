import { type ContentStatusType } from '../schemas/ValidationSchemas';
import { ContentBody } from '../valueObjects/ContentBody';
import { ContentId } from '../valueObjects/ContentId';
import { ContentSlug } from '../valueObjects/ContentSlug';
import { ContentTitle } from '../valueObjects/ContentTitle';
import { ContentTypeId } from '../valueObjects/ContentTypeId';

export class Content {
  constructor(
    private readonly id: ContentId,
    private title: ContentTitle,
    private slug: ContentSlug,
    private body: ContentBody,
    private status: ContentStatusType,
    private readonly contentTypeId: ContentTypeId,
    private publishedAt: Date | null = null,
    private readonly createdAt: Date = new Date(),
    private updatedAt: Date = new Date(),
  ) {}

  // Getters
  getId(): ContentId {
    return this.id;
  }

  getTitle(): ContentTitle {
    return this.title;
  }

  getSlug(): ContentSlug {
    return this.slug;
  }

  getBody(): ContentBody {
    return this.body;
  }

  getStatus(): ContentStatusType {
    return this.status;
  }

  getContentTypeId(): ContentTypeId {
    return this.contentTypeId;
  }

  getPublishedAt(): Date | null {
    return this.publishedAt;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  // Business Logic
  isPublished(): boolean {
    return this.status === 'published' && this.publishedAt !== null;
  }

  isDraft(): boolean {
    return this.status === 'draft';
  }

  isArchived(): boolean {
    return this.status === 'archived';
  }

  publish(): void {
    if (this.isPublished()) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error('Content is already published');
    }

    if (this.body.isEmpty()) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error('Cannot publish empty content');
    }

    this.status = 'published';
    this.publishedAt = new Date();
    this.updatedAt = new Date();
  }

  unpublish(): void {
    if (this.isDraft()) {
      // biome-ignore lint/style/noThrowStatements: Domain logic requires throwing errors
      throw new Error('Content is already unpublished');
    }

    this.status = 'draft';
    this.publishedAt = null;
    this.updatedAt = new Date();
  }

  archive(): void {
    this.status = 'archived';
    this.updatedAt = new Date();
  }

  updateTitle(title: ContentTitle): void {
    this.title = title;
    this.slug = ContentSlug.fromTitle(title.getValue());
    this.updatedAt = new Date();
  }

  updateBody(body: ContentBody): void {
    this.body = body;
    this.updatedAt = new Date();
  }

  updateSlug(slug: ContentSlug): void {
    this.slug = slug;
    this.updatedAt = new Date();
  }

  generateExcerpt(): string {
    return this.body.generateExcerpt();
  }

  // Factory method
  static create(title: ContentTitle, body: ContentBody, contentTypeId: ContentTypeId): Content {
    const id = ContentId.generate();
    const slug = ContentSlug.fromTitle(title.getValue());
    const status = 'draft';

    return new Content(id, title, slug, body, status, contentTypeId);
  }

  static reconstruct(
    id: ContentId,
    title: ContentTitle,
    slug: ContentSlug,
    body: ContentBody,
    status: ContentStatusType,
    contentTypeId: ContentTypeId,
    publishedAt: Date | null,
    createdAt: Date,
    updatedAt: Date,
  ): Content {
    return new Content(id, title, slug, body, status, contentTypeId, publishedAt, createdAt, updatedAt);
  }
}
