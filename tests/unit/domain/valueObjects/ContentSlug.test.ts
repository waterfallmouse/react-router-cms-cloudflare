import { describe, it, expect } from 'bun:test';
import { ContentSlug } from '../../../../src/domain/cms/valueObjects/ContentSlug';

describe('ContentSlug', () => {
  describe('create', () => {
    it('should create a ContentSlug with valid slug', () => {
      const slug = 'my-blog-post';
      const contentSlug = ContentSlug.create(slug);
      
      expect(contentSlug.value).toBe(slug);
    });

    it('should throw error for invalid slug format', () => {
      expect(() => ContentSlug.create('My Blog Post')).toThrow('Slug must contain only lowercase letters, numbers, and hyphens');
    });

    it('should throw error for slug with uppercase letters', () => {
      expect(() => ContentSlug.create('My-Blog-Post')).toThrow();
    });

    it('should throw error for slug with spaces', () => {
      expect(() => ContentSlug.create('my blog post')).toThrow();
    });

    it('should throw error for slug with special characters', () => {
      expect(() => ContentSlug.create('my-blog-post!')).toThrow();
    });

    it('should throw error for empty slug', () => {
      expect(() => ContentSlug.create('')).toThrow('Slug is required');
    });

    it('should throw error for slug longer than 100 characters', () => {
      const longSlug = 'a'.repeat(101);
      expect(() => ContentSlug.create(longSlug)).toThrow('Slug must be less than 100 characters');
    });

    it('should accept valid slug with numbers', () => {
      const slug = 'my-blog-post-2024';
      const contentSlug = ContentSlug.create(slug);
      
      expect(contentSlug.value).toBe(slug);
    });
  });

  describe('fromTitle', () => {
    it('should create slug from simple title', () => {
      const contentSlug = ContentSlug.fromTitle('My Blog Post');
      
      expect(contentSlug.value).toBe('my-blog-post');
    });

    it('should handle special characters', () => {
      const contentSlug = ContentSlug.fromTitle('My Blog Post! & Other Things');
      
      expect(contentSlug.value).toBe('my-blog-post-other-things');
    });

    it('should handle multiple spaces', () => {
      const contentSlug = ContentSlug.fromTitle('My   Blog   Post');
      
      expect(contentSlug.value).toBe('my-blog-post');
    });

    it('should handle underscores', () => {
      const contentSlug = ContentSlug.fromTitle('My_Blog_Post');
      
      expect(contentSlug.value).toBe('my-blog-post');
    });

    it('should trim leading and trailing spaces', () => {
      const contentSlug = ContentSlug.fromTitle('  My Blog Post  ');
      
      expect(contentSlug.value).toBe('my-blog-post');
    });

    it('should handle empty title', () => {
      expect(() => ContentSlug.fromTitle('')).toThrow();
    });
  });

  describe('length', () => {
    it('should return the correct length of the slug', () => {
      const contentSlug = ContentSlug.create('hello-world');
      
      expect(contentSlug.length).toBe(11);
    });
  });

  describe('equals', () => {
    it('should return true for identical slugs', () => {
      const slug1 = ContentSlug.create('same-slug');
      const slug2 = ContentSlug.create('same-slug');
      
      expect(slug1.equals(slug2)).toBe(true);
    });

    it('should return false for different slugs', () => {
      const slug1 = ContentSlug.create('slug-one');
      const slug2 = ContentSlug.create('slug-two');
      
      expect(slug1.equals(slug2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the slug string', () => {
      const slug = 'my-blog-post';
      const contentSlug = ContentSlug.create(slug);
      
      expect(contentSlug.toString()).toBe(slug);
    });
  });

  describe('isValid', () => {
    it('should return true for valid slug', () => {
      const contentSlug = ContentSlug.create('valid-slug');
      
      expect(contentSlug.isValid()).toBe(true);
    });

    it('should return true for slug with numbers', () => {
      const contentSlug = ContentSlug.create('valid-slug-123');
      
      expect(contentSlug.isValid()).toBe(true);
    });
  });

  describe('withSuffix', () => {
    it('should append suffix to slug', () => {
      const contentSlug = ContentSlug.create('my-post');
      const newSlug = contentSlug.withSuffix('2024');
      
      expect(newSlug.value).toBe('my-post-2024');
    });

    it('should create valid slug with numeric suffix', () => {
      const contentSlug = ContentSlug.create('duplicate-post');
      const newSlug = contentSlug.withSuffix('1');
      
      expect(newSlug.value).toBe('duplicate-post-1');
      expect(newSlug.isValid()).toBe(true);
    });

    it('should handle multiple suffixes', () => {
      const contentSlug = ContentSlug.create('my-post');
      const newSlug = contentSlug.withSuffix('draft').withSuffix('v2');
      
      expect(newSlug.value).toBe('my-post-draft-v2');
    });
  });
});