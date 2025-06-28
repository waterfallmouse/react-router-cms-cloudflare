import { type ContentId } from '../valueObjects/ContentId';

export class ContentPublishedEvent {
  constructor(
    public readonly contentId: ContentId,
    public readonly publishedAt: Date,
  ) {}
}
