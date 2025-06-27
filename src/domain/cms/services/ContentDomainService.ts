import { ContentSlug } from '../valueObjects/ContentSlug';
import { ContentTitle } from '../valueObjects/ContentTitle';
import { ContentId } from '../valueObjects/ContentId';

export class ContentDomainService {
  /**
   * Generates a unique slug from a title by checking for existing slugs
   * and appending a suffix if necessary
   */
  async generateUniqueSlug(
    title: ContentTitle,
    slugCheckFn: (slug: ContentSlug, excludeContentId?: ContentId) => Promise<boolean>,
    excludeContentId?: ContentId
  ): Promise<ContentSlug> {
    const baseSlug = ContentSlug.fromTitle(title.value);
    
    // Check if the base slug is unique
    const isBaseSlugTaken = await slugCheckFn(baseSlug, excludeContentId);
    if (!isBaseSlugTaken) {
      return baseSlug;
    }
    
    // Generate suffixed versions until we find one that's unique
    let counter = 1;
    let uniqueSlug: ContentSlug;
    
    do {
      uniqueSlug = baseSlug.withSuffix(counter.toString());
      const isTaken = await slugCheckFn(uniqueSlug, excludeContentId);
      
      if (!isTaken) {
        return uniqueSlug;
      }
      
      counter++;
      
      // Safety check to prevent infinite loops
      if (counter > 1000) {
        throw new Error('Unable to generate unique slug after 1000 attempts');
      }
    } while (true);
  }

  /**
   * Validates that a slug is unique for content creation/update
   */
  async validateSlugUniqueness(
    slug: ContentSlug,
    slugCheckFn: (slug: ContentSlug, excludeContentId?: ContentId) => Promise<boolean>,
    excludeContentId?: ContentId
  ): Promise<void> {
    const isSlugTaken = await slugCheckFn(slug, excludeContentId);
    
    if (isSlugTaken) {
      throw new Error(`Slug "${slug.value}" is already in use`);
    }
  }

  /**
   * Validates that a title and slug are consistent
   */
  validateTitleAndSlugConsistency(title: ContentTitle, slug: ContentSlug): void {
    const suggestedSlug = ContentSlug.fromTitle(title.value);
    
    if (slug.value !== suggestedSlug.value) {
      // This is a soft validation - we allow custom slugs but ensure they're reasonable
      // Custom slugs must be consistent with the title-derived slug or meet specific criteria
      
      if (slug.value.length < 3) {
        throw new Error('Custom slug must be at least 3 characters long');
      }
      
      if (!slug.isValid()) {
        throw new Error('Custom slug must be URL-friendly');
      }
      
      // Optional: Check if custom slug has some relation to the title
      // For now, we allow any valid custom slug that meets basic criteria
    }
  }

  /**
   * Suggests a slug based on a title
   */
  suggestSlugFromTitle(title: ContentTitle): ContentSlug {
    return ContentSlug.fromTitle(title.value);
  }

  /**
   * Validates content fields for basic business rules
   */
  validateContentFields(title: ContentTitle, slug: ContentSlug, body?: string): void {
    // Validate title constraints
    if (title.isEmpty()) {
      throw new Error('Content title cannot be empty');
    }
    
    if (title.length > 200) {
      throw new Error('Content title cannot exceed 200 characters');
    }
    
    // Validate slug constraints
    if (slug.length > 100) {
      throw new Error('Content slug cannot exceed 100 characters');
    }
    
    if (slug.length < 1) {
      throw new Error('Content slug cannot be empty');
    }
    
    // Validate body if provided
    if (body !== undefined && body.length > 50000) {
      throw new Error('Content body cannot exceed 50,000 characters');
    }
    
    // Validate title and slug consistency
    this.validateTitleAndSlugConsistency(title, slug);
  }

  /**
   * Validates if content can be published based on business rules
   */
  validateContentForPublication(title: ContentTitle, body: string): void {
    if (title.isEmpty()) {
      throw new Error('Cannot publish content without a title');
    }
    
    if (!body || body.trim().length === 0) {
      throw new Error('Cannot publish content without body content');
    }
    
    if (body.length < 10) {
      throw new Error('Content body must be at least 10 characters long for publication');
    }
  }

  /**
   * Validates media filename for content association
   */
  validateMediaForContent(filename: string): void {
    if (!filename || filename.trim().length === 0) {
      throw new Error('Media filename cannot be empty');
    }
    
    // Check for potentially dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.com', '.scr', '.pif', '.cmd'];
    const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    if (dangerousExtensions.includes(fileExtension)) {
      throw new Error(`File type ${fileExtension} is not allowed`);
    }
    
    // Check filename length
    if (filename.length > 255) {
      throw new Error('Media filename cannot exceed 255 characters');
    }
  }

  /**
   * Validates content slug format for SEO and technical requirements
   */
  validateSlugForSEO(slug: ContentSlug): void {
    // SEO best practices for slugs
    if (slug.length > 60) {
      throw new Error('For SEO purposes, slug should not exceed 60 characters');
    }
    
    if (slug.length < 3) {
      throw new Error('For SEO purposes, slug should be at least 3 characters');
    }
    
    // Check for common SEO anti-patterns
    if (slug.value.includes('--')) {
      throw new Error('Slug should not contain consecutive hyphens');
    }
    
    if (slug.value.startsWith('-') || slug.value.endsWith('-')) {
      throw new Error('Slug should not start or end with a hyphen');
    }
  }
}