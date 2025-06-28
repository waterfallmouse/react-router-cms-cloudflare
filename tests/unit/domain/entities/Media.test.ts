import { describe, it, expect, beforeEach } from 'bun:test';
import { Media } from '../../../../src/domain/cms/entities/Media';
import { ContentId } from '../../../../src/domain/cms/valueObjects/ContentId';
import { MediaFilename } from '../../../../src/domain/cms/valueObjects/MediaFilename';
import { MediaId } from '../../../../src/domain/cms/valueObjects/MediaId';
import { MediaR2Key } from '../../../../src/domain/cms/valueObjects/MediaR2Key';
import { MediaSize } from '../../../../src/domain/cms/valueObjects/MediaSize';
import { MediaUrl } from '../../../../src/domain/cms/valueObjects/MediaUrl';

describe('Media Entity', () => {
  let filename: MediaFilename;
  let r2Key: MediaR2Key;
  let url: MediaUrl;
  let size: MediaSize;
  const mimeType = 'image/png';

  beforeEach(() => {
    filename = MediaFilename.fromString('test-image.png');
    r2Key = MediaR2Key.fromString('images/test-image.png');
    url = MediaUrl.fromString('https://example.com/images/test-image.png');
    size = MediaSize.fromBytes(12345);
  });

  describe('create', () => {
    it('should create new media with generated ID', () => {
      const media = Media.create(filename, r2Key, url, size, mimeType);

      expect(media.getId()).toBeInstanceOf(MediaId);
      expect(media.getFilename()).toBe(filename);
      expect(media.getR2Key()).toBe(r2Key);
      expect(media.getUrl()).toBe(url);
      expect(media.getSize()).toBe(size);
      expect(media.getMimeType()).toBe(mimeType);
      expect(media.getAlt()).toBeNull();
      expect(media.getContentId()).toBeNull();
      expect(media.isAttachedToContent()).toBe(false);
    });
  });

  describe('attachToContent', () => {
    it('should attach media to a content', () => {
      const media = Media.create(filename, r2Key, url, size, mimeType);
      const contentId = ContentId.generate();
      media.attachToContent(contentId);

      expect(media.getContentId()).toBe(contentId);
      expect(media.isAttachedToContent()).toBe(true);
    });
  });

  describe('detachFromContent', () => {
    it('should detach media from a content', () => {
      const media = Media.create(filename, r2Key, url, size, mimeType);
      const contentId = ContentId.generate();
      media.attachToContent(contentId);
      media.detachFromContent();

      expect(media.getContentId()).toBeNull();
      expect(media.isAttachedToContent()).toBe(false);
    });
  });

  describe('updateAlt', () => {
    it('should update alt text', () => {
      const media = Media.create(filename, r2Key, url, size, mimeType);
      const altText = 'A test image';
      media.updateAlt(altText);

      expect(media.getAlt()).toBe(altText);
    });
  });

  describe('isImage', () => {
    it('should return true for an image file', () => {
      const imageFilename = MediaFilename.fromString('photo.jpg');
      const media = Media.create(imageFilename, r2Key, url, size, 'image/jpeg');
      expect(media.isImage()).toBe(true);
    });

    it('should return false for a non-image file', () => {
      const docFilename = MediaFilename.fromString('document.pdf');
      const media = Media.create(docFilename, r2Key, url, size, 'application/pdf');
      expect(media.isImage()).toBe(false);
    });
  });
});
