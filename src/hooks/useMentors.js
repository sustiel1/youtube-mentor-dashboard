import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mentor, Source } from '@/api/entities';
import { MENTORS } from '@/data/mockData';

// Fetch all mentors
export function useMentors() {
  return useQuery({
    queryKey: ['mentors'],
    queryFn: async () => {
      try {
        const data = await Mentor.list();
        return data ?? [];
      } catch (error) {
        console.warn('[useMentors] Base44 unavailable — using mock data:', error.message);
        return MENTORS;
      }
    },
  });
}

// Fetch only active mentors
export function useActiveMentors() {
  return useQuery({
    queryKey: ['mentors', 'active'],
    queryFn: async () => {
      try {
        const data = await Mentor.filter({ active: true });
        return data ?? [];
      } catch {
        return MENTORS.filter((m) => m.active);
      }
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

// Mutation: delete a mentor
export function useDeleteMentor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => Mentor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
    },
  });
}
