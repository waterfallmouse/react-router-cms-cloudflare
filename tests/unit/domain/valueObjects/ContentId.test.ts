import { describe, it, expect } from 'bun:test';
import { ContentId } from '../../../../src/domain/cms/valueObjects/ContentId';

describe('ContentId', () => {
  describe('create', () => {
    it('should create a ContentId with generated UUID when no value provided', () => {
      const contentId = ContentId.create();
      
      expect(contentId.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should create a ContentId with provided valid UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const contentId = ContentId.create(uuid);
      
      expect(contentId.value).toBe(uuid);
    });

    it('should throw error for invalid UUID format', () => {
      expect(() => ContentId.create('invalid-uuid')).toThrow();
    });

    it('should throw error for empty string', () => {
      expect(() => ContentId.create('')).toThrow();
    });
  });

  describe('fromString', () => {
    it('should create ContentId from valid UUID string', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const contentId = ContentId.fromString(uuid);
      
      expect(contentId.value).toBe(uuid);
    });

    it('should throw error for invalid UUID string', () => {
      expect(() => ContentId.fromString('not-a-uuid')).toThrow();
    });
  });

  describe('equals', () => {
    it('should return true for same UUID values', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const contentId1 = ContentId.fromString(uuid);
      const contentId2 = ContentId.fromString(uuid);
      
      expect(contentId1.equals(contentId2)).toBe(true);
    });

    it('should return false for different UUID values', () => {
      const contentId1 = ContentId.fromString('550e8400-e29b-41d4-a716-446655440000');
      const contentId2 = ContentId.fromString('550e8400-e29b-41d4-a716-446655440001');
      
      expect(contentId1.equals(contentId2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the UUID string value', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const contentId = ContentId.fromString(uuid);
      
      expect(contentId.toString()).toBe(uuid);
    });
  });

  describe('value getter', () => {
    it('should return the internal UUID value', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const contentId = ContentId.fromString(uuid);
      
      expect(contentId.value).toBe(uuid);
    });
  });
});