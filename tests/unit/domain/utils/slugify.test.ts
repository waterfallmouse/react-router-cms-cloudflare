import { describe, it, expect } from 'bun:test';
import { slugifyTitle } from '../../../../src/domain/cms/utils/slugify';

describe('slugifyTitle', () => {
  it('should convert title to lowercase slug', () => {
    const result = slugifyTitle('My Blog Post Title');
    
    expect(result).toBe('my-blog-post-title');
  });

  it('should handle special characters', () => {
    const result = slugifyTitle('My Blog Post! & Other Things');
    
    expect(result).toBe('my-blog-post-other-things');
  });

  it('should handle multiple spaces and underscores', () => {
    const result = slugifyTitle('My   Blog__Post   Title');
    
    expect(result).toBe('my-blog-post-title');
  });

  it('should trim leading and trailing hyphens', () => {
    const result = slugifyTitle('--My Blog Post--');
    
    expect(result).toBe('my-blog-post');
  });

  it('should handle unicode characters', () => {
    const result = slugifyTitle('Café & Résumé');
    
    expect(result).toBe('caf-rsum');
  });

  it('should handle mixed whitespace and separators', () => {
    const result = slugifyTitle('Hello \t World\n-_Test');
    
    expect(result).toBe('hello-world-test');
  });

  it('should handle empty string', () => {
    const result = slugifyTitle('');
    
    expect(result).toBe('');
  });

  it('should handle whitespace-only string', () => {
    const result = slugifyTitle('   ');
    
    expect(result).toBe('');
  });

  it('should handle string with only special characters', () => {
    const result = slugifyTitle('!@#$%^&*()');
    
    expect(result).toBe('');
  });

  it('should preserve numbers', () => {
    const result = slugifyTitle('Blog Post 2024 v2');
    
    expect(result).toBe('blog-post-2024-v2');
  });

  it('should handle consecutive hyphens', () => {
    const result = slugifyTitle('My---Blog---Post');
    
    expect(result).toBe('my-blog-post');
  });

  it('should handle mixed case with numbers', () => {
    const result = slugifyTitle('React18 TypeScript5 Tutorial');
    
    expect(result).toBe('react18-typescript5-tutorial');
  });
});