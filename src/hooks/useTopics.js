import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  loadTopics,
  addTopic,
  deleteTopic,
  updateTopic,
} from '@/services/topicStorage';

// Returns all topics: mockData TOPICS + user-added from localStorage
export function useTopics() {
  return useQuery({
    queryKey: ['topics'],
    queryFn:  async () => loadTopics(),
  });
}

// Mutation: add a new user topic
export function useCreateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => {
      const result = addTopic(data);
      if (result.error) throw new Error(result.error);
      return result.topic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

// Mutation: update a topic (only user-added topics; mockData topics succeed silently)
export function useUpdateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => {
      const result = updateTopic(id, data);
      if (result?.error) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

// Mutation: delete a user-added topic (throws for mockData topics)
export function useDeleteTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => {
      const result = deleteTopic(id);
      if (result?.error) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}
