import { ContentTypeDisplayName } from '../valueObjects/ContentTypeDisplayName';
import { ContentTypeId } from '../valueObjects/ContentTypeId';
import { ContentTypeName } from '../valueObjects/ContentTypeName';
import { ContentTypeSchema } from '../valueObjects/ContentTypeSchema';

export class ContentType {
  constructor(
    private readonly id: ContentTypeId,
    private name: ContentTypeName,
    private displayName: ContentTypeDisplayName,
    private description: string | null,
    private schema: ContentTypeSchema,
    private isActive: boolean = true,
    private readonly createdAt: Date = new Date(),
    private updatedAt: Date = new Date(),
  ) {}

  getId(): ContentTypeId {
    return this.id;
  }

  getName(): ContentTypeName {
    return this.name;
  }

  getDisplayName(): ContentTypeDisplayName {
    return this.displayName;
  }

  getDescription(): string | null {
    return this.description;
  }

  getSchema(): ContentTypeSchema {
    return this.schema;
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

  updateDisplayName(displayName: ContentTypeDisplayName): void {
    this.displayName = displayName;
    this.updatedAt = new Date();
  }

  updateDescription(description: string | null): void {
    this.description = description;
    this.updatedAt = new Date();
  }

  updateSchema(schema: ContentTypeSchema): void {
    this.schema = schema;
    this.updatedAt = new Date();
  }

  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  static create(
    name: ContentTypeName,
    displayName: ContentTypeDisplayName,
    schema: ContentTypeSchema,
    description?: string,
  ): ContentType {
    const id = ContentTypeId.generate();
    return new ContentType(id, name, displayName, description || null, schema);
  }
}
