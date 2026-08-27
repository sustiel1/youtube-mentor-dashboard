export const APPROVED_ORIGIN = 'http://localhost:5184';
export const EXPORT_PAGE_PATH = '/ytmdb-origin-export.html';

export const APPROVED_GIT_CONTEXT = Object.freeze({
  branch: 'docs/markdown-governance-cleanup',
  head: '14684c4f1d899e55012badd290949c9e5585ca71',
});

export const EXPECTED_WORKSPACE_INTEGRITY = Object.freeze({
  recordCount: 142,
  idChecksum: '9a3333fb',
  payloadChecksum: '23a8ea3b',
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

export const SESSION_STORAGE_FIXED_KEYS = Object.freeze([
  '_yt_note_entity_missing',
]);

export const SESSION_STORAGE_DYNAMIC_PREFIXES = Object.freeze([
  'summary-full-expanded:',
  'gems-paste-',
]);

export const INDEXED_DB_ALLOWLIST = Object.freeze({
  name: 'yt_mentor_db_v1',
  version: 1,
  stores: Object.freeze({
    attachments: Object.freeze({
      keyPath: 'id',
      autoIncrement: false,
      indexes: Object.freeze({
        videoId: Object.freeze({
          keyPath: 'videoId',
          unique: false,
          multiEntry: false,
        }),
      }),
    }),
  }),
});

export const CACHE_STORAGE_ALLOWLIST = Object.freeze([]);

export const UNSUPPORTED_APPLICATION_DATABASES = Object.freeze([
  'yt_mentor_app_data_v1',
]);

export const SECRET_LOCAL_STORAGE_KEYS = Object.freeze([
  'base44_access_token',
  'token',
]);

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate entries`);
  }
}

assertUnique(LOCAL_STORAGE_FIXED_KEYS, 'LOCAL_STORAGE_FIXED_KEYS');
assertUnique(LOCAL_STORAGE_DYNAMIC_PREFIXES, 'LOCAL_STORAGE_DYNAMIC_PREFIXES');
assertUnique(SESSION_STORAGE_FIXED_KEYS, 'SESSION_STORAGE_FIXED_KEYS');
assertUnique(SESSION_STORAGE_DYNAMIC_PREFIXES, 'SESSION_STORAGE_DYNAMIC_PREFIXES');

if (LOCAL_STORAGE_FIXED_KEYS.length !== 57) {
  throw new Error('The secret-free localStorage fixed-key allowlist must contain exactly 57 keys');
}

if (LOCAL_STORAGE_FIXED_KEYS.some((key) => key === 'token' || key.startsWith('base44_'))) {
  throw new Error('Authentication keys must not appear in the export allowlist');
}

if (CACHE_STORAGE_ALLOWLIST.length !== 0) {
  throw new Error('The approved Cache Storage allowlist must remain empty');
}
