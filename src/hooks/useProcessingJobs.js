import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProcessingJob } from '@/api/entities';
import { isBase44Enabled } from '@/config/base44Flags';

// Fetch all jobs, newest first
export function useProcessingJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      if (!isBase44Enabled()) {
        return [];
      }
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
      if (!isBase44Enabled()) {
        return [];
      }
      try {
        const running = await ProcessingJob.filter({ status: 'running' });
        const pending = await ProcessingJob.filter({ status: 'pending' });
        return [...(running ?? []), ...(pending ?? [])];
      } catch {
        return [];
      }
    },
    refetchInterval: isBase44Enabled() ? 10_000 : false,
  });
}

// Mutation: create a new processing job
export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId }) => {
      if (!isBase44Enabled()) {
        return Promise.reject(
          new Error('מצב local-first: ProcessingJob דורש VITE_ENABLE_BASE44=true'),
        );
      }
      return ProcessingJob.create({
        videoId,
        status: 'pending',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        errorMessage: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// Mutation: update job status
export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, errorMessage }) => {
      if (!isBase44Enabled()) {
        return Promise.reject(
          new Error('מצב local-first: ProcessingJob דורש VITE_ENABLE_BASE44=true'),
        );
      }
      return ProcessingJob.update(id, {
        status,
        errorMessage: errorMessage ?? null,
        finishedAt: ['completed', 'failed'].includes(status)
          ? new Date().toISOString()
          : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
