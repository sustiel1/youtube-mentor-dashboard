import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Source } from '@/api/entities';

// Fetch all sources
export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      try {
        const data = await Source.list();
        return data ?? [];
      } catch (error) {
        console.warn('[useSources] Base44 unavailable:', error.message);
        return [];
      }
    },
  });
}

// Fetch sources for a specific mentor
export function useSourcesByMentor(mentorId) {
  return useQuery({
    queryKey: ['sources', mentorId],
    queryFn: async () => {
      try {
        const data = await Source.filter({ mentorId, active: true });
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!mentorId,
  });
}

// Mutation: create a source
export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceData) => Source.create(sourceData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

// Mutation: update a source (e.g. save resolved channelId to sourceUrl)
export function useUpdateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => Source.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

// Mutation: update last checked timestamp
export function useMarkSourceChecked() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId) =>
      Source.update(sourceId, { lastCheckedAt: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}
