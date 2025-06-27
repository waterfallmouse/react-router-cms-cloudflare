import { describe, it, expect } from 'bun:test';
import { MediaUrl } from '../../../../src/domain/cms/valueObjects/MediaUrl';

describe('MediaUrl', () => {
  describe('create', () => {
    it('should create MediaUrl with valid HTTPS URL', () => {
      const url = 'https://example.com/image.jpg';
      const mediaUrl = MediaUrl.create(url);
      
      expect(mediaUrl.value).toBe(url);
    });

    it('should create MediaUrl with valid HTTP URL', () => {
      const url = 'http://example.com/image.jpg';
      const mediaUrl = MediaUrl.create(url);
      
      expect(mediaUrl.value).toBe(url);
    });

    it('should throw error for invalid URL format', () => {
      expect(() => MediaUrl.create('not-a-url')).toThrow('Invalid media URL');
      expect(() => MediaUrl.create('ftp://example.com/file')).toThrow('Invalid media URL');
    });

    it('should throw error for empty URL', () => {
      expect(() => MediaUrl.create('')).toThrow('Invalid media URL');
    });

    it('should throw error for URL exceeding 2048 characters', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2048);
      expect(() => MediaUrl.create(longUrl)).toThrow('Invalid media URL');
    });

    it('should accept URL with query parameters', () => {
      const url = 'https://example.com/image.jpg?v=1&size=large';
      const mediaUrl = MediaUrl.create(url);
      
      expect(mediaUrl.value).toBe(url);
    });

    it('should accept URL with fragment', () => {
      const url = 'https://example.com/image.jpg#section1';
      const mediaUrl = MediaUrl.create(url);
      
      expect(mediaUrl.value).toBe(url);
    });
  });

  describe('fromR2', () => {
    it('should create MediaUrl from R2 bucket and key', () => {
      const bucketName = 'my-bucket';
      const r2Key = 'images/photo.jpg';
      const mediaUrl = MediaUrl.fromR2(bucketName, r2Key);
      
      expect(mediaUrl.value).toBe('https://my-bucket.r2.cloudflarestorage.com/images/photo.jpg');
    });

    it('should create MediaUrl from R2 with custom domain', () => {
      const bucketName = 'my-bucket';
      const r2Key = 'images/photo.jpg';
      const domain = 'https://cdn.example.com';
      const mediaUrl = MediaUrl.fromR2(bucketName, r2Key, domain);
      
      expect(mediaUrl.value).toBe('https://cdn.example.com/images/photo.jpg');
    });

    it('should handle R2 key without leading slash', () => {
      const bucketName = 'my-bucket';
      const r2Key = 'photo.jpg';
      const mediaUrl = MediaUrl.fromR2(bucketName, r2Key);
      
      expect(mediaUrl.value).toBe('https://my-bucket.r2.cloudflarestorage.com/photo.jpg');
    });

    it('should normalize R2 key with leading slash', () => {
      const bucketName = 'my-bucket';
      const r2Key = '/images/photo.jpg';
      const mediaUrl = MediaUrl.fromR2(bucketName, r2Key);
      
      expect(mediaUrl.value).toBe('https://my-bucket.r2.cloudflarestorage.com/images/photo.jpg');
    });

    it('should normalize R2 key with multiple leading slashes', () => {
      const bucketName = 'my-bucket';
      const r2Key = '///images/photo.jpg';
      const mediaUrl = MediaUrl.fromR2(bucketName, r2Key);
      
      expect(mediaUrl.value).toBe('https://my-bucket.r2.cloudflarestorage.com/images/photo.jpg');
    });
  });

  describe('fromCloudflareImages', () => {
    it('should create MediaUrl from Cloudflare Images with default variant', () => {
      const accountId = 'account123';
      const imageId = 'image456';
      const mediaUrl = MediaUrl.fromCloudflareImages(accountId, imageId);
      
      expect(mediaUrl.value).toBe('https://imagedelivery.net/account123/image456/public');
    });

    it('should create MediaUrl from Cloudflare Images with custom variant', () => {
      const accountId = 'account123';
      const imageId = 'image456';
      const variant = 'thumbnail';
      const mediaUrl = MediaUrl.fromCloudflareImages(accountId, imageId, variant);
      
      expect(mediaUrl.value).toBe('https://imagedelivery.net/account123/image456/thumbnail');
    });
  });

  describe('value', () => {
    it('should return the internal URL value', () => {
      const url = 'https://example.com/image.jpg';
      const mediaUrl = MediaUrl.create(url);
      
      expect(mediaUrl.value).toBe(url);
    });
  });

  describe('domain', () => {
    it('should return domain from URL', () => {
      const mediaUrl = MediaUrl.create('https://example.com/image.jpg');
      
      expect(mediaUrl.domain).toBe('example.com');
    });

    it('should return domain with subdomain', () => {
      const mediaUrl = MediaUrl.create('https://cdn.example.com/image.jpg');
      
      expect(mediaUrl.domain).toBe('cdn.example.com');
    });

    it('should handle port numbers', () => {
      const mediaUrl = MediaUrl.create('https://example.com:8080/image.jpg');
      
      expect(mediaUrl.domain).toBe('example.com');
    });
  });

  describe('protocol', () => {
    it('should return HTTPS protocol', () => {
      const mediaUrl = MediaUrl.create('https://example.com/image.jpg');
      
      expect(mediaUrl.protocol).toBe('https:');
    });

    it('should return HTTP protocol', () => {
      const mediaUrl = MediaUrl.create('http://example.com/image.jpg');
      
      expect(mediaUrl.protocol).toBe('http:');
    });
  });

  describe('path', () => {
    it('should return URL path', () => {
      const mediaUrl = MediaUrl.create('https://example.com/images/photo.jpg');
      
      expect(mediaUrl.path).toBe('/images/photo.jpg');
    });

    it('should return root path', () => {
      const mediaUrl = MediaUrl.create('https://example.com/');
      
      expect(mediaUrl.path).toBe('/');
    });

    it('should return path without query parameters', () => {
      const mediaUrl = MediaUrl.create('https://example.com/image.jpg?v=1');
      
      expect(mediaUrl.path).toBe('/image.jpg');
    });
  });

  describe('filename', () => {
    it('should return filename from URL path', () => {
      const mediaUrl = MediaUrl.create('https://example.com/images/photo.jpg');
      
      expect(mediaUrl.filename).toBe('photo.jpg');
    });

    it('should return filename from root path', () => {
      const mediaUrl = MediaUrl.create('https://example.com/photo.jpg');
      
      expect(mediaUrl.filename).toBe('photo.jpg');
    });

    it('should return empty string for directory path', () => {
      const mediaUrl = MediaUrl.create('https://example.com/images/');
      
      expect(mediaUrl.filename).toBe('');
    });
  });

  describe('isSecure', () => {
    it('should return true for HTTPS URLs', () => {
      const mediaUrl = MediaUrl.create('https://example.com/image.jpg');
      
      expect(mediaUrl.isSecure()).toBe(true);
    });

    it('should return false for HTTP URLs', () => {
      const mediaUrl = MediaUrl.create('http://example.com/image.jpg');
      
      expect(mediaUrl.isSecure()).toBe(false);
    });
  });

  describe('isCloudflareR2', () => {
    it('should return true for Cloudflare R2 storage URLs', () => {
      const mediaUrl = MediaUrl.create('https://my-bucket.r2.cloudflarestorage.com/image.jpg');
      
      expect(mediaUrl.isCloudflareR2()).toBe(true);
    });

    it('should return true for r2.dev URLs', () => {
      const mediaUrl = MediaUrl.create('https://my-bucket.r2.dev/image.jpg');
      
      expect(mediaUrl.isCloudflareR2()).toBe(true);
    });

    it('should return true for exact r2.dev domain', () => {
      const mediaUrl = MediaUrl.create('https://r2.dev/image.jpg');
      
      expect(mediaUrl.isCloudflareR2()).toBe(true);
    });

    it('should return false for non-R2 URLs', () => {
      const mediaUrl = MediaUrl.create('https://example.com/image.jpg');
      
      expect(mediaUrl.isCloudflareR2()).toBe(false);
    });

    it('should return false for malicious domains that contain R2 strings', () => {
      const maliciousUrl1 = MediaUrl.create('https://evil.r2.cloudflarestorage.com.attacker.com/image.jpg');
      const maliciousUrl2 = MediaUrl.create('https://malicious-r2.dev-fake.com/image.jpg');
      
      expect(maliciousUrl1.isCloudflareR2()).toBe(false);
      expect(maliciousUrl2.isCloudflareR2()).toBe(false);
    });
  });

  describe('isCloudflareImages', () => {
    it('should return true for Cloudflare Images URLs', () => {
      const mediaUrl = MediaUrl.create('https://imagedelivery.net/account/image/public');
      
      expect(mediaUrl.isCloudflareImages()).toBe(true);
    });

    it('should return false for non-Cloudflare Images URLs', () => {
      const mediaUrl = MediaUrl.create('https://example.com/image.jpg');
      
      expect(mediaUrl.isCloudflareImages()).toBe(false);
    });
  });

  describe('withVariant', () => {
    it('should create new MediaUrl with different variant for Cloudflare Images', () => {
      const originalUrl = MediaUrl.create('https://imagedelivery.net/account123/image456/public');
      const newUrl = originalUrl.withVariant('thumbnail');
      
      expect(newUrl.value).toBe('https://imagedelivery.net/account123/image456/thumbnail');
      expect(originalUrl.value).toBe('https://imagedelivery.net/account123/image456/public');
    });

    it('should throw error for non-Cloudflare Images URLs', () => {
      const mediaUrl = MediaUrl.create('https://example.com/image.jpg');
      
      expect(() => mediaUrl.withVariant('thumbnail')).toThrow('URL variant can only be applied to Cloudflare Images URLs');
    });

    it('should throw error for invalid Cloudflare Images URL format', () => {
      const mediaUrl = MediaUrl.create('https://imagedelivery.net/invalid');
      
      expect(() => mediaUrl.withVariant('thumbnail')).toThrow('Invalid Cloudflare Images URL format');
    });
  });

  describe('equals', () => {
    it('should return true for same URL values', () => {
      const url = 'https://example.com/image.jpg';
      const mediaUrl1 = MediaUrl.create(url);
      const mediaUrl2 = MediaUrl.create(url);
      
      expect(mediaUrl1.equals(mediaUrl2)).toBe(true);
    });

    it('should return false for different URL values', () => {
      const mediaUrl1 = MediaUrl.create('https://example.com/image1.jpg');
      const mediaUrl2 = MediaUrl.create('https://example.com/image2.jpg');
      
      expect(mediaUrl1.equals(mediaUrl2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the URL string', () => {
      const url = 'https://example.com/image.jpg';
      const mediaUrl = MediaUrl.create(url);
      
      expect(mediaUrl.toString()).toBe(url);
    });
  });
});