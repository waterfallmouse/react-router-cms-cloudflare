import { describe, it, expect } from 'bun:test';
import { MediaFilename } from '../../../../src/domain/cms/valueObjects/MediaFilename';

describe('MediaFilename', () => {
  describe('create', () => {
    it('should create MediaFilename with valid filename', () => {
      const filename = 'test-image.jpg';
      const mediaFilename = MediaFilename.create(filename);
      
      expect(mediaFilename.value).toBe(filename);
    });

    it('should trim whitespace from filename', () => {
      const filename = '  test-image.jpg  ';
      const mediaFilename = MediaFilename.create(filename);
      
      expect(mediaFilename.value).toBe('test-image.jpg');
    });

    it('should throw error for empty filename', () => {
      expect(() => MediaFilename.create('')).toThrow('Invalid filename');
    });

    it('should throw error for filename with invalid characters', () => {
      expect(() => MediaFilename.create('test<>file.jpg')).toThrow('Invalid filename');
      expect(() => MediaFilename.create('test:file.jpg')).toThrow('Invalid filename');
      expect(() => MediaFilename.create('test"file.jpg')).toThrow('Invalid filename');
      expect(() => MediaFilename.create('test/file.jpg')).toThrow('Invalid filename');
      expect(() => MediaFilename.create('test\\file.jpg')).toThrow('Invalid filename');
      expect(() => MediaFilename.create('test|file.jpg')).toThrow('Invalid filename');
      expect(() => MediaFilename.create('test?file.jpg')).toThrow('Invalid filename');
      expect(() => MediaFilename.create('test*file.jpg')).toThrow('Invalid filename');
    });

    it('should throw error for filename exceeding 255 characters', () => {
      const longFilename = 'a'.repeat(256) + '.jpg';
      expect(() => MediaFilename.create(longFilename)).toThrow('Invalid filename');
    });

    it('should accept filename with valid special characters', () => {
      const filename = 'test_image-v2.final.jpg';
      const mediaFilename = MediaFilename.create(filename);
      
      expect(mediaFilename.value).toBe(filename);
    });
  });

  describe('fromOriginalName', () => {
    it('should create MediaFilename from original name', () => {
      const originalName = 'My Photo.jpg';
      const mediaFilename = MediaFilename.fromOriginalName(originalName);
      
      expect(mediaFilename.value).toMatch(/^\d+_My Photo\.jpg$/);
    });

    it('should sanitize invalid characters in original name', () => {
      const originalName = 'My<>Photo:test.jpg';
      const mediaFilename = MediaFilename.fromOriginalName(originalName);
      
      expect(mediaFilename.value).toMatch(/^\d+_My__Photo_test\.jpg$/);
    });

    it('should include contentId prefix when provided', () => {
      const originalName = 'photo.jpg';
      const contentId = 'content-123';
      const mediaFilename = MediaFilename.fromOriginalName(originalName, contentId);
      
      expect(mediaFilename.value).toMatch(new RegExp(`^${contentId}_\\d+_photo\\.jpg$`));
    });

    it('should throw error for empty original name after sanitization', () => {
      expect(() => MediaFilename.fromOriginalName('<>:"/\\|?*')).toThrow('Filename cannot be empty after sanitization');
    });

    it('should handle filename without extension', () => {
      const originalName = 'document';
      const mediaFilename = MediaFilename.fromOriginalName(originalName);
      
      expect(mediaFilename.value).toMatch(/^\d+_document$/);
    });
  });

  describe('value', () => {
    it('should return the internal filename value', () => {
      const filename = 'test-image.jpg';
      const mediaFilename = MediaFilename.create(filename);
      
      expect(mediaFilename.value).toBe(filename);
    });
  });

  describe('extension', () => {
    it('should return file extension with dot', () => {
      const mediaFilename = MediaFilename.create('image.jpg');
      
      expect(mediaFilename.extension).toBe('.jpg');
    });

    it('should return empty string for filename without extension', () => {
      const mediaFilename = MediaFilename.create('document');
      
      expect(mediaFilename.extension).toBe('');
    });

    it('should handle multiple dots in filename', () => {
      const mediaFilename = MediaFilename.create('image.final.jpg');
      
      expect(mediaFilename.extension).toBe('.jpg');
    });
  });

  describe('nameWithoutExtension', () => {
    it('should return filename without extension', () => {
      const mediaFilename = MediaFilename.create('image.jpg');
      
      expect(mediaFilename.nameWithoutExtension).toBe('image');
    });

    it('should return full filename when no extension exists', () => {
      const mediaFilename = MediaFilename.create('document');
      
      expect(mediaFilename.nameWithoutExtension).toBe('document');
    });

    it('should handle multiple dots correctly', () => {
      const mediaFilename = MediaFilename.create('image.final.jpg');
      
      expect(mediaFilename.nameWithoutExtension).toBe('image.final');
    });
  });

  describe('length', () => {
    it('should return filename length', () => {
      const filename = 'test-image.jpg';
      const mediaFilename = MediaFilename.create(filename);
      
      expect(mediaFilename.length).toBe(filename.length);
    });
  });

  describe('hasExtension', () => {
    it('should return true for matching extension (case insensitive)', () => {
      const mediaFilename = MediaFilename.create('image.JPG');
      
      expect(mediaFilename.hasExtension('.jpg')).toBe(true);
      expect(mediaFilename.hasExtension('.JPG')).toBe(true);
    });

    it('should return false for non-matching extension', () => {
      const mediaFilename = MediaFilename.create('image.jpg');
      
      expect(mediaFilename.hasExtension('.png')).toBe(false);
    });

    it('should return false for filename without extension', () => {
      const mediaFilename = MediaFilename.create('document');
      
      expect(mediaFilename.hasExtension('.jpg')).toBe(false);
    });
  });

  describe('isImage', () => {
    it('should return true for common image extensions', () => {
      expect(MediaFilename.create('image.jpg').isImage()).toBe(true);
      expect(MediaFilename.create('image.jpeg').isImage()).toBe(true);
      expect(MediaFilename.create('image.png').isImage()).toBe(true);
      expect(MediaFilename.create('image.gif').isImage()).toBe(true);
      expect(MediaFilename.create('image.webp').isImage()).toBe(true);
      expect(MediaFilename.create('image.svg').isImage()).toBe(true);
    });

    it('should return true for uppercase image extensions', () => {
      expect(MediaFilename.create('image.JPG').isImage()).toBe(true);
      expect(MediaFilename.create('image.PNG').isImage()).toBe(true);
    });

    it('should return false for non-image extensions', () => {
      expect(MediaFilename.create('document.pdf').isImage()).toBe(false);
      expect(MediaFilename.create('video.mp4').isImage()).toBe(false);
      expect(MediaFilename.create('audio.mp3').isImage()).toBe(false);
    });

    it('should return false for filename without extension', () => {
      expect(MediaFilename.create('document').isImage()).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for same filename values', () => {
      const filename = 'test-image.jpg';
      const mediaFilename1 = MediaFilename.create(filename);
      const mediaFilename2 = MediaFilename.create(filename);
      
      expect(mediaFilename1.equals(mediaFilename2)).toBe(true);
    });

    it('should return false for different filename values', () => {
      const mediaFilename1 = MediaFilename.create('image1.jpg');
      const mediaFilename2 = MediaFilename.create('image2.jpg');
      
      expect(mediaFilename1.equals(mediaFilename2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the filename string', () => {
      const filename = 'test-image.jpg';
      const mediaFilename = MediaFilename.create(filename);
      
      expect(mediaFilename.toString()).toBe(filename);
    });
  });
});