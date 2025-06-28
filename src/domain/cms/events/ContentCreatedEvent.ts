import { type ContentId } from '../valueObjects/ContentId';
import { type ContentTitle } from '../valueObjects/ContentTitle';
import { type ContentTypeId } from '../valueObjects/ContentTypeId';

export class ContentCreatedEvent {
  constructor(
    public readonly contentId: ContentId,
    public readonly title: ContentTitle,
    public readonly contentTypeId: ContentTypeId,
    public readonly createdAt: Date,
  ) {}
}
