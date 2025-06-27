import { describe, it, expect } from 'bun:test';
import { ContentStatus } from '../../../../src/domain/cms/valueObjects/ContentStatus';

describe('ContentStatus', () => {
  describe('create', () => {
    it('should create a ContentStatus with valid status', () => {
      const status = ContentStatus.create('draft');
      
      expect(status.value).toBe('draft');
    });

    it('should throw error for invalid status', () => {
      // @ts-expect-error Testing invalid input
      expect(() => ContentStatus.create('invalid')).toThrow('Status must be draft, published, or archived');
    });

    it('should accept all valid status values', () => {
      const draft = ContentStatus.create('draft');
      const published = ContentStatus.create('published');
      const archived = ContentStatus.create('archived');
      
      expect(draft.value).toBe('draft');
      expect(published.value).toBe('published');
      expect(archived.value).toBe('archived');
    });
  });

  describe('static factory methods', () => {
    it('should create draft status', () => {
      const status = ContentStatus.draft();
      
      expect(status.value).toBe('draft');
      expect(status.isDraft()).toBe(true);
    });

    it('should create published status', () => {
      const status = ContentStatus.published();
      
      expect(status.value).toBe('published');
      expect(status.isPublished()).toBe(true);
    });

    it('should create archived status', () => {
      const status = ContentStatus.archived();
      
      expect(status.value).toBe('archived');
      expect(status.isArchived()).toBe(true);
    });
  });

  describe('status check methods', () => {
    it('should correctly identify draft status', () => {
      const status = ContentStatus.draft();
      
      expect(status.isDraft()).toBe(true);
      expect(status.isPublished()).toBe(false);
      expect(status.isArchived()).toBe(false);
    });

    it('should correctly identify published status', () => {
      const status = ContentStatus.published();
      
      expect(status.isDraft()).toBe(false);
      expect(status.isPublished()).toBe(true);
      expect(status.isArchived()).toBe(false);
    });

    it('should correctly identify archived status', () => {
      const status = ContentStatus.archived();
      
      expect(status.isDraft()).toBe(false);
      expect(status.isPublished()).toBe(false);
      expect(status.isArchived()).toBe(true);
    });
  });

  describe('canTransitionTo', () => {
    it('should allow draft to published transition', () => {
      const draft = ContentStatus.draft();
      const published = ContentStatus.published();
      
      expect(draft.canTransitionTo(published)).toBe(true);
    });

    it('should allow draft to archived transition', () => {
      const draft = ContentStatus.draft();
      const archived = ContentStatus.archived();
      
      expect(draft.canTransitionTo(archived)).toBe(true);
    });

    it('should allow published to draft transition', () => {
      const published = ContentStatus.published();
      const draft = ContentStatus.draft();
      
      expect(published.canTransitionTo(draft)).toBe(true);
    });

    it('should allow published to archived transition', () => {
      const published = ContentStatus.published();
      const archived = ContentStatus.archived();
      
      expect(published.canTransitionTo(archived)).toBe(true);
    });

    it('should allow archived to draft transition', () => {
      const archived = ContentStatus.archived();
      const draft = ContentStatus.draft();
      
      expect(archived.canTransitionTo(draft)).toBe(true);
    });

    it('should allow archived to published transition', () => {
      const archived = ContentStatus.archived();
      const published = ContentStatus.published();
      
      expect(archived.canTransitionTo(published)).toBe(true);
    });

    it('should not allow transition to same status', () => {
      const draft = ContentStatus.draft();
      const anotherDraft = ContentStatus.draft();
      
      expect(draft.canTransitionTo(anotherDraft)).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for same status values', () => {
      const status1 = ContentStatus.draft();
      const status2 = ContentStatus.draft();
      
      expect(status1.equals(status2)).toBe(true);
    });

    it('should return false for different status values', () => {
      const draft = ContentStatus.draft();
      const published = ContentStatus.published();
      
      expect(draft.equals(published)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the status string value', () => {
      const draft = ContentStatus.draft();
      const published = ContentStatus.published();
      const archived = ContentStatus.archived();
      
      expect(draft.toString()).toBe('draft');
      expect(published.toString()).toBe('published');
      expect(archived.toString()).toBe('archived');
    });
  });

  describe('toDisplayString', () => {
    it('should return formatted display strings', () => {
      const draft = ContentStatus.draft();
      const published = ContentStatus.published();
      const archived = ContentStatus.archived();
      
      expect(draft.toDisplayString()).toBe('Draft');
      expect(published.toDisplayString()).toBe('Published');
      expect(archived.toDisplayString()).toBe('Archived');
    });
  });
});