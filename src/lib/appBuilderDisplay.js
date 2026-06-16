/**
 * Presentation-only parsers for APP Builder tab.
 * Does not change storage keys or extraction — serializes back to section strings.
 */

const FIELD_PATTERNS = [
  { key: 'appName', re: /^(?:app\s*name|שם\s*(?:ה)?אפליקציה|שם)\s*[:：]\s*(.+)$/i },
  { key: 'purpose', re: /^(?:purpose|מטרה|יעד)\s*[:：]\s*(.+)$/i },
  { key: 'value', re: /^(?:value|main\s*value|ערך|ערך\s*עיקרי|value\s*proposition)\s*[:：]\s*(.+)$/i },
  { key: 'complexity', re: /^(?:complexity|מורכבות|רמת\s*מורכבות)\s*[:：]\s*(.+)$/i },
];

const TRIGGER_LINE_RE =
  /(?:crosses|falls?\s+below|exceeds|above|below|מעל|מתחת|עובר|ירידה\s*מתחת|נפח|volume|alert|התראה|trigger)/i;

export function parseAppBuilderLines(text) {
  return String(text ?? '')
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[\s•\-–—]+/, '').trim())
    .filter(Boolean);
}

export function parseNumberedSteps(text) {
  const lines = parseAppBuilderLines(text);
  return lines.map((line, idx) => {
    const m = line.match(/^(?:\d+[\).\]:]?\s*|step\s*\d+\s*[:：]?\s*)(.*)$/i);
    return { id: idx, text: m ? m[1].trim() : line };
  });
}

export function serializeNumberedSteps(steps) {
  if (!steps.length) return '';
  return steps.map((s, i) => `${i + 1}. ${String(s.text ?? '').trim()}`).join('\n');
}

export function isTriggerLine(line) {
  const raw = String(line ?? '').trim();
  if (!raw) return false;
  if (/^[🚀⚠️⚡]/.test(raw)) return true;
  return TRIGGER_LINE_RE.test(raw);
}

export function splitTriggersAndRisks(text) {
  const lines = parseAppBuilderLines(text);
  const triggers = [];
  const risks = [];
  for (const line of lines) {
    if (line === '🚀' || line === '⚠') {
      if (line === '🚀') triggers.push('');
      else risks.push('');
      continue;
    }
    if (isTriggerLine(line)) triggers.push(line.replace(/^[🚀⚠️⚡]\s*/, '').trim());
    else risks.push(line.replace(/^⚠\s*/, '').trim());
  }
  return { triggers, risks };
}

export function mergeTriggersAndRisks(triggers, risks) {
  const tLines = triggers.map((t) => {
    const raw = String(t ?? '').trim();
    if (!raw) return '🚀';
    return /^[🚀⚠️]/.test(raw) ? raw : `🚀 ${raw}`;
  });
  const rLines = risks.map((r) => {
    const raw = String(r ?? '').trim();
    if (!raw) return '⚠';
    return /^⚠/.test(raw) ? raw : `⚠ ${raw}`;
  });
  return [...tLines, ...rLines].join('\n');
}

export function parseTasks(text) {
  return parseAppBuilderLines(text).map((line, idx) => {
    const done = /^[☑✓✗x]|^\[x\]/i.test(line);
    const label = line
      .replace(/^[☑✓✗x☐□■▪]\s*/i, '')
      .replace(/^\[[\sxX]\]\s*/, '')
      .trim();
    return { id: idx, text: label, done };
  });
}

export function serializeTasks(tasks) {
  if (!tasks.length) return '';
  return tasks
    .map((t) => {
      const label = String(t.text ?? '').trim();
      const mark = t.done ? '☑' : '☐';
      return label ? `${mark} ${label}` : mark;
    })
    .join('\n');
}

/** Parse App Idea fields from summary + requirements (+ optional screens). */
export function parseAppIdea(summary, requirements, screens = '') {
  const blob = [summary, requirements, screens].filter(Boolean).join('\n');
  const fields = { appName: '', purpose: '', value: '', complexity: '' };
  const consumed = new Set();

  for (const line of parseAppBuilderLines(blob)) {
    for (const { key, re } of FIELD_PATTERNS) {
      const m = line.match(re);
      if (m && !fields[key]) {
        fields[key] = m[1].trim();
        consumed.add(line);
      }
    }
  }

  const remaining = parseAppBuilderLines(blob).filter((l) => !consumed.has(l));

  if (!fields.appName && remaining.length > 0) {
    fields.appName = remaining[0];
    remaining.shift();
  }
  if (!fields.purpose && remaining.length > 0) {
    fields.purpose = remaining.join('\n');
    remaining.length = 0;
  }

  if (!fields.value && requirements && !summary) {
    fields.value = requirements.trim();
  }

  return fields;
}

/** Serialize hero fields back to summary + requirements (storage unchanged). */
export function serializeAppIdea(fields) {
  const summaryParts = [];
  if (fields.appName?.trim()) summaryParts.push(`App Name: ${fields.appName.trim()}`);
  if (fields.purpose?.trim()) summaryParts.push(`Purpose: ${fields.purpose.trim()}`);

  const reqParts = [];
  if (fields.value?.trim()) reqParts.push(`Value: ${fields.value.trim()}`);
  if (fields.complexity?.trim()) reqParts.push(`Complexity: ${fields.complexity.trim()}`);

  return {
    summary: summaryParts.join('\n'),
    requirements: reqParts.join('\n'),
  };
}

export function parseScreensList(text) {
  return parseAppBuilderLines(text);
}
