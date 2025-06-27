import { describe, it, expect } from 'bun:test';
import { ContentTitle } from '../../../../src/domain/cms/valueObjects/ContentTitle';

describe('ContentTitle', () => {
  describe('create', () => {
    it('should create a ContentTitle with valid title', () => {
      const title = 'My Blog Post Title';
      const contentTitle = ContentTitle.create(title);
      
      expect(contentTitle.value).toBe(title);
    });

    it('should trim whitespace from title', () => {
      const title = '  My Blog Post Title  ';
      const contentTitle = ContentTitle.create(title);
      
      expect(contentTitle.value).toBe('My Blog Post Title');
    });

    it('should throw error for empty title', () => {
      expect(() => ContentTitle.create('')).toThrow('Title is required');
    });

    it('should throw error for whitespace-only title', () => {
      expect(() => ContentTitle.create('   ')).toThrow('Title is required');
    });

    it('should throw error for title longer than 200 characters', () => {
      const longTitle = 'a'.repeat(201);
      expect(() => ContentTitle.create(longTitle)).toThrow('Title must be less than 200 characters');
    });

    it('should accept title with exactly 200 characters', () => {
      const title = 'a'.repeat(200);
      const contentTitle = ContentTitle.create(title);
      
      expect(contentTitle.value).toBe(title);
      expect(contentTitle.length).toBe(200);
    });
  });

  describe('length', () => {
    it('should return the correct length of the title', () => {
      const contentTitle = ContentTitle.create('Hello World');
      
      expect(contentTitle.length).toBe(11);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty title', () => {
      const contentTitle = ContentTitle.create('a');
      
      expect(contentTitle.isEmpty()).toBe(false);
    });

    it('should return false for non-empty title', () => {
      const contentTitle = ContentTitle.create('Hello');
      
      expect(contentTitle.isEmpty()).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for identical titles', () => {
      const title1 = ContentTitle.create('Same Title');
      const title2 = ContentTitle.create('Same Title');
      
      expect(title1.equals(title2)).toBe(true);
    });

    it('should return false for different titles', () => {
      const title1 = ContentTitle.create('Title One');
      const title2 = ContentTitle.create('Title Two');
      
      expect(title1.equals(title2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the title string', () => {
      const title = 'My Blog Post';
      const contentTitle = ContentTitle.create(title);
      
      expect(contentTitle.toString()).toBe(title);
    });
  });

  describe('toSlugSuggestion', () => {
    it('should convert title to valid slug format', () => {
      const contentTitle = ContentTitle.create('My Blog Post Title');
      
      expect(contentTitle.toSlugSuggestion()).toBe('my-blog-post-title');
    });

    it('should handle special characters', () => {
      const contentTitle = ContentTitle.create('My Blog Post! & Other Things');
      
      expect(contentTitle.toSlugSuggestion()).toBe('my-blog-post-other-things');
    });

    it('should handle multiple spaces and underscores', () => {
      const contentTitle = ContentTitle.create('My   Blog__Post   Title');
      
      expect(contentTitle.toSlugSuggestion()).toBe('my-blog-post-title');
    });

    it('should trim leading and trailing hyphens', () => {
      const contentTitle = ContentTitle.create('--My Blog Post--');
      
      expect(contentTitle.toSlugSuggestion()).toBe('my-blog-post');
    });

    it('should handle unicode characters', () => {
      const contentTitle = ContentTitle.create('Café & Résumé');
      
      expect(contentTitle.toSlugSuggestion()).toBe('caf-rsum');
    });
  });
});