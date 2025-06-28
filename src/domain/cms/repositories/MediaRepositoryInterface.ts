import { type Media } from '../entities/Media';
import { type ContentId } from '../valueObjects/ContentId';
import { type MediaId } from '../valueObjects/MediaId';

export interface MediaRepositoryInterface {
  save(media: Media): Promise<void>;
  findById(id: MediaId): Promise<Media | null>;
  findByContentId(contentId: ContentId): Promise<Media[]>;
  findUnattachedMedia(): Promise<Media[]>;
  findUnattachedMediaOlderThan(date: Date): Promise<Media[]>;
  delete(id: MediaId): Promise<void>;
}
