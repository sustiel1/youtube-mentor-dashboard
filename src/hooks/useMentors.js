import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mentor, Source } from '@/api/entities';
import { MENTORS } from '@/data/mockData';
import {
  hideMentor,
  restoreMentor,
  getHiddenMentorIds,
  filterVisibleMentors,
} from '@/services/mentorStorage';

// Local mode — returns mock data minus hidden mentors
export function useMentors() {
  return useQuery({
    queryKey: ['mentors'],
    queryFn: async () => filterVisibleMentors(MENTORS),
  });
}

// Local mode — returns active visible mentors
export function useActiveMentors() {
  return useQuery({
    queryKey: ['mentors', 'active'],
    queryFn: async () => filterVisibleMentors(MENTORS).filter((m) => m.active),
  });
}

// Returns the full objects of currently hidden mentors
export function useHiddenMentors() {
  return useQuery({
    queryKey: ['mentors', 'hidden'],
    queryFn: async () => {
      const hiddenIds = new Set(getHiddenMentorIds());
      return MENTORS.filter((m) => hiddenIds.has(m.id));
    },
  });
}

// Mutation: create a mentor
export function useCreateMentor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mentorData) => Mentor.create(mentorData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
    },
  });
}

// Combined mutation: create Mentor + Source in one flow
// mentorData: { name, category, topic, avatarUrl, active, description }
// sourceUrl: string — the channel/RSS URL
export function useAddMentorWithSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mentorData, sourceUrl, sourceType }) => {
      // 1. Create the mentor record
      const mentor = await Mentor.create({
        name: mentorData.name,
        category: mentorData.category,
        topic: mentorData.topic || null,
        avatarUrl: mentorData.avatarUrl || null,
        active: mentorData.active ?? true,
        description: mentorData.description || null,
      });

      // 2. Create the source record linked to this mentor
      await Source.create({
        mentorId: mentor.id,
        sourceType: sourceType || 'youtube',
        sourceUrl,
        active: true,
        lastCheckedAt: null,
      });

      return mentor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

// Mutation: update a mentor
export function useUpdateMentor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => Mentor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
    },
  });
}

// Mutation: soft-delete a mentor (hide in localStorage, not removed from mock data)
export function useDeleteMentor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => hideMentor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
    },
  });
}

// Mutation: restore a previously hidden mentor
export function useRestoreMentor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => restoreMentor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
    },
  });
}
