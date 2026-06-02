import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Category } from '@/api/entities';
import { isBase44Enabled } from '@/config/base44Flags';
import { CATEGORIES } from '@/data/mockData';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      if (!isBase44Enabled()) {
        return CATEGORIES;
      }
      try {
        const data = await Category.list();
        return data ?? [];
      } catch (error) {
        console.warn('[useCategories] Base44 unavailable — using mock data:', error.message);
        return CATEGORIES;
      }
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => {
      if (!isBase44Enabled()) {
        return Promise.reject(
          new Error('מצב local-first: יצירת קטגוריה דורשת VITE_ENABLE_BASE44=true'),
        );
      }
      return Category.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
