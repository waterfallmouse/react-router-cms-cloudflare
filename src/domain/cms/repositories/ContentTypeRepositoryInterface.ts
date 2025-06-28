import { type ContentType } from '../entities/ContentType';
import { type ContentTypeId } from '../valueObjects/ContentTypeId';
import { type ContentTypeName } from '../valueObjects/ContentTypeName';

export interface ContentTypeRepositoryInterface {
  save(contentType: ContentType): Promise<void>;
  findById(id: ContentTypeId): Promise<ContentType | null>;
  findByName(name: ContentTypeName): Promise<ContentType | null>;
  findAllActive(): Promise<ContentType[]>;
  findAll(): Promise<ContentType[]>;
  delete(id: ContentTypeId): Promise<void>;
}
