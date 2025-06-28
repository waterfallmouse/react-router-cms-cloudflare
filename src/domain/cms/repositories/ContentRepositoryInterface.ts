import { type ContentStatusType } from '../schemas/ValidationSchemas';
import { type Content } from '../entities/Content';
import { type ContentId } from '../valueObjects/ContentId';
import { type ContentSlug } from '../valueObjects/ContentSlug';
import { type ContentTypeId } from '../valueObjects/ContentTypeId';

export interface ContentRepositoryInterface {
  save(content: Content): Promise<void>;
  findById(id: ContentId): Promise<Content | null>;
  findBySlug(slug: ContentSlug): Promise<Content | null>;
  findByContentType(contentTypeId: ContentTypeId, page: number, limit: number): Promise<Content[]>;
  findPublishedContents(page: number, limit: number): Promise<Content[]>;
  findAllContents(page: number, limit: number): Promise<Content[]>;
  findByStatus(status: ContentStatusType, page: number, limit: number): Promise<Content[]>;
  delete(id: ContentId): Promise<void>;
  countByStatus(status: ContentStatusType): Promise<number>;
  countByContentType(contentTypeId: ContentTypeId): Promise<number>;
  countAll(): Promise<number>;
}
