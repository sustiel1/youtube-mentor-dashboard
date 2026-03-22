import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Category } from '@/api/entities';
import { CATEGORIES } from '@/data/mockData';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
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
    mutationFn: (data) => Category.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
