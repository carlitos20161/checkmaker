import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Global listener registry to prevent duplicates
const activeListeners = new Map<string, () => void>();

interface CacheItem<T> {
  data: T;
  timestamp: number;
  version: number;
}

interface UseOptimizedDataOptions {
  cacheTime?: number; // milliseconds
  staleTime?: number; // milliseconds
  backgroundUpdate?: boolean;
  optimisticUpdates?: boolean;
}

export function useOptimizedData<T>(
  collectionName: string,
  filters: Record<string, any> = {},
  options: UseOptimizedDataOptions = {}
) {
  const {
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 30 * 1000, // 30 seconds
    backgroundUpdate = true,
    optimisticUpdates = true
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState<Map<string, CacheItem<T[]>>>(new Map());
  const [version, setVersion] = useState(0);

  // Generate cache key based on collection and filters
  const cacheKey = useMemo(() => {
    return `${collectionName}:${JSON.stringify(filters)}`;
  }, [collectionName, filters]);

  // Generate listener key for preventing duplicates
  const listenerKey = useMemo(() => {
    return `${collectionName}:${JSON.stringify(filters)}:${backgroundUpdate}`;
  }, [collectionName, filters, backgroundUpdate]);

  // Check if data is fresh in cache
  const isDataFresh = useCallback((cacheItem: CacheItem<T[]>) => {
    const now = Date.now();
    return now - cacheItem.timestamp < staleTime;
  }, [staleTime]);

  // Fetch data with caching
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached && !forceRefresh && isDataFresh(cached)) {
        console.log(`📦 Using cached data for ${collectionName}`);
        setData(cached.data);
        setLoading(false);
        return;
      }

      console.log(`🚀 Fetching ${collectionName} with filters:`, filters);
      const startTime = performance.now();

      // Build query
      let q: any = collection(db, collectionName);

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          q = query(q, where(key, '==', value));
        }
      });

      const snapshot = await getDocs(q);
      const result = snapshot.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() as any) })) as T[];

      const endTime = performance.now();
      console.log(`✅ Fetched ${result.length} ${collectionName} in ${(endTime - startTime).toFixed(2)}ms`);

      // Update cache
      const newCache = new Map(cache);
      newCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        version: version + 1
      });
      setCache(newCache);
      setVersion(prev => prev + 1);
      setData(result);

    } catch (err) {
      console.error(`❌ Error fetching ${collectionName}:`, err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [collectionName, filters, cacheKey, cache, isDataFresh, version]);

  // Real-time updates with background refresh
  useEffect(() => {
    if (!backgroundUpdate) return;

    // Check if listener already exists
    if (activeListeners.has(listenerKey)) {
      console.log(`👂 Listener already exists for ${collectionName} (key: ${listenerKey})`);
      return;
    }

    console.log(`👂 Setting up real-time listener for ${collectionName} (key: ${listenerKey})`);
    
    let q: any = collection(db, collectionName);
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        q = query(q, where(key, '==', value));
      }
    });

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const result = snapshot.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() as any) })) as T[];
      console.log(`🔄 Real-time update for ${collectionName}: ${result.length} items`);
      setData(result);
    }, (err: any) => {
      console.error(`❌ Real-time listener error for ${collectionName}:`, err);
    });

    // Register the listener
    activeListeners.set(listenerKey, unsubscribe);

    return () => {
      console.log(`🔌 Cleaning up real-time listener for ${collectionName}`);
      const cleanup = activeListeners.get(listenerKey);
      if (cleanup) {
        cleanup();
        activeListeners.delete(listenerKey);
      }
    };
  }, [listenerKey, backgroundUpdate]);

  // Optimistic updates
  const optimisticUpdate = useCallback(async (
    itemId: string,
    updates: Partial<T>,
    rollback?: () => void
  ) => {
    if (!optimisticUpdates) return;

    // Optimistically update local state
    setData(prev => prev.map(item => 
      (item as any).id === itemId ? { ...item, ...updates } : item
    ));

    try {
      // Update Firestore
      const docRef = doc(db, collectionName, itemId);
      await updateDoc(docRef, updates as any);
      console.log(`✅ Optimistic update successful for ${itemId}`);
    } catch (err) {
      console.error(`❌ Optimistic update failed for ${itemId}:`, err);
      // Rollback on error
      if (rollback) rollback();
      // Refetch data to ensure consistency
      fetchData(true);
    }
  }, [collectionName, optimisticUpdates, fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cleanup old cache entries
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const newCache = new Map(cache);
      let cleaned = false;

      newCache.forEach((item, key) => {
        if (now - item.timestamp > cacheTime) {
          newCache.delete(key);
          cleaned = true;
        }
      });

      if (cleaned) {
        console.log('🧹 Cleaned old cache entries');
        setCache(newCache);
      }
    }, 60000); // Check every minute

    return () => clearInterval(cleanup);
  }, [cache, cacheTime]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      // Clean up any remaining listeners for this component
      const keysToRemove: string[] = [];
      activeListeners.forEach((cleanup, key) => {
        if (key.startsWith(`${collectionName}:`)) {
          keysToRemove.push(key);
        }
      });
      
      keysToRemove.forEach(key => {
        const cleanup = activeListeners.get(key);
        if (cleanup) {
          cleanup();
          activeListeners.delete(key);
        }
      });
    };
  }, [collectionName]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(true),
    optimisticUpdate,
    version
  };
} 