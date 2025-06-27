import { ContentStatusSchema, type ContentStatusType } from '../schemas/ValidationSchemas';

export class ContentStatus {
  private readonly _value: ContentStatusType;

  private constructor(value: ContentStatusType) {
    this._value = value;
  }

  static create(value: ContentStatusType): ContentStatus {
    const validatedStatus = ContentStatusSchema.parse(value);
    return new ContentStatus(validatedStatus);
  }

  static draft(): ContentStatus {
    return new ContentStatus('draft');
  }

  static published(): ContentStatus {
    return new ContentStatus('published');
  }

  static archived(): ContentStatus {
    return new ContentStatus('archived');
  }

  get value(): ContentStatusType {
    return this._value;
  }

  isDraft(): boolean {
    return this._value === 'draft';
  }

  isPublished(): boolean {
    return this._value === 'published';
  }

  isArchived(): boolean {
    return this._value === 'archived';
  }

  canTransitionTo(newStatus: ContentStatus): boolean {
    const current = this._value;
    const target = newStatus._value;

    const allowedTransitions: Record<ContentStatusType, ContentStatusType[]> = {
      draft: ['published', 'archived'],
      published: ['draft', 'archived'],
      archived: ['draft', 'published']
    };

    return allowedTransitions[current]?.includes(target) ?? false;
  }

  equals(other: ContentStatus): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  toDisplayString(): string {
    const displayMap: Record<ContentStatusType, string> = {
      draft: 'Draft',
      published: 'Published',
      archived: 'Archived'
    };
    
    return displayMap[this._value];
  }
}