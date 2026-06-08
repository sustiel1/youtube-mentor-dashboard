const KEY_PREFIX = 'opponent_sentences_v1';

function storeKey(videoId) {
  return `${KEY_PREFIX}_${videoId}`;
}

export function getOpponentSentences(videoId) {
  if (!videoId) return [];
  try {
    const raw = localStorage.getItem(storeKey(videoId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSentences(videoId, sentences) {
  try {
    localStorage.setItem(storeKey(videoId), JSON.stringify(sentences));
  } catch {}
}

export function toggleOpponentSentence(videoId, { id, text, sourceTab, sourceIndex }) {
  const all = getOpponentSentences(videoId);
  const existsIdx = all.findIndex(s => s.id === id);
  let next;
  if (existsIdx !== -1) {
    next = all.filter(s => s.id !== id);
  } else {
    next = [...all, {
      id,
      text,
      sourceTab,
      sourceIndex,
      markedAt: new Date().toISOString(),
      response: null,
    }];
  }
  writeSentences(videoId, next);
  return next;
}

export function setOpponentSentenceResponse(videoId, sentenceId, response) {
  const all = getOpponentSentences(videoId);
  const idx = all.findIndex(s => s.id === sentenceId);
  if (idx === -1) return;
  all[idx] = { ...all[idx], response };
  writeSentences(videoId, all);
}
