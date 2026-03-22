import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProcessingJob } from '@/api/entities';

// Fetch all jobs, newest first
export function useProcessingJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      try {
        const data = await ProcessingJob.list('-startedAt');
        return data ?? [];
      } catch (error) {
        console.warn('[useProcessingJobs] Base44 unavailable:', error.message);
        return [];
      }
    },
  });
}

// Fetch running/pending jobs only
export function useActiveJobs() {
  return useQuery({
    queryKey: ['jobs', 'active'],
    queryFn: async () => {
      try {
        const running = await ProcessingJob.filter({ status: 'running' });
        const pending = await ProcessingJob.filter({ status: 'pending' });
        return [...(running ?? []), ...(pending ?? [])];
      } catch {
        return [];
      }
    },
    refetchInterval: 10_000, // Poll every 10 seconds for active jobs
  });
}

// Mutation: create a new processing job
export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId }) =>
      ProcessingJob.create({
        videoId,
        status: 'pending',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        errorMessage: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// Mutation: update job status
export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, errorMessage }) =>
      ProcessingJob.update(id, {
        status,
        errorMessage: errorMessage ?? null,
        finishedAt: ['completed', 'failed'].includes(status)
          ? new Date().toISOString()
          : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
