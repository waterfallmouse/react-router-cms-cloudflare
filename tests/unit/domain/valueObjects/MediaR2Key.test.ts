import { describe, it, expect } from 'bun:test';
import { MediaR2Key } from '../../../../src/domain/cms/valueObjects/MediaR2Key';

describe('MediaR2Key', () => {
  describe('create', () => {
    it('should create MediaR2Key with valid key', () => {
      const key = 'images/photo.jpg';
      const mediaR2Key = MediaR2Key.create(key);
      
      expect(mediaR2Key.value).toBe(key);
    });

    it('should trim whitespace from key', () => {
      const key = '  images/photo.jpg  ';
      const mediaR2Key = MediaR2Key.create(key);
      
      expect(mediaR2Key.value).toBe('images/photo.jpg');
    });

    it('should throw error for empty key', () => {
      expect(() => MediaR2Key.create('')).toThrow('Invalid R2 key');
    });

    it('should throw error for key exceeding 1024 characters', () => {
      const longKey = 'a'.repeat(1025);
      expect(() => MediaR2Key.create(longKey)).toThrow('Invalid R2 key');
    });

    it('should accept key with allowed characters', () => {
      const key = 'images/photo_2024-01-01.final.jpg';
      const mediaR2Key = MediaR2Key.create(key);
      
      expect(mediaR2Key.value).toBe(key);
    });

    it('should throw error for key with invalid characters', () => {
      expect(() => MediaR2Key.create('images/photo<>.jpg')).toThrow('Invalid R2 key');
      expect(() => MediaR2Key.create('images/photo|file.jpg')).toThrow('Invalid R2 key');
      expect(() => MediaR2Key.create('images/photo?name.jpg')).toThrow('Invalid R2 key');
      expect(() => MediaR2Key.create('images/photo*file.jpg')).toThrow('Invalid R2 key');
      expect(() => MediaR2Key.create('images/photo file.jpg')).toThrow('Invalid R2 key');
    });

    it('should accept key with dots, underscores, hyphens, and slashes', () => {
      const key = 'content/media_files/image-2024.01.01.jpg';
      const mediaR2Key = MediaR2Key.create(key);
      
      expect(mediaR2Key.value).toBe(key);
    });
  });

  describe('fromFilename', () => {
    it('should create R2 key from filename with timestamp', () => {
      const filename = 'photo.jpg';
      const mediaR2Key = MediaR2Key.fromFilename(filename);
      
      expect(mediaR2Key.value).toMatch(/^\d+_photo\.jpg$/);
    });

    it('should create R2 key from filename with prefix', () => {
      const filename = 'photo.jpg';
      const prefix = 'images';
      const mediaR2Key = MediaR2Key.fromFilename(filename, prefix);
      
      expect(mediaR2Key.value).toMatch(/^images\/\d+_photo\.jpg$/);
    });

    it('should sanitize invalid characters in filename', () => {
      const filename = 'my photo <test>.jpg';
      const mediaR2Key = MediaR2Key.fromFilename(filename);
      
      expect(mediaR2Key.value).toMatch(/^\d+_my_photo__test_\.jpg$/);
    });

    it('should handle filename with multiple invalid characters', () => {
      const filename = 'file@#$%^&*()name.jpg';
      const mediaR2Key = MediaR2Key.fromFilename(filename);
      
      expect(mediaR2Key.value).toMatch(/^\d+_file_________name\.jpg$/);
    });
  });

  describe('fromPath', () => {
    it('should create R2 key from path', () => {
      const path = 'images/subfolder/photo.jpg';
      const mediaR2Key = MediaR2Key.fromPath(path);
      
      expect(mediaR2Key.value).toBe('images/subfolder/photo.jpg');
    });

    it('should remove leading slashes', () => {
      const path = '/images/photo.jpg';
      const mediaR2Key = MediaR2Key.fromPath(path);
      
      expect(mediaR2Key.value).toBe('images/photo.jpg');
    });

    it('should normalize multiple slashes', () => {
      const path = 'images//subfolder///photo.jpg';
      const mediaR2Key = MediaR2Key.fromPath(path);
      
      expect(mediaR2Key.value).toBe('images/subfolder/photo.jpg');
    });

    it('should sanitize invalid characters', () => {
      const path = 'images/sub folder/photo<test>.jpg';
      const mediaR2Key = MediaR2Key.fromPath(path);
      
      expect(mediaR2Key.value).toBe('images/sub_folder/photo_test_.jpg');
    });
  });

  describe('forContent', () => {
    it('should create R2 key for content with content ID prefix', () => {
      const contentId = 'content-123';
      const filename = 'image.jpg';
      const mediaR2Key = MediaR2Key.forContent(contentId, filename);
      
      expect(mediaR2Key.value).toMatch(new RegExp(`^content/${contentId}/\\d+_image\\.jpg$`));
    });
  });

  describe('forMedia', () => {
    it('should create R2 key for media with media ID prefix', () => {
      const mediaId = 'media-456';
      const filename = 'photo.jpg';
      const mediaR2Key = MediaR2Key.forMedia(mediaId, filename);
      
      expect(mediaR2Key.value).toMatch(new RegExp(`^media/${mediaId}/\\d+_photo\\.jpg$`));
    });
  });

  describe('value', () => {
    it('should return the internal key value', () => {
      const key = 'images/photo.jpg';
      const mediaR2Key = MediaR2Key.create(key);
      
      expect(mediaR2Key.value).toBe(key);
    });
  });

  describe('length', () => {
    it('should return key length', () => {
      const key = 'images/photo.jpg';
      const mediaR2Key = MediaR2Key.create(key);
      
      expect(mediaR2Key.length).toBe(key.length);
    });
  });

  describe('filename', () => {
    it('should return filename from key with path', () => {
      const mediaR2Key = MediaR2Key.create('images/subfolder/photo.jpg');
      
      expect(mediaR2Key.filename).toBe('photo.jpg');
    });

    it('should return filename when key has no path', () => {
      const mediaR2Key = MediaR2Key.create('photo.jpg');
      
      expect(mediaR2Key.filename).toBe('photo.jpg');
    });

    it('should handle key ending with slash', () => {
      const mediaR2Key = MediaR2Key.create('images/subfolder/');
      
      expect(mediaR2Key.filename).toBe('');
    });
  });

  describe('directory', () => {
    it('should return directory from key with path', () => {
      const mediaR2Key = MediaR2Key.create('images/subfolder/photo.jpg');
      
      expect(mediaR2Key.directory).toBe('images/subfolder');
    });

    it('should return empty string when key has no directory', () => {
      const mediaR2Key = MediaR2Key.create('photo.jpg');
      
      expect(mediaR2Key.directory).toBe('');
    });

    it('should handle nested directories', () => {
      const mediaR2Key = MediaR2Key.create('content/images/2024/photo.jpg');
      
      expect(mediaR2Key.directory).toBe('content/images/2024');
    });
  });

  describe('extension', () => {
    it('should return file extension from filename', () => {
      const mediaR2Key = MediaR2Key.create('images/photo.jpg');
      
      expect(mediaR2Key.extension).toBe('.jpg');
    });

    it('should return empty string for filename without extension', () => {
      const mediaR2Key = MediaR2Key.create('images/document');
      
      expect(mediaR2Key.extension).toBe('');
    });

    it('should handle multiple dots in filename', () => {
      const mediaR2Key = MediaR2Key.create('images/photo.final.jpg');
      
      expect(mediaR2Key.extension).toBe('.jpg');
    });
  });

  describe('hasPrefix', () => {
    it('should return true when key starts with prefix', () => {
      const mediaR2Key = MediaR2Key.create('images/photo.jpg');
      
      expect(mediaR2Key.hasPrefix('images')).toBe(true);
    });

    it('should return false when key does not start with prefix', () => {
      const mediaR2Key = MediaR2Key.create('documents/file.pdf');
      
      expect(mediaR2Key.hasPrefix('images')).toBe(false);
    });

    it('should handle exact prefix matches only', () => {
      const mediaR2Key = MediaR2Key.create('images/photo.jpg');
      
      expect(mediaR2Key.hasPrefix('images')).toBe(true);
      expect(mediaR2Key.hasPrefix('image')).toBe(true);
    });
  });

  describe('isInDirectory', () => {
    it('should return true when key is in specified directory', () => {
      const mediaR2Key = MediaR2Key.create('images/photo.jpg');
      
      expect(mediaR2Key.isInDirectory('images')).toBe(true);
    });

    it('should return false when key is not in specified directory', () => {
      const mediaR2Key = MediaR2Key.create('documents/file.pdf');
      
      expect(mediaR2Key.isInDirectory('images')).toBe(false);
    });

    it('should handle directory with trailing slash', () => {
      const mediaR2Key = MediaR2Key.create('images/photo.jpg');
      
      expect(mediaR2Key.isInDirectory('images/')).toBe(true);
    });

    it('should handle nested directories', () => {
      const mediaR2Key = MediaR2Key.create('content/images/2024/photo.jpg');
      
      expect(mediaR2Key.isInDirectory('content/images/2024')).toBe(true);
      expect(mediaR2Key.isInDirectory('content/images')).toBe(true);
    });
  });

  describe('withPrefix', () => {
    it('should create new R2 key with prefix', () => {
      const mediaR2Key = MediaR2Key.create('photo.jpg');
      const prefixedKey = mediaR2Key.withPrefix('images');
      
      expect(prefixedKey.value).toBe('images/photo.jpg');
      expect(mediaR2Key.value).toBe('photo.jpg'); // Original unchanged
    });

    it('should handle prefix with trailing slash', () => {
      const mediaR2Key = MediaR2Key.create('photo.jpg');
      const prefixedKey = mediaR2Key.withPrefix('images/');
      
      expect(prefixedKey.value).toBe('images/photo.jpg');
    });

    it('should handle key that already has a path', () => {
      const mediaR2Key = MediaR2Key.create('subfolder/photo.jpg');
      const prefixedKey = mediaR2Key.withPrefix('images');
      
      expect(prefixedKey.value).toBe('images/subfolder/photo.jpg');
    });
  });

  describe('withSuffix', () => {
    it('should create new R2 key with suffix before extension', () => {
      const mediaR2Key = MediaR2Key.create('photo.jpg');
      const suffixedKey = mediaR2Key.withSuffix('_thumb');
      
      expect(suffixedKey.value).toBe('photo_thumb.jpg');
      expect(mediaR2Key.value).toBe('photo.jpg'); // Original unchanged
    });

    it('should handle filename without extension', () => {
      const mediaR2Key = MediaR2Key.create('document');
      const suffixedKey = mediaR2Key.withSuffix('_backup');
      
      expect(suffixedKey.value).toBe('document_backup');
    });

    it('should handle key with path', () => {
      const mediaR2Key = MediaR2Key.create('images/photo.jpg');
      const suffixedKey = mediaR2Key.withSuffix('_large');
      
      expect(suffixedKey.value).toBe('images/photo_large.jpg');
    });

    it('should handle multiple dots in filename', () => {
      const mediaR2Key = MediaR2Key.create('photo.final.jpg');
      const suffixedKey = mediaR2Key.withSuffix('_v2');
      
      expect(suffixedKey.value).toBe('photo.final_v2.jpg');
    });
  });

  describe('equals', () => {
    it('should return true for same key values', () => {
      const key = 'images/photo.jpg';
      const mediaR2Key1 = MediaR2Key.create(key);
      const mediaR2Key2 = MediaR2Key.create(key);
      
      expect(mediaR2Key1.equals(mediaR2Key2)).toBe(true);
    });

    it('should return false for different key values', () => {
      const mediaR2Key1 = MediaR2Key.create('images/photo1.jpg');
      const mediaR2Key2 = MediaR2Key.create('images/photo2.jpg');
      
      expect(mediaR2Key1.equals(mediaR2Key2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the key string', () => {
      const key = 'images/photo.jpg';
      const mediaR2Key = MediaR2Key.create(key);
      
      expect(mediaR2Key.toString()).toBe(key);
    });
  });
});