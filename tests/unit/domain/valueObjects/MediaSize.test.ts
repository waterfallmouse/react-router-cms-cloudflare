import { describe, it, expect } from 'bun:test';
import { MediaSize } from '../../../../src/domain/cms/valueObjects/MediaSize';

describe('MediaSize', () => {
  describe('create', () => {
    it('should create MediaSize with valid byte size', () => {
      const size = 1024;
      const mediaSize = MediaSize.create(size);
      
      expect(mediaSize.value).toBe(size);
    });

    it('should throw error for zero size', () => {
      expect(() => MediaSize.create(0)).toThrow('Invalid media size');
    });

    it('should throw error for negative size', () => {
      expect(() => MediaSize.create(-1)).toThrow('Invalid media size');
    });

    it('should throw error for size exceeding 100MB', () => {
      const size = 100 * 1024 * 1024 + 1; // 100MB + 1 byte
      expect(() => MediaSize.create(size)).toThrow('Invalid media size');
    });

    it('should accept exactly 100MB', () => {
      const size = 100 * 1024 * 1024; // Exactly 100MB
      const mediaSize = MediaSize.create(size);
      
      expect(mediaSize.value).toBe(size);
    });

    it('should throw error for non-integer size', () => {
      expect(() => MediaSize.create(1024.5)).toThrow('Invalid media size');
    });
  });

  describe('fromBytes', () => {
    it('should create MediaSize from bytes', () => {
      const bytes = 2048;
      const mediaSize = MediaSize.fromBytes(bytes);
      
      expect(mediaSize.bytes).toBe(bytes);
    });
  });

  describe('fromKilobytes', () => {
    it('should create MediaSize from kilobytes', () => {
      const kb = 2;
      const mediaSize = MediaSize.fromKilobytes(kb);
      
      expect(mediaSize.bytes).toBe(2 * 1024);
      expect(mediaSize.kilobytes).toBe(kb);
    });

    it('should round fractional kilobytes', () => {
      const kb = 2.5;
      const mediaSize = MediaSize.fromKilobytes(kb);
      
      expect(mediaSize.bytes).toBe(2560); // 2.5 * 1024 = 2560
    });
  });

  describe('fromMegabytes', () => {
    it('should create MediaSize from megabytes', () => {
      const mb = 5;
      const mediaSize = MediaSize.fromMegabytes(mb);
      
      expect(mediaSize.bytes).toBe(5 * 1024 * 1024);
      expect(mediaSize.megabytes).toBe(mb);
    });

    it('should round fractional megabytes', () => {
      const mb = 1.5;
      const mediaSize = MediaSize.fromMegabytes(mb);
      
      expect(mediaSize.bytes).toBe(1572864); // 1.5 * 1024 * 1024 = 1572864
    });
  });

  describe('value', () => {
    it('should return the internal byte value', () => {
      const bytes = 1024;
      const mediaSize = MediaSize.create(bytes);
      
      expect(mediaSize.value).toBe(bytes);
    });
  });

  describe('bytes', () => {
    it('should return size in bytes', () => {
      const mediaSize = MediaSize.create(1024);
      
      expect(mediaSize.bytes).toBe(1024);
    });
  });

  describe('kilobytes', () => {
    it('should return size in kilobytes', () => {
      const mediaSize = MediaSize.create(2048);
      
      expect(mediaSize.kilobytes).toBe(2);
    });

    it('should return fractional kilobytes', () => {
      const mediaSize = MediaSize.create(1536); // 1.5KB
      
      expect(mediaSize.kilobytes).toBe(1.5);
    });
  });

  describe('megabytes', () => {
    it('should return size in megabytes', () => {
      const mediaSize = MediaSize.create(2 * 1024 * 1024);
      
      expect(mediaSize.megabytes).toBe(2);
    });

    it('should return fractional megabytes', () => {
      const mediaSize = MediaSize.create(1.5 * 1024 * 1024);
      
      expect(mediaSize.megabytes).toBe(1.5);
    });
  });

  describe('gigabytes', () => {
    it('should return size in gigabytes', () => {
      const oneMB = 1024 * 1024;
      const mediaSize = MediaSize.create(oneMB);
      
      expect(mediaSize.gigabytes).toBeCloseTo(0.0009765625, 10);
    });

  });

  describe('isSmall', () => {
    it('should return true for files smaller than 1MB', () => {
      const mediaSize = MediaSize.create(500 * 1024); // 500KB
      
      expect(mediaSize.isSmall()).toBe(true);
    });

    it('should return false for files 1MB or larger', () => {
      const mediaSize = MediaSize.create(1024 * 1024); // 1MB
      
      expect(mediaSize.isSmall()).toBe(false);
    });
  });

  describe('isMedium', () => {
    it('should return true for files between 1MB and 10MB', () => {
      const mediaSize = MediaSize.create(5 * 1024 * 1024); // 5MB
      
      expect(mediaSize.isMedium()).toBe(true);
    });

    it('should return true for exactly 1MB', () => {
      const mediaSize = MediaSize.create(1024 * 1024); // 1MB
      
      expect(mediaSize.isMedium()).toBe(true);
    });

    it('should return false for files smaller than 1MB', () => {
      const mediaSize = MediaSize.create(500 * 1024); // 500KB
      
      expect(mediaSize.isMedium()).toBe(false);
    });

    it('should return false for files 10MB or larger', () => {
      const mediaSize = MediaSize.create(10 * 1024 * 1024); // 10MB
      
      expect(mediaSize.isMedium()).toBe(false);
    });
  });

  describe('isLarge', () => {
    it('should return true for files 10MB or larger', () => {
      const mediaSize = MediaSize.create(15 * 1024 * 1024); // 15MB
      
      expect(mediaSize.isLarge()).toBe(true);
    });

    it('should return true for exactly 10MB', () => {
      const mediaSize = MediaSize.create(10 * 1024 * 1024); // 10MB
      
      expect(mediaSize.isLarge()).toBe(true);
    });

    it('should return false for files smaller than 10MB', () => {
      const mediaSize = MediaSize.create(5 * 1024 * 1024); // 5MB
      
      expect(mediaSize.isLarge()).toBe(false);
    });
  });

  describe('isWithinLimit', () => {
    it('should return true when size is within limit', () => {
      const mediaSize = MediaSize.create(1024);
      
      expect(mediaSize.isWithinLimit(2048)).toBe(true);
    });

    it('should return true when size equals limit', () => {
      const mediaSize = MediaSize.create(1024);
      
      expect(mediaSize.isWithinLimit(1024)).toBe(true);
    });

    it('should return false when size exceeds limit', () => {
      const mediaSize = MediaSize.create(2048);
      
      expect(mediaSize.isWithinLimit(1024)).toBe(false);
    });
  });

  describe('toHumanReadable', () => {
    it('should return bytes for sizes less than 1KB', () => {
      const mediaSize = MediaSize.create(512);
      
      expect(mediaSize.toHumanReadable()).toBe('512 B');
    });

    it('should return KB for sizes less than 1MB', () => {
      const mediaSize = MediaSize.create(1536); // 1.5KB
      
      expect(mediaSize.toHumanReadable()).toBe('1.5 KB');
    });

    it('should return MB for sizes less than 1GB', () => {
      const mediaSize = MediaSize.create(2.5 * 1024 * 1024); // 2.5MB
      
      expect(mediaSize.toHumanReadable()).toBe('2.5 MB');
    });

    it('should return MB for largest allowed size (100MB)', () => {
      const maxSize = 100 * 1024 * 1024; // 100MB - max allowed
      const mediaSize = MediaSize.create(maxSize);
      
      const result = mediaSize.toHumanReadable();
      expect(result).toBe('100 MB');
    });

    it('should round to one decimal place', () => {
      const mediaSize = MediaSize.create(1587); // ~1.55KB
      
      expect(mediaSize.toHumanReadable()).toBe('1.5 KB');
    });
  });

  describe('compare', () => {
    it('should return -1 when this size is smaller', () => {
      const mediaSize1 = MediaSize.create(1024);
      const mediaSize2 = MediaSize.create(2048);
      
      expect(mediaSize1.compare(mediaSize2)).toBe(-1);
    });

    it('should return 1 when this size is larger', () => {
      const mediaSize1 = MediaSize.create(2048);
      const mediaSize2 = MediaSize.create(1024);
      
      expect(mediaSize1.compare(mediaSize2)).toBe(1);
    });

    it('should return 0 when sizes are equal', () => {
      const mediaSize1 = MediaSize.create(1024);
      const mediaSize2 = MediaSize.create(1024);
      
      expect(mediaSize1.compare(mediaSize2)).toBe(0);
    });
  });

  describe('isLargerThan', () => {
    it('should return true when this size is larger', () => {
      const mediaSize1 = MediaSize.create(2048);
      const mediaSize2 = MediaSize.create(1024);
      
      expect(mediaSize1.isLargerThan(mediaSize2)).toBe(true);
    });

    it('should return false when this size is smaller or equal', () => {
      const mediaSize1 = MediaSize.create(1024);
      const mediaSize2 = MediaSize.create(2048);
      
      expect(mediaSize1.isLargerThan(mediaSize2)).toBe(false);
      
      const mediaSize3 = MediaSize.create(1024);
      expect(mediaSize1.isLargerThan(mediaSize3)).toBe(false);
    });
  });

  describe('isSmallerThan', () => {
    it('should return true when this size is smaller', () => {
      const mediaSize1 = MediaSize.create(1024);
      const mediaSize2 = MediaSize.create(2048);
      
      expect(mediaSize1.isSmallerThan(mediaSize2)).toBe(true);
    });

    it('should return false when this size is larger or equal', () => {
      const mediaSize1 = MediaSize.create(2048);
      const mediaSize2 = MediaSize.create(1024);
      
      expect(mediaSize1.isSmallerThan(mediaSize2)).toBe(false);
      
      const mediaSize3 = MediaSize.create(2048);
      expect(mediaSize1.isSmallerThan(mediaSize3)).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for same size values', () => {
      const size = 1024;
      const mediaSize1 = MediaSize.create(size);
      const mediaSize2 = MediaSize.create(size);
      
      expect(mediaSize1.equals(mediaSize2)).toBe(true);
    });

    it('should return false for different size values', () => {
      const mediaSize1 = MediaSize.create(1024);
      const mediaSize2 = MediaSize.create(2048);
      
      expect(mediaSize1.equals(mediaSize2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return human readable string', () => {
      const mediaSize = MediaSize.create(1536); // 1.5KB
      
      expect(mediaSize.toString()).toBe('1.5 KB');
    });
  });
});