import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mentor, Source } from '@/api/entities';
import { isBase44Enabled } from '@/config/base44Flags';
import { MENTORS } from '@/data/mockData';
import { getLocalCustomMentors, upsertLocalCustomMentor, updateLocalCustomMentorById } from '@/lib/localCustomMentorsStore';
import {
  normalizeMentorYouTubeSourceUrl,
  isAcceptableMentorSourceUrl,
  extractHandleFromUrl,
  extractChannelIdFromUrl,
} from '@/lib/mentorSourceUrl';
import { repairChannelId } from '@/services/channelResolver';
import { loadTopics } from '@/services/topicStorage';
import { getMainTopicForTopic } from '@/lib/topicFilters';
import { appendChannelCollection } from '@/lib/localChannelCollectionsStore';
import { applyTopicOverridesToMentors, setMentorTopicOverride } from '@/lib/mentorTopicOverrides';
import {
  hideMentor,
  restoreMentor,
  getHiddenMentorIds,
  filterVisibleMentors,
} from '@/services/mentorStorage';

function mergeAllMentors() {
  return applyTopicOverridesToMentors([...MENTORS, ...getLocalCustomMentors()]);
}

function normalizeChannelId(value) {
  const id = String(value || '').trim();
  return id.startsWith('UC') && id.length === 24 ? id : '';
}

/** Map selected topic (or its parent main topic) to mentor category codes. */
function resolveCategoryFromTopicIds(topicIds) {
  const topics = loadTopics();
  const tid = topicIds?.[0];
  if (!tid) return 'AI';
  let cur = topics.find((x) => x.id === tid);
  if (!cur) return 'AI';
  const byId = Object.fromEntries(topics.map((x) => [x.id, x]));
  const seen = new Set();
  while (cur.parentId && byId[cur.parentId] && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId[cur.parentId];
  }
  // Try well-known root IDs first
  const rootId = cur.id;
  if (rootId === 't2') return 'Markets';
  if (rootId === 't9') return 'Dev';
  if (rootId === 't1') return 'AI';
  // Keyword fallback covering all category codes
  const name = String(cur.name || '').toLowerCase();
  if (name.includes('שוק') && name.includes('הון')) return 'Markets';
  if (name.includes('פיתוח')) return 'Dev';
  if (name.includes('בינה') || name.includes('ai') || name.includes('אוטומציה')) return 'AI';
  if (name.includes('פוליטיקה') || name.includes('politics')) return 'Politics';
  if (name.includes('בריאות') || name.includes('health') || name.includes('תזונה') || name.includes('כושר')) return 'Health';
  if (name.includes('מוזיקה') || name.includes('music')) return 'Music';
  if (name.includes('אוכל') || name.includes('בישול') || name.includes('food')) return 'Food';
  return 'AI';
}

// Local mode — returns mock data minus hidden mentors
export function useMentors() {
  return useQuery({
    queryKey: ['mentors'],
    queryFn: async () => filterVisibleMentors(mergeAllMentors()),
  });
}

// Local mode — returns active visible mentors
export function useActiveMentors() {
  return useQuery({
    queryKey: ['mentors', 'active'],
    queryFn: async () => filterVisibleMentors(mergeAllMentors()).filter((m) => m.active),
  });
}

// Returns the full objects of currently hidden mentors
export function useHiddenMentors() {
  return useQuery({
    queryKey: ['mentors', 'hidden'],
    queryFn: async () => {
      const hiddenIds = new Set(getHiddenMentorIds());
      return mergeAllMentors().filter((m) => hiddenIds.has(m.id));
    },
  });
}

// Mutation: create a mentor
export function useCreateMentor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mentorData) => {
      if (!isBase44Enabled()) {
        return Promise.reject(
          new Error('מצב local-first: יצירת מנטור דורשת VITE_ENABLE_BASE44=true'),
        );
      }
      return Mentor.create(mentorData);
    },
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
      if (!isBase44Enabled()) {
        const combined = mergeAllMentors();
        const visible = filterVisibleMentors(combined);
        const nameLower = mentorData.name.trim().toLowerCase();
        const rawSource = String(sourceUrl || '').trim();
        const st = sourceType || 'youtube';
        const pageUrl =
          st === 'youtube' ? normalizeMentorYouTubeSourceUrl(rawSource) || rawSource : rawSource;
        const channelIdFromUrl = extractChannelIdFromUrl(pageUrl) || '';
        const dupByChannel = channelIdFromUrl
          ? visible.find((m) => normalizeChannelId(m.youtubeChannelId || m.channelId) === channelIdFromUrl)
          : null;
        if (dupByChannel) {
          return dupByChannel;
        }
        const dup = visible.some((m) => m.name.trim().toLowerCase() === nameLower);
        if (dup) {
          throw new Error('שם מנטור כבר קיים');
        }
        const id = `lm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
        const category = resolveCategoryFromTopicIds(mentorData.topicIds);
        if (st === 'youtube') {
          const candidate = normalizeMentorYouTubeSourceUrl(rawSource) || rawSource;
          if (!isAcceptableMentorSourceUrl(candidate)) {
            throw new Error('קישור YouTube לא תקין');
          }
        }
        const handle = extractHandleFromUrl(pageUrl) || null;
        const topicIds = Array.isArray(mentorData.topicIds) ? mentorData.topicIds : [];
        const topicsLoaded = loadTopics();
        const leafTopicId = topicIds[0];
        const mainTopicResolved = leafTopicId ? getMainTopicForTopic(leafTopicId, topicsLoaded) : null;

        const mentor = {
          id,
          name: mentorData.name.trim(),
          description: mentorData.description || null,
          category,
          topicIds,
          topic: mentorData.topic || null,
          avatarUrl: mentorData.avatarUrl || '',
          active: mentorData.active ?? true,
          youtubeChannelId: channelIdFromUrl,
          youtubePageUrl: pageUrl,
          channelUrl: pageUrl,
          youtubeUrl: pageUrl,
          handle,
        };
        let saved = upsertLocalCustomMentor(mentor);

        // Auto-resolve channelId when URL is @handle (extractChannelIdFromUrl returns "")
        let resolvedChannelId = channelIdFromUrl;
        if (!channelIdFromUrl && (handle || pageUrl)) {
          try {
            const result = await repairChannelId({
              mentor: saved,
              channelUrl: pageUrl,
              handle,
            });
            if (result.success && result.channelId) {
              resolvedChannelId = result.channelId;
              const withResolved = {
                ...saved,
                youtubeChannelId: result.channelId,
                channelId: result.channelId,
                channelUrl: result.channelUrl || pageUrl,
                youtubeUrl: result.youtubeUrl || result.channelUrl || pageUrl,
                youtubePageUrl: result.channelUrl || pageUrl,
                channelIdResolvedAt: new Date().toISOString(),
                channelIdResolveMethod: result.method,
              };
              saved = upsertLocalCustomMentor(withResolved);
            } else {
              console.warn('[useAddMentorWithSource] auto-resolve failed:', result.error);
            }
          } catch (e) {
            console.warn('[useAddMentorWithSource] auto-resolve error:', e.message);
          }
        }

        if (resolvedChannelId && mainTopicResolved?.id) {
          try {
            appendChannelCollection({
              title: `אוסף ${mentorData.name.trim()}`,
              topicId: mainTopicResolved.id,
              topic: mainTopicResolved.name,
              subTopic: String(mentorData.topic || '').trim() || 'כללי',
              channelId: resolvedChannelId,
              channelUrl: saved.channelUrl || pageUrl,
              channelName: mentorData.name.trim(),
              channelUrls: saved.channelUrl ? [saved.channelUrl] : pageUrl ? [pageUrl] : [],
            });
          } catch (e) {
            console.warn('[useAddMentorWithSource] appendChannelCollection', e);
          }
        }

        return saved;
      }
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
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// Mutation: update a mentor
export function useUpdateMentor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => {
      // Always persist topic-related fields to the override store (works for mock + custom mentors).
      const topicFields = {};
      if (data.topicIds !== undefined) topicFields.topicIds = data.topicIds;
      if (data.category !== undefined) topicFields.category = data.category;
      if (data.subTopic !== undefined) topicFields.subTopic = data.subTopic;
      if (data.subTopicId !== undefined) topicFields.subTopicId = data.subTopicId;
      if (Object.keys(topicFields).length) setMentorTopicOverride(id, topicFields);

      if (!isBase44Enabled()) {
        // In local-first mode, also try updating custom mentors store directly.
        updateLocalCustomMentorById(id, data);
        return Promise.resolve({ id, ...data });
      }
      return Mentor.update(id, data);
    },
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
