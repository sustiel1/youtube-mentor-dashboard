// entities.js — Centralized access to all Base44 entities
// Entity names must match exactly what was created in the Base44 platform.
//
// Schema summary:
//
// Mentor:        { name, category (AI/Food/Markets), avatarUrl, active }
// Source:        { mentorId, sourceType (youtube/rss/site), sourceUrl, active, lastCheckedAt }
// Video:         { mentorId, sourceId, title, url, thumbnail, publishedAt, category,
//                  transcript, shortSummary, fullSummary, keyPoints[], tags[],
//                  status (new/processing/done/error), errorMessage,
//                  isSaved, learningStatus (not_started/in_progress/learned/to_review/completed),
//                  topicIds[] }
// ProcessingJob: { videoId, status (pending/running/completed/failed),
//                  errorMessage, startedAt, finishedAt }
// Topic:         { name, description, color, icon, createdAt }
// Note:          { videoId, content, createdAt, updatedAt }

import { base44 } from './base44Client';

export const Mentor = base44.entities.Mentor;
export const Source = base44.entities.Source;
export const Video = base44.entities.Video;
export const ProcessingJob = base44.entities.ProcessingJob;
export const Topic = base44.entities.Topic;
export const Note = base44.entities.Note;
export const Category = base44.entities.Category;
