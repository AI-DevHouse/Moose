/**
 * Simple in-memory cache with TTL support
 *
 * Usage:
 * const data = await getOrCache('config', 60000, async () => {
 *   return await fetchConfigFromDB();
 * });
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Get cached data or fetch and cache if not present/expired
   * @param key Cache key
   * @param ttlMs Time to live in milliseconds
   * @param fetchFn Function to fetch data if cache miss
   */
  async get<T>(
    key: string,
    ttlMs: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Return cached data if valid
    if (cached && cached.expires > now) {
      return cached.data;
    }

    // Fetch fresh data
    const data = await fetchFn();

    // Store in cache
    this.cache.set(key, {
      data,
      expires: now + ttlMs,
    });

    return data;
  }

  /**
   * Manually invalidate a cache entry
   * @param key Cache key to invalidate
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Cleanup expired entries (run periodically)
   */
  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.expires <= now) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const cache = new SimpleCache();

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * Helper function for common pattern
 */
export async function getOrCache<T>(
  key: string,
  ttlMs: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  return cache.get(key, ttlMs, fetchFn);
}
