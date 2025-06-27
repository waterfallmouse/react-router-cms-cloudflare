import { describe, it, expect, beforeEach } from 'bun:test';
import { ContentDomainService } from '../../../../src/domain/cms/services/ContentDomainService';
import { ContentTitle } from '../../../../src/domain/cms/valueObjects/ContentTitle';
import { ContentSlug } from '../../../../src/domain/cms/valueObjects/ContentSlug';
import { ContentId } from '../../../../src/domain/cms/valueObjects/ContentId';

describe('ContentDomainService', () => {
  let service: ContentDomainService;

  beforeEach(() => {
    service = new ContentDomainService();
  });

  describe('generateUniqueSlug', () => {
    it('should return base slug when it is unique', async () => {
      const title = ContentTitle.create('My Test Title');
      const slugCheckFn = async (slug: ContentSlug, excludeContentId?: ContentId) => false; // Not taken
      
      const result = await service.generateUniqueSlug(title, slugCheckFn);
      
      expect(result.value).toBe('my-test-title');
    });

    it('should append suffix when base slug is taken', async () => {
      const title = ContentTitle.create('My Test Title');
      let callCount = 0;
      const slugCheckFn = async (slug: ContentSlug, excludeContentId?: ContentId) => {
        callCount++;
        return callCount === 1; // First call (base slug) is taken, second call (suffixed) is not
      };
      
      const result = await service.generateUniqueSlug(title, slugCheckFn);
      
      expect(result.value).toBe('my-test-title-1');
    });

    it('should increment suffix until unique slug is found', async () => {
      const title = ContentTitle.create('Popular Title');
      let callCount = 0;
      const slugCheckFn = async (slug: ContentSlug, excludeContentId?: ContentId) => {
        callCount++;
        return callCount <= 3; // First 3 calls are taken, 4th is not
      };
      
      const result = await service.generateUniqueSlug(title, slugCheckFn);
      
      expect(result.value).toBe('popular-title-3');
    });

    it('should throw error when unable to generate unique slug after 1000 attempts', async () => {
      const title = ContentTitle.create('Always Taken Title');
      const slugCheckFn = async (slug: ContentSlug, excludeContentId?: ContentId) => true; // Always taken
      
      await expect(service.generateUniqueSlug(title, slugCheckFn)).rejects.toThrow('Unable to generate unique slug after 1000 attempts');
    });

    it('should work with excludeContentId parameter', async () => {
      const title = ContentTitle.create('Test Title');
      const excludeId = ContentId.create();
      const slugCheckFn = async (slug: ContentSlug, excludeContentId?: ContentId) => {
        // When excludeContentId is provided, simulate that the slug exists but belongs to the excluded content
        return excludeContentId ? false : true;
      };
      
      const result = await service.generateUniqueSlug(title, slugCheckFn, excludeId);
      
      expect(result.value).toBe('test-title');
    });
  });

  describe('validateSlugUniqueness', () => {
    it('should not throw when slug is unique', async () => {
      const slug = ContentSlug.create('unique-slug');
      const slugCheckFn = async (slug: ContentSlug, excludeContentId?: ContentId) => false; // Not taken
      
      await expect(service.validateSlugUniqueness(slug, slugCheckFn)).resolves.toBeUndefined();
    });

    it('should throw when slug is already taken', async () => {
      const slug = ContentSlug.create('taken-slug');
      const slugCheckFn = async (slug: ContentSlug, excludeContentId?: ContentId) => true; // Taken
      
      await expect(service.validateSlugUniqueness(slug, slugCheckFn)).rejects.toThrow('Slug "taken-slug" is already in use');
    });

    it('should work with excludeContentId parameter', async () => {
      const slug = ContentSlug.create('test-slug');
      const excludeId = ContentId.create();
      const slugCheckFn = async (slug: ContentSlug, excludeContentId?: ContentId) => {
        // When excludeContentId is provided, simulate that slug belongs to excluded content
        return excludeContentId ? false : true;
      };
      
      await expect(service.validateSlugUniqueness(slug, slugCheckFn, excludeId)).resolves.toBeUndefined();
    });
  });

  describe('validateTitleAndSlugConsistency', () => {
    it('should not throw for consistent title and slug', () => {
      const title = ContentTitle.create('My Test Title');
      const slug = ContentSlug.create('my-test-title');
      
      expect(() => service.validateTitleAndSlugConsistency(title, slug)).not.toThrow();
    });

    it('should not throw for reasonable custom slug variations', () => {
      const title = ContentTitle.create('My Test Title');
      const slug = ContentSlug.create('my-custom-slug');
      
      expect(() => service.validateTitleAndSlugConsistency(title, slug)).not.toThrow();
    });

    it('should allow completely different but valid custom slugs', () => {
      const title = ContentTitle.create('Advanced JavaScript Tutorial');
      const slug = ContentSlug.create('js-guide-2024');
      
      expect(() => service.validateTitleAndSlugConsistency(title, slug)).not.toThrow();
    });

    it('should allow custom slugs that are shorter versions of the title slug', () => {
      const title = ContentTitle.create('My Very Long Article Title');
      const slug = ContentSlug.create('long-article');
      
      expect(() => service.validateTitleAndSlugConsistency(title, slug)).not.toThrow();
    });

    it('should throw for very short custom slug', () => {
      const title = ContentTitle.create('My Test Title');
      const slug = ContentSlug.create('ab');
      
      expect(() => service.validateTitleAndSlugConsistency(title, slug)).toThrow('Custom slug must be at least 3 characters long');
    });

    it('should throw for invalid slug format', () => {
      const title = ContentTitle.create('My Test Title');
      // This would fail during ContentSlug.create(), so we test the validation logic indirectly
      expect(() => {
        // Create a mock slug that bypasses validation for testing
        const mockSlug = {
          value: 'invalid slug format',
          isValid: () => false
        } as ContentSlug;
        service.validateTitleAndSlugConsistency(title, mockSlug);
      }).toThrow('Custom slug must be URL-friendly');
    });
  });

  describe('suggestSlugFromTitle', () => {
    it('should generate slug from title', () => {
      const title = ContentTitle.create('My Amazing Article');
      
      const result = service.suggestSlugFromTitle(title);
      
      expect(result.value).toBe('my-amazing-article');
    });

    it('should handle titles with special characters', () => {
      const title = ContentTitle.create('Hello, World! & More...');
      
      const result = service.suggestSlugFromTitle(title);
      
      expect(result.value).toBe('hello-world-more');
    });
  });

  describe('validateContentFields', () => {
    it('should not throw for valid content fields', () => {
      const title = ContentTitle.create('Valid Title');
      const slug = ContentSlug.create('valid-slug');
      const body = 'This is valid body content.';
      
      expect(() => service.validateContentFields(title, slug, body)).not.toThrow();
    });

    it('should throw for empty title', () => {
      // ContentTitle.create('   ') will throw before reaching our domain service
      expect(() => ContentTitle.create('   ')).toThrow('Title is required');
    });

    it('should throw for title exceeding 200 characters', () => {
      // ContentTitle.create() will throw before reaching our domain service
      expect(() => ContentTitle.create('a'.repeat(201))).toThrow('Title must be at most 200 characters');
    });

    it('should throw for slug exceeding 100 characters', () => {
      // ContentSlug.create() will throw before reaching our domain service
      expect(() => ContentSlug.create('a'.repeat(101))).toThrow('Slug must be at most 100 characters');
    });

    it('should throw for body exceeding 50,000 characters', () => {
      const title = ContentTitle.create('Valid Title');
      const slug = ContentSlug.create('valid-slug');
      const longBody = 'a'.repeat(50001);
      
      expect(() => service.validateContentFields(title, slug, longBody)).toThrow('Content body cannot exceed 50,000 characters');
    });

    it('should not validate body when undefined', () => {
      const title = ContentTitle.create('Valid Title');
      const slug = ContentSlug.create('valid-slug');
      
      expect(() => service.validateContentFields(title, slug)).not.toThrow();
    });
  });

  describe('validateContentForPublication', () => {
    it('should not throw for valid publication content', () => {
      const title = ContentTitle.create('Publication Ready Title');
      const body = 'This is sufficient body content for publication.';
      
      expect(() => service.validateContentForPublication(title, body)).not.toThrow();
    });

    it('should throw for empty title', () => {
      // ContentTitle.create('   ') will throw before reaching our domain service
      expect(() => ContentTitle.create('   ')).toThrow('Title is required');
    });

    it('should throw for empty body', () => {
      const title = ContentTitle.create('Valid Title');
      const body = '';
      
      expect(() => service.validateContentForPublication(title, body)).toThrow('Cannot publish content without body content');
    });

    it('should throw for whitespace-only body', () => {
      const title = ContentTitle.create('Valid Title');
      const body = '   \n\t   ';
      
      expect(() => service.validateContentForPublication(title, body)).toThrow('Cannot publish content without body content');
    });

    it('should throw for body shorter than 10 characters', () => {
      const title = ContentTitle.create('Valid Title');
      const body = 'Short';
      
      expect(() => service.validateContentForPublication(title, body)).toThrow('Content body must be at least 10 characters long for publication');
    });
  });

  describe('validateMediaForContent', () => {
    it('should not throw for valid media filename', () => {
      const filename = 'image.jpg';
      
      expect(() => service.validateMediaForContent(filename)).not.toThrow();
    });

    it('should throw for empty filename', () => {
      expect(() => service.validateMediaForContent('')).toThrow('Media filename cannot be empty');
    });

    it('should throw for whitespace-only filename', () => {
      expect(() => service.validateMediaForContent('   ')).toThrow('Media filename cannot be empty');
    });

    it('should throw for dangerous file extensions', () => {
      expect(() => service.validateMediaForContent('malware.exe')).toThrow('File type .exe is not allowed');
      expect(() => service.validateMediaForContent('script.bat')).toThrow('File type .bat is not allowed');
      expect(() => service.validateMediaForContent('program.com')).toThrow('File type .com is not allowed');
      expect(() => service.validateMediaForContent('screensaver.scr')).toThrow('File type .scr is not allowed');
      expect(() => service.validateMediaForContent('installer.pif')).toThrow('File type .pif is not allowed');
      expect(() => service.validateMediaForContent('command.cmd')).toThrow('File type .cmd is not allowed');
    });

    it('should handle case insensitive dangerous extensions', () => {
      expect(() => service.validateMediaForContent('MALWARE.EXE')).toThrow('File type .exe is not allowed');
      expect(() => service.validateMediaForContent('Script.BAT')).toThrow('File type .bat is not allowed');
    });

    it('should throw for filename exceeding 255 characters', () => {
      const longFilename = 'a'.repeat(256) + '.jpg';
      
      expect(() => service.validateMediaForContent(longFilename)).toThrow('Media filename cannot exceed 255 characters');
    });

    it('should accept safe file extensions', () => {
      expect(() => service.validateMediaForContent('image.jpg')).not.toThrow();
      expect(() => service.validateMediaForContent('document.pdf')).not.toThrow();
      expect(() => service.validateMediaForContent('data.csv')).not.toThrow();
      expect(() => service.validateMediaForContent('video.mp4')).not.toThrow();
    });
  });

  describe('validateSlugForSEO', () => {
    it('should not throw for SEO-friendly slug', () => {
      const slug = ContentSlug.create('seo-friendly-slug');
      
      expect(() => service.validateSlugForSEO(slug)).not.toThrow();
    });

    it('should throw for slug exceeding 60 characters', () => {
      const longSlug = ContentSlug.create('a'.repeat(61));
      
      expect(() => service.validateSlugForSEO(longSlug)).toThrow('For SEO purposes, slug should not exceed 60 characters');
    });

    it('should throw for slug shorter than 3 characters', () => {
      const shortSlug = ContentSlug.create('ab');
      
      expect(() => service.validateSlugForSEO(shortSlug)).toThrow('For SEO purposes, slug should be at least 3 characters');
    });

    it('should throw for slug with consecutive hyphens', () => {
      // This would typically fail at ContentSlug creation, but we test the business logic
      const mockSlug = {
        value: 'slug--with--double-hyphens',
        length: 25
      } as ContentSlug;
      
      expect(() => service.validateSlugForSEO(mockSlug)).toThrow('Slug should not contain consecutive hyphens');
    });

    it('should throw for slug starting with hyphen', () => {
      const mockSlug = {
        value: '-leading-hyphen',
        length: 15
      } as ContentSlug;
      
      expect(() => service.validateSlugForSEO(mockSlug)).toThrow('Slug should not start or end with a hyphen');
    });

    it('should throw for slug ending with hyphen', () => {
      const mockSlug = {
        value: 'trailing-hyphen-',
        length: 16
      } as ContentSlug;
      
      expect(() => service.validateSlugForSEO(mockSlug)).toThrow('Slug should not start or end with a hyphen');
    });

    it('should accept optimal SEO slug length', () => {
      const optimalSlug = ContentSlug.create('optimal-seo-slug-length');
      
      expect(() => service.validateSlugForSEO(optimalSlug)).not.toThrow();
    });
  });
});