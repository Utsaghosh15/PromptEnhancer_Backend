import { 
  getDayKey, 
  getSecondsUntilMidnight, 
  getAnonQuotaKey, 
  getUserQuotaKey 
} from '../dayKey';

describe('dayKey utilities', () => {
  describe('getDayKey', () => {
    it('should generate correct day key for current date', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const dayKey = getDayKey(date);
      expect(dayKey).toBe('20240115');
    });

    it('should generate correct day key for different dates', () => {
      const date1 = new Date('2024-12-31T23:59:59Z');
      const date2 = new Date('2024-02-29T00:00:00Z'); // Leap year
      
      expect(getDayKey(date1)).toBe('20241231');
      expect(getDayKey(date2)).toBe('20240229');
    });
  });

  describe('getSecondsUntilMidnight', () => {
    it('should return positive number of seconds', () => {
      const seconds = getSecondsUntilMidnight();
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThan(86400); // 24 hours in seconds
    });
  });

  describe('Redis key generators', () => {
    it('should generate correct anon quota key', () => {
      const anonId = 'test-anon-123';
      const date = new Date('2024-01-15T10:30:00Z');
      const key = getAnonQuotaKey(anonId, date);
      expect(key).toBe('enh:anon:test-anon-123:20240115');
    });

    it('should generate correct user quota key', () => {
      const userId = 'user-456';
      const date = new Date('2024-01-15T10:30:00Z');
      const key = getUserQuotaKey(userId, date);
      expect(key).toBe('enh:user:user-456:20240115');
    });
  });
});
