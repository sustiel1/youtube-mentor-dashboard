import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Topic } from '@/api/entities';
import { TOPICS } from '@/data/mockData';

// Fetch all topics
export function useTopics() {
  return useQuery({
    queryKey: ['topics'],
    queryFn: async () => {
      try {
        const data = await Topic.list();
        return data ?? [];
      } catch (error) {
        console.warn('[useTopics] Base44 unavailable — using mock data:', error.message);
        return TOPICS;
      }
    },
  });
}

// Mutation: create a topic
export function useCreateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (topicData) =>
      Topic.create({
        ...topicData,
        createdAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

// Mutation: update a topic
export function useUpdateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => Topic.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

// Mutation: delete a topic
export function useDeleteTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => Topic.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}
