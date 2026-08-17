export const APP_DATA_DB_NAME = 'yt_mentor_app_data_v1';
export const APP_DATA_DB_VERSION = 2;

export const APP_DATA_STORES = Object.freeze({
  META: 'meta',
  SOURCE_ENTRIES: 'sourceEntries',
  VIDEOS: 'videos',
  ANALYSES: 'analyses',
  TRANSCRIPTS: 'transcripts',
  WORKSPACE_ITEMS: 'workspaceItems',
  SNAPSHOTS: 'snapshots',
  MEDIA_BLOBS: 'mediaBlobs',
  MIGRATION_JOURNAL: 'migrationJournal',
  WORKSPACE_CHANGE_JOURNAL: 'workspaceChangeJournal',
});

export const LOCAL_STORAGE_FIXED_KEYS = Object.freeze([
  'yt_mentor_videos_v2',
  'yt_mentor_videos_cleared_v1',
  'yt_mentor_deleted_video_ids_v1',
  'yt_mentor_deleted_videos_archive_v1',
  'videos',
  'localVideos',
  'youtubeMentorVideos',
  'yt_mentor_videos_v1',
  'yt_mentor_transcript_cache_v1',
  'yt_mentor_youtube_chapter_cache_v1',
  'yt_transcript_segs_v1',
  'yt_chunks_v1',
  'yt_chunk_meta_v1',
  'yt_thumb_cache_v1',
  'yt_mentor_notes_v1',
  'yt_manual_notes_v1',
  'yt_sentence_notes_v1',
  'yt_knowledge_items_v1',
  'yt_knowledge_library_v1',
  'yt_kb_settings_v1',
  'yt_obsidian_item_saves_v1',
  'obsidian_settings_v1',
  'brain_custom_dests_v1',
  'brain_dest_subs_v1',
  'yt_custom_mentors_v1',
  'yt_mentor_hidden_ids_v1',
  'yt_mentor_scan_frozen_v1',
  'ym_channel_collections_v1',
  'yt_scan_history_v1',
  'yt_topic_user_v1',
  'yt_mentor_topic_overrides_v1',
  'ym_topic_order',
  'yt_mentor_last_sync_v1',
  'yt_mentor_last_sync_result_v1',
  'lastChannelScanAt',
  'lastChannelScanSummary',
  'nextChannelScanAt',
  'youtubeMentorScanDebug',
  'workspace_library_v1',
  'workspace_topics_v1',
  'workspace_tab_preferences_v1',
  'market_manual_finviz_mappings_v1',
  'app_builder_v1',
  'youtubeMentor.theme',
  'yt_claude_safety_v1',
  'yt_vault_sem_dismissed_v1',
  'yt_vault_sem_saved_v1',
  'gems_config',
  'gemUrl.general',
  'gemUrl.political',
  'gemUrl.market',
  'gemUrl.technical',
  'gemUrl.fundamental',
  'gemUrl.appBuilder',
  'gemUrl.macro',
  'gemUrl.news',
  'gemUrl.dayTrading',
  'base44_clear_access_token',
  'base44_app_id',
  'base44_access_token',
  'base44_from_url',
  'base44_functions_version',
  'base44_app_base_url',
  'token',
]);

export const LOCAL_STORAGE_DYNAMIC_PREFIXES = Object.freeze([
  'analysis:',
  'ai_analysis_',
  'app_builder_gem_paste_',
  'opponent_sentences_v1_',
  'market_brief_',
  'political_summary_',
  'gems-paste-',
  'gems-paste-cleared-',
  'gems-applied-',
  'gem-summary-waiting-',
  'gem-summary-',
  'hebrew_chapter_titles_',
  'gemUrl.topic_',
]);

const VIDEO_KEYS = new Set([
  'yt_mentor_videos_v2',
  'videos',
  'localVideos',
  'youtubeMentorVideos',
  'yt_mentor_videos_v1',
]);

const TRANSCRIPT_KEYS = new Set([
  'yt_mentor_transcript_cache_v1',
  'yt_mentor_youtube_chapter_cache_v1',
  'yt_transcript_segs_v1',
  'yt_chunks_v1',
  'yt_chunk_meta_v1',
]);

const WORKSPACE_KEYS = new Set([
  'workspace_library_v1',
  'workspace_topics_v1',
  'workspace_tab_preferences_v1',
]);

const MEDIA_KEYS = new Set(['yt_thumb_cache_v1']);

const ANALYSIS_PREFIXES = Object.freeze([
  'analysis:',
  'ai_analysis_',
  'app_builder_gem_paste_',
  'opponent_sentences_v1_',
  'market_brief_',
  'political_summary_',
  'gems-paste-',
  'gem-summary-',
  'hebrew_chapter_titles_',
]);

const SENSITIVE_EXACT_KEYS = new Set([
  'token',
  'base44_access_token',
]);

const SENSITIVE_KEY_PATTERN = /(?:^base44_|(?:^|[_-])(?:access[_-]?token|oauth|api[_-]?key|password|secret|private[_-]?key)(?:$|[_-]))/i;

export function isSensitiveStorageKey(key) {
  const normalized = String(key || '');
  return SENSITIVE_EXACT_KEYS.has(normalized) || SENSITIVE_KEY_PATTERN.test(normalized);
}

export function isApplicationOwnedStorageKey(key) {
  const normalized = String(key || '');
  if (!normalized || isSensitiveStorageKey(normalized)) return false;
  return LOCAL_STORAGE_FIXED_KEYS.includes(normalized)
    || LOCAL_STORAGE_DYNAMIC_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function classifyStorageKey(key) {
  if (VIDEO_KEYS.has(key)) return 'videos';
  if (TRANSCRIPT_KEYS.has(key)) return 'transcripts';
  if (WORKSPACE_KEYS.has(key)) return 'workspace';
  if (MEDIA_KEYS.has(key)) return 'media';
  if (ANALYSIS_PREFIXES.some((prefix) => key.startsWith(prefix))) return 'analyses';
  return 'documents';
}

export function listOwnedStorageKeys(storage) {
  if (!storage || typeof storage.getItem !== 'function') return [];
  const keys = new Set();

  for (const key of LOCAL_STORAGE_FIXED_KEYS) {
    if (isSensitiveStorageKey(key)) continue;
    if (storage.getItem(key) !== null) keys.add(key);
  }

  for (let index = 0; index < Number(storage.length || 0); index += 1) {
    const key = storage.key(index);
    if (isApplicationOwnedStorageKey(key)) keys.add(key);
  }

  return [...keys].sort();
}

if (LOCAL_STORAGE_FIXED_KEYS.length !== 64) {
  throw new Error('Expected exactly 64 verified fixed localStorage keys');
}
