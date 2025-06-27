import { describe, it, expect } from 'bun:test';
import { ContentBody } from '../../../../src/domain/cms/valueObjects/ContentBody';

describe('ContentBody', () => {
  describe('create', () => {
    it('should create a ContentBody with valid content', () => {
      const content = 'This is my blog post content.';
      const contentBody = ContentBody.create(content);
      
      expect(contentBody.value).toBe(content);
    });

    it('should throw error for empty content', () => {
      expect(() => ContentBody.create('')).toThrow('Content body is required');
    });

    it('should throw error for content longer than 50,000 characters', () => {
      const longContent = 'a'.repeat(50001);
      expect(() => ContentBody.create(longContent)).toThrow('Content body must be less than 50,000 characters');
    });

    it('should accept content with exactly 50,000 characters', () => {
      const content = 'a'.repeat(50000);
      const contentBody = ContentBody.create(content);
      
      expect(contentBody.value).toBe(content);
      expect(contentBody.length).toBe(50000);
    });
  });

  describe('length', () => {
    it('should return the correct length of the content', () => {
      const contentBody = ContentBody.create('Hello World');
      
      expect(contentBody.length).toBe(11);
    });
  });

  describe('wordCount', () => {
    it('should count words correctly', () => {
      const contentBody = ContentBody.create('This is a test content with seven words.');
      
      expect(contentBody.wordCount).toBe(8);
    });

    it('should handle multiple spaces between words', () => {
      const contentBody = ContentBody.create('This  is   a    test');
      
      expect(contentBody.wordCount).toBe(4);
    });

    it('should handle newlines and tabs', () => {
      const contentBody = ContentBody.create('This\nis\ta\ntest');
      
      expect(contentBody.wordCount).toBe(4);
    });

    it('should return 0 for empty content after trimming', () => {
      const contentBody = ContentBody.create(' ');
      
      expect(contentBody.wordCount).toBe(0);
    });
  });

  describe('isEmpty', () => {
    it('should return false for non-empty content', () => {
      const contentBody = ContentBody.create('Hello World');
      
      expect(contentBody.isEmpty()).toBe(false);
    });

    it('should return true for whitespace-only content', () => {
      const contentBody = ContentBody.create('   ');
      
      expect(contentBody.isEmpty()).toBe(true);
    });
  });

  describe('equals', () => {
    it('should return true for identical content', () => {
      const content1 = ContentBody.create('Same content');
      const content2 = ContentBody.create('Same content');
      
      expect(content1.equals(content2)).toBe(true);
    });

    it('should return false for different content', () => {
      const content1 = ContentBody.create('Content one');
      const content2 = ContentBody.create('Content two');
      
      expect(content1.equals(content2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the content string', () => {
      const content = 'My blog post content';
      const contentBody = ContentBody.create(content);
      
      expect(contentBody.toString()).toBe(content);
    });
  });

  describe('getExcerpt', () => {
    it('should return full content if shorter than maxLength', () => {
      const content = 'Short content';
      const contentBody = ContentBody.create(content);
      
      expect(contentBody.getExcerpt(100)).toBe(content);
    });

    it('should truncate content at word boundary', () => {
      const content = 'This is a long piece of content that should be truncated at a word boundary.';
      const contentBody = ContentBody.create(content);
      
      const excerpt = contentBody.getExcerpt(50);
      expect(excerpt).toBe('This is a long piece of content that should be...');
      expect(excerpt.length).toBeLessThan(content.length);
    });

    it('should truncate at character limit if no word boundary found', () => {
      const content = 'Averylongwordwithoutanyspacesorbreaksthatcannotbetruncatedatwordboundary';
      const contentBody = ContentBody.create(content);
      
      const excerpt = contentBody.getExcerpt(50);
      expect(excerpt).toBe('Averylongwordwithoutanyspacesorbreaksthatcannotbet...');
      expect(excerpt.length).toBe(53); // 50 + '...'
    });

    it('should use default maxLength of 200', () => {
      const content = 'a'.repeat(300);
      const contentBody = ContentBody.create(content);
      
      const excerpt = contentBody.getExcerpt();
      expect(excerpt.length).toBe(203); // 200 + '...'
    });
  });

  describe('hasMarkdown', () => {
    it('should detect headers', () => {
      const contentBody = ContentBody.create('# This is a header');
      
      expect(contentBody.hasMarkdown()).toBe(true);
    });

    it('should detect bold text', () => {
      const contentBody = ContentBody.create('This is **bold** text');
      
      expect(contentBody.hasMarkdown()).toBe(true);
    });

    it('should detect italic text', () => {
      const contentBody = ContentBody.create('This is *italic* text');
      
      expect(contentBody.hasMarkdown()).toBe(true);
    });

    it('should detect code blocks', () => {
      const contentBody = ContentBody.create('```\nconst x = 1;\n```');
      
      expect(contentBody.hasMarkdown()).toBe(true);
    });

    it('should detect inline code', () => {
      const contentBody = ContentBody.create('Use `console.log()` for debugging');
      
      expect(contentBody.hasMarkdown()).toBe(true);
    });

    it('should detect links', () => {
      const contentBody = ContentBody.create('Check out [this link](https://example.com)');
      
      expect(contentBody.hasMarkdown()).toBe(true);
    });

    it('should detect unordered lists', () => {
      const contentBody = ContentBody.create('- Item 1\n- Item 2');
      
      expect(contentBody.hasMarkdown()).toBe(true);
    });

    it('should detect ordered lists', () => {
      const contentBody = ContentBody.create('1. First item\n2. Second item');
      
      expect(contentBody.hasMarkdown()).toBe(true);
    });

    it('should return false for plain text', () => {
      const contentBody = ContentBody.create('This is just plain text without any markdown.');
      
      expect(contentBody.hasMarkdown()).toBe(false);
    });
  });
});