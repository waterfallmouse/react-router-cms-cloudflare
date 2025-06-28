import { describe, it, expect, beforeEach } from 'bun:test';
import { ContentType } from '../../../../src/domain/cms/entities/ContentType';
import { ContentTypeDisplayName } from '../../../../src/domain/cms/valueObjects/ContentTypeDisplayName';
import { ContentTypeId } from '../../../../src/domain/cms/valueObjects/ContentTypeId';
import { ContentTypeName } from '../../../../src/domain/cms/valueObjects/ContentTypeName';
import { ContentTypeSchema } from '../../../../src/domain/cms/valueObjects/ContentTypeSchema';

describe('ContentType Entity', () => {
  let name: ContentTypeName;
  let displayName: ContentTypeDisplayName;
  let schema: ContentTypeSchema;
  let description: string;

  beforeEach(() => {
    name = ContentTypeName.fromString('blog_post');
    displayName = ContentTypeDisplayName.fromString('Blog Post');
    schema = ContentTypeSchema.fromObject({
      title: { type: 'string' },
      body: { type: 'markdown' },
    });
    description = 'A blog post content type';
  });

  describe('create', () => {
    it('should create new content type with generated ID', () => {
      const contentType = ContentType.create(name, displayName, schema, description);

      expect(contentType.getId()).toBeInstanceOf(ContentTypeId);
      expect(contentType.getName()).toBe(name);
      expect(contentType.getDisplayName()).toBe(displayName);
      expect(contentType.getSchema()).toBe(schema);
      expect(contentType.getDescription()).toBe(description);
      expect(contentType.getIsActive()).toBe(true);
    });
  });

  describe('activate/deactivate', () => {
    it('should deactivate and activate the content type', () => {
      const contentType = ContentType.create(name, displayName, schema, description);
      
      contentType.deactivate();
      expect(contentType.getIsActive()).toBe(false);
      
      contentType.activate();
      expect(contentType.getIsActive()).toBe(true);
    });
  });

  describe('update', () => {
    it('should update display name', () => {
      const contentType = ContentType.create(name, displayName, schema, description);
      const newDisplayName = ContentTypeDisplayName.fromString('Article');
      contentType.updateDisplayName(newDisplayName);
      expect(contentType.getDisplayName()).toBe(newDisplayName);
    });

    it('should update description', () => {
      const contentType = ContentType.create(name, displayName, schema, description);
      const newDescription = 'An article content type';
      contentType.updateDescription(newDescription);
      expect(contentType.getDescription()).toBe(newDescription);
    });

    it('should update schema', () => {
      const contentType = ContentType.create(name, displayName, schema, description);
      const newSchema = ContentTypeSchema.fromObject({ field: { type: 'text' } });
      contentType.updateSchema(newSchema);
      expect(contentType.getSchema()).toBe(newSchema);
    });
  });
});
