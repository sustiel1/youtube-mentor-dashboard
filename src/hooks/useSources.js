import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Source } from '@/api/entities';
import { isBase44Enabled } from '@/config/base44Flags';
import { MENTORS, buildSyntheticSourcesFromMentors } from '@/data/mockData';
import { getLocalCustomMentors } from '@/lib/localCustomMentorsStore';
import {
  filterVisibleMentors,
} from '@/services/mentorStorage';

function mergeMentorsForLocalSources() {
  return [...MENTORS, ...getLocalCustomMentors()];
}

function localFirstSources() {
  return buildSyntheticSourcesFromMentors(filterVisibleMentors(mergeMentorsForLocalSources()));
}

// Fetch all sources
export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      if (!isBase44Enabled()) {
        return localFirstSources();
      }
      try {
        const data = await Source.list();
        return data ?? [];
      } catch {
        return localFirstSources();
      }
    },
    retry: false,
  });
}

// Fetch sources for a specific mentor
export function useSourcesByMentor(mentorId) {
  return useQuery({
    queryKey: ['sources', mentorId],
    queryFn: async () => {
      if (!isBase44Enabled()) {
        return localFirstSources().filter((s) => s.mentorId === mentorId && s.active);
      }
      try {
        const data = await Source.filter({ mentorId, active: true });
        return data ?? [];
      } catch {
        return localFirstSources().filter((s) => s.mentorId === mentorId && s.active);
      }
    },
    enabled: !!mentorId,
  });
}

// Mutation: create a source
export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceData) => {
      if (!isBase44Enabled()) {
        return Promise.reject(
          new Error('מצב local-first: יצירת מקור דורשת VITE_ENABLE_BASE44=true'),
        );
      }
      return Source.create(sourceData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

// Mutation: update a source (e.g. save resolved channelId to sourceUrl)
export function useUpdateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => {
      if (!isBase44Enabled()) {
        return Promise.reject(
          new Error('מצב local-first: עדכון מקור דורש VITE_ENABLE_BASE44=true'),
        );
      }
      return Source.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

// Mutation: update last checked timestamp
export function useMarkSourceChecked() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId) => {
      if (!isBase44Enabled()) {
        return Promise.resolve(null);
      }
      return Source.update(sourceId, { lastCheckedAt: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}
