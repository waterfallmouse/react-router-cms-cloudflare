import { describe, it, expect, beforeEach } from 'bun:test';
import { Content } from '../../../../src/domain/cms/entities/Content';
import { ContentBody } from '../../../../src/domain/cms/valueObjects/ContentBody';
import { ContentId } from '../../../../src/domain/cms/valueObjects/ContentId';
import { ContentTitle } from '../../../../src/domain/cms/valueObjects/ContentTitle';
import { ContentTypeId } from '../../../../src/domain/cms/valueObjects/ContentTypeId';

describe('Content Entity', () => {
  let validTitle: ContentTitle;
  let validBody: ContentBody;
  let validContentTypeId: ContentTypeId;

  beforeEach(() => {
    validTitle = ContentTitle.fromString('Test Title');
    validBody = ContentBody.fromString('# Test Content');
    validContentTypeId = ContentTypeId.generate();
  });

  describe('create', () => {
    it('should create new content with generated ID and slug', () => {
      const content = Content.create(validTitle, validBody, validContentTypeId);

      expect(content.getId()).toBeInstanceOf(ContentId);
      expect(content.getTitle()).toBe(validTitle);
      expect(content.getBody()).toBe(validBody);
      expect(content.getContentTypeId()).toBe(validContentTypeId);
      expect(content.getSlug().getValue()).toBe('test-title');
      expect(content.isDraft()).toBe(true);
      expect(content.getPublishedAt()).toBeNull();
    });
  });

  describe('publish', () => {
    it('should publish draft content', () => {
      const content = Content.create(validTitle, validBody, validContentTypeId);
      content.publish();

      expect(content.isPublished()).toBe(true);
      expect(content.getPublishedAt()).toBeInstanceOf(Date);
    });

    it('should throw error when publishing already published content', () => {
      const content = Content.create(validTitle, validBody, validContentTypeId);
      content.publish();

      expect(() => content.publish()).toThrow('Content is already published');
    });

    it('should throw error when publishing empty content', () => {
      const emptyBody = ContentBody.fromString('');
      const content = Content.create(validTitle, emptyBody, validContentTypeId);

      expect(() => content.publish()).toThrow('Cannot publish empty content');
    });
  });

  describe('unpublish', () => {
    it('should unpublish a published content', () => {
      const content = Content.create(validTitle, validBody, validContentTypeId);
      content.publish();
      content.unpublish();

      expect(content.isDraft()).toBe(true);
      expect(content.getPublishedAt()).toBeNull();
    });

    it('should throw error when unpublishing a draft content', () => {
      const content = Content.create(validTitle, validBody, validContentTypeId);

      expect(() => content.unpublish()).toThrow('Content is already unpublished');
    });
  });

  describe('archive', () => {
    it('should archive a content', () => {
      const content = Content.create(validTitle, validBody, validContentTypeId);
      content.archive();

      expect(content.isArchived()).toBe(true);
    });
  });

  describe('updateTitle', () => {
    it('should update title and slug', () => {
      const content = Content.create(validTitle, validBody, validContentTypeId);
      const newTitle = ContentTitle.fromString('New Awesome Title');
      content.updateTitle(newTitle);

      expect(content.getTitle()).toBe(newTitle);
      expect(content.getSlug().getValue()).toBe('new-awesome-title');
    });
  });

  describe('updateBody', () => {
    it('should update body', () => {
      const content = Content.create(validTitle, validBody, validContentTypeId);
      const newBody = ContentBody.fromString('## New Content');
      content.updateBody(newBody);

      expect(content.getBody()).toBe(newBody);
    });
  });
});
