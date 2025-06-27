import { describe, it, expect } from 'bun:test';
import { MediaId } from '../../../../src/domain/cms/valueObjects/MediaId';

describe('MediaId', () => {
  describe('create', () => {
    it('should create a MediaId with auto-generated UUID', () => {
      const mediaId = MediaId.create();
      
      expect(typeof mediaId.value).toBe('string');
      expect(mediaId.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should create unique MediaIds on multiple calls', () => {
      const mediaId1 = MediaId.create();
      const mediaId2 = MediaId.create();
      
      expect(mediaId1.value).not.toBe(mediaId2.value);
    });
  });

  describe('fromString', () => {
    it('should create MediaId from valid UUID string', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const mediaId = MediaId.fromString(uuid);
      
      expect(mediaId.value).toBe(uuid);
    });

    it('should throw error for invalid UUID format', () => {
      expect(() => MediaId.fromString('invalid-uuid')).toThrow('Invalid Media ID');
    });

    it('should throw error for empty string', () => {
      expect(() => MediaId.fromString('')).toThrow('Invalid Media ID');
    });

    it('should throw error for non-string input', () => {
      // @ts-expect-error Testing invalid input type
      expect(() => MediaId.fromString(123)).toThrow('Invalid Media ID');
    });
  });

  describe('value', () => {
    it('should return the internal UUID value', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const mediaId = MediaId.fromString(uuid);
      
      expect(mediaId.value).toBe(uuid);
    });
  });

  describe('equals', () => {
    it('should return true for same UUID values', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const mediaId1 = MediaId.fromString(uuid);
      const mediaId2 = MediaId.fromString(uuid);
      
      expect(mediaId1.equals(mediaId2)).toBe(true);
    });

    it('should return false for different UUID values', () => {
      const mediaId1 = MediaId.fromString('123e4567-e89b-12d3-a456-426614174000');
      const mediaId2 = MediaId.fromString('987fcdeb-51a2-43d7-8765-123456789abc');
      
      expect(mediaId1.equals(mediaId2)).toBe(false);
    });

    it('should return false for created vs fromString with different values', () => {
      const mediaId1 = MediaId.create();
      const mediaId2 = MediaId.fromString('123e4567-e89b-12d3-a456-426614174000');
      
      expect(mediaId1.equals(mediaId2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the UUID string', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const mediaId = MediaId.fromString(uuid);
      
      expect(mediaId.toString()).toBe(uuid);
    });

    it('should return valid UUID string for created MediaId', () => {
      const mediaId = MediaId.create();
      const uuidString = mediaId.toString();
      
      expect(uuidString).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });
});