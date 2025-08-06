// CORREÇÃO 3: Utilitários de otimização de performance
export class PerformanceOptimizer {
  private static debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private static memoCache: Map<string, { data: any; timestamp: number }> = new Map();
  private static readonly CACHE_TTL = 5000; // 5 segundos

  // Debounce otimizado para múltiplas funções
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
    key: string
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const existingTimer = this.debounceTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        func(...args);
        this.debounceTimers.delete(key);
      }, delay);

      this.debounceTimers.set(key, timer);
    };
  }

  // Memoização com TTL
  static memoize<T>(
    func: (...args: any[]) => T,
    keyGenerator: (...args: any[]) => string,
    ttl: number = this.CACHE_TTL
  ): (...args: any[]) => T {
    return (...args: any[]): T => {
      const key = keyGenerator(...args);
      const cached = this.memoCache.get(key);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < ttl) {
        return cached.data;
      }

      const result = func(...args);
      this.memoCache.set(key, { data: result, timestamp: now });

      return result;
    };
  }

  // Limpeza de cache
  static clearCache(): void {
    this.memoCache.clear();
  }

  // Throttle para eventos de scroll/resize
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  }

  // Otimização de arrays grandes
  static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Virtual scrolling helper
  static calculateVisibleItems(
    scrollTop: number,
    containerHeight: number,
    itemHeight: number,
    totalItems: number,
    buffer: number = 5
  ): { startIndex: number; endIndex: number; visibleItems: number } {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const visibleItems = Math.ceil(containerHeight / itemHeight) + buffer * 2;
    const endIndex = Math.min(totalItems - 1, startIndex + visibleItems);

    return { startIndex, endIndex, visibleItems };
  }

  // Cleanup de timers
  static cleanup(): void {
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    this.clearCache();
  }
}

// Hook personalizado para otimização
export const usePerformanceOptimizer = () => {
  const debounce = PerformanceOptimizer.debounce;
  const memoize = PerformanceOptimizer.memoize;
  const throttle = PerformanceOptimizer.throttle;

  return { debounce, memoize, throttle };
};

// Utilitário para filtros otimizados
export const createOptimizedFilter = <T>(
  items: T[],
  filters: Record<string, any>,
  filterFunctions: Record<string, (item: T, value: any) => boolean>
) => {
  return PerformanceOptimizer.memoize(
    (items: T[], filters: Record<string, any>) => {
      return items.filter(item => {
        return Object.entries(filters).every(([key, value]) => {
          if (!value || (Array.isArray(value) && value.length === 0)) return true;
          const filterFn = filterFunctions[key];
          return filterFn ? filterFn(item, value) : true;
        });
      });
    },
    (items, filters) => `filter_${items.length}_${JSON.stringify(filters)}`,
    3000 // Cache por 3 segundos
  )(items, filters);
};