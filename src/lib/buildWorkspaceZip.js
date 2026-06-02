import JSZip from 'jszip';
import { buildAtomicNotesFromVideo, buildVideoFullNote, resolvePrimaryTopic, slugify } from './obsidianExport.js';
import { resolveTopicBreadcrumb } from './topicFilters.js';
import { getManualNotes } from './localManualNoteStore.js';
import { getNotesByVideoId } from './localNoteStore.js';

const SOURCE_LABELS = { manual: 'ידני', notebooklm: 'NotebookLM', research: 'מחקר' };

function resolveVideoBrainPath(video, topics) {
  const firstTopicId = Array.isArray(video.topicIds) ? video.topicIds[0] : null;
  if (firstTopicId && topics.length) {
    const { main, sub } = resolveTopicBreadcrumb(firstTopicId, topics);
    const mainName = main?.name ? String(main.name).trim() : "";
    const subName  = sub?.name  ? String(sub.name).trim()  : "";
    if (mainName && subName) return `${mainName}/${subName}`;
    if (mainName) return mainName;
  }
  return resolvePrimaryTopic(video);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const FORMAT_LABELS = new Set(['weekly', 'daily', 'session']);

function isFormatLabel(name) {
  const n = String(name || '').trim().toLowerCase();
  return FORMAT_LABELS.has(n);
}

function buildManualNoteMarkdown(note, topicName, { format } = {}) {
  const tags = (note.tags || []).join(', ');
  const source = SOURCE_LABELS[note.sourceType] || note.sourceType || 'ידני';
  const fmt = isFormatLabel(format) ? String(format).trim().toLowerCase() : null;
  return [
    '---',
    'type: knowledge-note',
    ...(fmt ? [`format: ${fmt}`] : []),
    `source: ${note.sourceType || 'manual'}`,
    `topic: ${topicName}`,
    `tags: [${tags}]`,
    `created: ${(note.createdAt || todayStr()).slice(0, 10)}`,
    '---',
    '',
    `# ${note.title}`,
    '',
    `> *${source}*`,
    '',
    note.content || '',
  ].join('\n');
}

export function createEmptyAtomicByType() {
  return {
    insights: 0,
    rules: 0,
    actions: 0,
    mistakes: 0,
    concepts: 0,
    frameworks: 0,
    questions: 0,
    quotes: 0,
  };
}

function incrementAtomicByField(atomicByType, field) {
  if (field === 'mainLesson' || field === 'keyInsights' || field === 'brainHighlights' || field === 'keyPoints') atomicByType.insights += 1;
  else if (field === 'rules') atomicByType.rules += 1;
  else if (field === 'actionItems') atomicByType.actions += 1;
  else if (field === 'mistakesToAvoid') atomicByType.mistakes += 1;
  else if (field === 'concepts') atomicByType.concepts += 1;
  else if (field === 'frameworks') atomicByType.frameworks += 1;
  else if (field === 'questions') atomicByType.questions += 1;
  else if (field === 'quotes') atomicByType.quotes += 1;
}

/**
 * @param {{ videoNotes: number, atomicNotesTotal: number, atomicByType: ReturnType<typeof createEmptyAtomicByType> }} stats
 */
export function logWorkspaceZipExportSummary(stats) {
  const t = stats?.atomicByType || createEmptyAtomicByType();
  console.log(
    '[Obsidian ZIP export]',
    {
      videoNotes: stats?.videoNotes ?? 0,
      atomicNotesTotal: stats?.atomicNotesTotal ?? 0,
      atomicByType: {
        Insights: t.insights,
        Rules: t.rules,
        Actions: t.actions,
        Mistakes: t.mistakes,
        Concepts: t.concepts,
        Frameworks: t.frameworks,
        Questions: t.questions,
        Quotes: t.quotes,
      },
    }
  );
}

/**
 * @param {{ videoNotes: number, atomicNotesTotal: number }} stats
 */
export function formatZipExportSuccessHebrew(stats) {
  const x = stats?.videoNotes ?? 0;
  const y = stats?.atomicNotesTotal ?? 0;
  return `יוצאו ${x} הערות וידאו ו־${y} הערות אטומיות לאובסידיאן`;
}

function buildTopicIndex(topicName, videoFilenames, noteFilenames) {
  const lines = [
    '---',
    'type: topic-index',
    `topic: ${topicName}`,
    `generated: ${todayStr()}`,
    '---',
    '',
    `# ${topicName}`,
    '',
  ];
  if (videoFilenames.length > 0) {
    lines.push(`## סרטונים (${videoFilenames.length})`, '');
    for (const f of videoFilenames) lines.push(`- [[${f.replace(/\.md$/, '')}]]`);
    lines.push('');
  }
  if (noteFilenames.length > 0) {
    lines.push(`## הערות ידע (${noteFilenames.length})`, '');
    for (const f of noteFilenames) lines.push(`- [[${f.replace(/\.md$/, '')}]]`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Builds a JSZip object with the full Workspace structure.
 *
 * Structure:
 *   {Topic}/{Topic}.md             ← topic index
 *   {Topic}/Learnings/V-{slug}.md  ← analyzed video notes
 *   {Topic}/Notes/N-{slug}.md      ← manual knowledge notes
 *
 * @returns {{ zip: JSZip, exportStats: { videoNotes: number, atomicNotesTotal: number, atomicByType: Record<string, number> } }}
 */
export async function buildWorkspaceZip(videos, mentors, topics, { manualNotesOverride } = {}) {
  const zip = new JSZip();
  const atomicByType = createEmptyAtomicByType();
  let atomicNotesTotal = 0;

  const mentorMap = Object.fromEntries(mentors.map((m) => [m.id, m.name || '']));
  const topicMap  = Object.fromEntries(topics.map((t) => [t.id, t]));

  const allManualNotes = manualNotesOverride ?? getManualNotes();

  // Track filenames per resolved topic for index generation
  const topicContents = {};
  function ensureTopic(name) {
    if (!topicContents[name]) topicContents[name] = { videoFilenames: [], noteFilenames: [] };
    return topicContents[name];
  }

  // 1. Analyzed video notes (no raw transcript, no manual note duplication)
  const analyzedVideos = videos.filter((v) => v.analyzedAt);
  for (const video of analyzedVideos) {
    const mentorName = mentorMap[video.mentorId] || video.channelTitle || '';
    const notes      = getNotesByVideoId(video.videoId || video.id);

    const primaryTopic = resolveVideoBrainPath(video, topics);
    const selections = video.selectedKnowledgeItems;
    const atomicNotes = buildAtomicNotesFromVideo(video, selections);
    for (const atom of atomicNotes) {
      const relPath = `${primaryTopic}/${atom.folder}/${atom.slug}.md`;
      zip.file(relPath, atom.markdown);
      atomicNotesTotal += 1;
      incrementAtomicByField(atomicByType, atom.type);
    }

    const exportOpts =
      atomicNotes.length > 0
        ? {
            selections,
            atomicWikiLinks: atomicNotes.map((a) => `${primaryTopic}/${a.folder}/${a.slug}`),
          }
        : undefined;

    // manualNotes passed empty — they have their own dedicated files to avoid duplication
    const { content, filename, path } = buildVideoFullNote(
      video,
      mentorName,
      null,
      notes,
      [],
      exportOpts
    );
    zip.file(path, content);

    ensureTopic(primaryTopic).videoFilenames.push(filename);
  }

  // 2. Standalone manual / NotebookLM / research notes
  for (const note of allManualNotes) {
    let topicName  = 'General';
    let folderPath = 'General/Notes';
    let format = null;

    if (note.subtopicId && topicMap[note.subtopicId]) {
      const sub    = topicMap[note.subtopicId];
      const parent = topicMap[sub.parentId];
      if (parent) {
        // Obsidian-first: subtopics that are actually content formats should not create folders.
        if (isFormatLabel(sub.name)) {
          topicName  = parent.name;
          folderPath = `${parent.name}/Notes`;
          format     = sub.name;
        } else {
          topicName  = parent.name;
          folderPath = `${parent.name}/${sub.name}/Notes`;
        }
      } else {
        // If there's no parent, treat sub as the semantic topic.
        topicName  = sub.name;
        folderPath = `${sub.name}/Notes`;
      }
    } else if (note.topicId && topicMap[note.topicId]) {
      topicName  = topicMap[note.topicId].name;
      folderPath = `${topicName}/Notes`;
    }

    const slug     = slugify(note.title || 'note', 40);
    const filename = `N-${slug}.md`;
    zip.file(`${folderPath}/${filename}`, buildManualNoteMarkdown(note, topicName, { format }));
    ensureTopic(topicName).noteFilenames.push(filename);
  }

  // 3. Topic index files
  for (const [topicName, { videoFilenames, noteFilenames }] of Object.entries(topicContents)) {
    zip.file(`${topicName}/${topicName}.md`, buildTopicIndex(topicName, videoFilenames, noteFilenames));
  }

  const exportStats = {
    videoNotes: analyzedVideos.length,
    atomicNotesTotal,
    atomicByType,
  };

  return { zip, exportStats };
}
