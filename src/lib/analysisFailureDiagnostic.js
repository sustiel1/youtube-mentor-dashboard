const SAFE_CONTEXT_RADIUS = 300;

const SECRET_PATTERNS = [
  [/Bearer\s+[A-Za-z0-9._=\-]+/gi, 'Bearer [REDACTED]'],
  [/(Authorization|Cookie)\s*:\s*[^\r\n]+/gi, '$1: [REDACTED]'],
  [/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_GOOGLE_KEY]'],
  [/\bsk-(?:ant-)?[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_API_KEY]'],
  [/("(?:api[_-]?key|token|secret|password|client_secret)"\s*:\s*")[^"]*(")/gi, '$1[REDACTED]$2'],
];

const CATEGORY_COPY = {
  'transcript-missing': ['תמלול לא נמצא', 'לא נמצא תמלול שניתן להעביר לניתוח.', 'איסוף התמלול'],
  'transcript-fetch-failed': ['אחזור התמלול נכשל', 'לא ניתן היה לקבל את התמלול ממקור הווידאו.', 'אחזור התמלול'],
  'transcript-empty': ['התמלול שהתקבל ריק', 'מקור התמלול החזיר תוכן ריק.', 'אימות התמלול'],
  'transcript-untimed': ['לתמלול אין תזמון', 'התמלול קיים, אך לא נמצאו מקטעי זמן מאומתים.', 'אימות תזמון'],
  'provider-request-failed': ['בקשת Gemini נכשלה', 'הבקשה לספק הניתוח לא הושלמה.', 'בקשת ספק'],
  'provider-empty-response': ['Gemini החזיר תשובה ריקה', 'הספק לא החזיר תוכן שניתן לנתח.', 'קבלת תשובת ספק'],
  'provider-truncated-response': ['תשובת Gemini נקטעה', 'התקבל תוכן חלקי שאינו בטוח לטעינה.', 'קבלת תשובת ספק'],
  'json-malformed': ['Gemini החזיר JSON לא תקין', 'התוכן התקבל, אך מבנה ה־JSON אינו תקין ולכן עדיין אי אפשר לטעון אותו לאפליקציה.', 'פענוח תשובת Gemini'],
  'json-unescaped-quote': ['Gemini החזיר JSON לא תקין', 'התוכן התקבל, אך נמצאה כנראה מירכאה שלא עברה escaping בתוך הטקסט. הנתונים הקודמים לא נדרסו.', 'פענוח תשובת Gemini'],
  'json-code-fence': ['התקבלה מעטפת קוד במקום JSON', 'התוכן עטוף בסימוני Markdown ודורש אימות לפני טעינה.', 'פענוח תשובת Gemini'],
  'manual-input-not-json': ['הודבק קלט ל־GEM במקום פלט JSON', 'הטקסט מתחיל בבלוק VIDEO TITLE שנועד להישלח ל־Gemini. זה אינו פלט JSON ולא ניתן לטעון אותו לאפליקציה.', 'זיהוי קלט GEMS ידני'],
  'schema-invalid': ['מבנה הניתוח אינו נתמך', 'ה־JSON תקין תחבירית אך אינו מתאים לחוזה הנתונים של האפליקציה.', 'אימות מבנה'],
  'repair-failed': ['תיקון ה־JSON נכשל', 'ניסיון התיקון לא יצר payload תקין ובטוח.', 'תיקון payload'],
  'persistence-failed': ['שמירת הניתוח נכשלה', 'הנתונים אומתו אך לא נשמרו.', 'שמירת נתונים'],
  'unknown-analysis-failure': ['לא ניתן להשלים את הניתוח', 'אירעה תקלה שלא סווגה עדיין.', 'ניתוח'],
};

export function redactDiagnosticText(value = '') {
  let text = String(value);
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  return text.replace(/(?:fullTranscript|transcript)\s*[:=]\s*[\s\S]{700,}/gi, '[FULL TRANSCRIPT REDACTED]');
}

export function extractSafeFailureContext(raw = '', position = null) {
  if (!raw || !Number.isFinite(position)) return '';
  const text = String(raw);
  const safePosition = Math.max(0, Math.min(position, text.length));
  const start = Math.max(0, safePosition - SAFE_CONTEXT_RADIUS);
  const end = Math.min(text.length, safePosition + 1 + SAFE_CONTEXT_RADIUS);
  const before = redactDiagnosticText(text.slice(start, safePosition));
  const character = redactDiagnosticText(text.slice(safePosition, safePosition + 1)) || '[END OF INPUT]';
  const after = redactDiagnosticText(text.slice(safePosition + 1, end));
  return `${before}⟦OFFSET ${safePosition} · CHAR ${JSON.stringify(character)}⟧${after}`;
}

export function resolveFailureLocation(message = '', raw = '', explicitPosition = null) {
  const text = String(message || '');
  const positionMatch = text.match(/\bposition\s+(\d+)\b/i);
  const lineColumnMatch = text.match(/\bline\s+(\d+)\s+column\s+(\d+)\b/i);
  const position = Number.isFinite(explicitPosition)
    ? explicitPosition
    : positionMatch
      ? Number(positionMatch[1])
      : null;
  let line = lineColumnMatch ? Number(lineColumnMatch[1]) : null;
  let column = lineColumnMatch ? Number(lineColumnMatch[2]) : null;
  let computedLine = null;
  let computedColumn = null;
  if (Number.isFinite(position) && raw) {
    const before = String(raw).slice(0, position);
    const rows = before.split(/\r?\n/);
    computedLine = rows.length;
    computedColumn = (rows[rows.length - 1]?.length || 0) + 1;
    if (!line || !column) {
      line = computedLine;
      column = computedColumn;
    }
  }
  return {
    position,
    line,
    column,
    computedLine,
    computedColumn,
    disagreement: Boolean(
      lineColumnMatch && computedLine && computedColumn &&
      (line !== computedLine || column !== computedColumn)
    ),
  };
}

function looksLikeUnescapedQuote(raw, position) {
  if (!raw || !Number.isFinite(position)) return false;
  const nearby = String(raw).slice(Math.max(0, position - 160), position + 160);
  return /[\u0590-\u05ffA-Za-z0-9]\s*"[\u0590-\u05ffA-Za-z]/.test(nearby) || /(?:דו|עו)"[\u0590-\u05ff]/.test(nearby);
}

export function classifyAnalysisFailure({ code, message = '', raw = '', position = null, stage } = {}) {
  const inputKind = detectManualGemsInputKind(raw);
  const effectivePosition = inputKind === 'transcript-context' && !Number.isFinite(position)
    ? Math.max(0, String(raw).search(/\S/))
    : position;
  const location = resolveFailureLocation(message, raw, effectivePosition);
  const normalized = `${code || ''} ${message}`.toLowerCase();
  let category = 'unknown-analysis-failure';
  if (inputKind === 'transcript-context') category = 'manual-input-not-json';
  else if (/transcript.*missing|no transcript/.test(normalized)) category = 'transcript-missing';
  else if (/transcript.*fetch|caption.*fetch/.test(normalized)) category = 'transcript-fetch-failed';
  else if (/transcript.*empty/.test(normalized)) category = 'transcript-empty';
  else if (/untimed|missing.*timing/.test(normalized)) category = 'transcript-untimed';
  else if (/provider.*empty|empty_provider_response/.test(normalized)) category = 'provider-empty-response';
  else if (/truncat|unexpected end|unterminated/.test(normalized)) category = 'provider-truncated-response';
  else if (/schema|invalid_market_schema/.test(normalized)) category = 'schema-invalid';
  else if (/repair/.test(normalized)) category = 'repair-failed';
  else if (/persist|storage|save failed/.test(normalized)) category = 'persistence-failed';
  else if (/request|network|fetch failed|gemini_error/.test(normalized)) category = 'provider-request-failed';
  else if (/```/.test(raw)) category = 'json-code-fence';
  else if (/json|unexpected token|expected |property value|comma/.test(normalized)) {
    category = looksLikeUnescapedQuote(raw, location.position) ? 'json-unescaped-quote' : 'json-malformed';
  }
  const [titleHe, messageHe, defaultStage] = CATEGORY_COPY[category];
  const repairable = category.startsWith('json-') || category === 'schema-invalid' || category === 'repair-failed';
  return {
    category,
    stage: stage || defaultStage,
    titleHe,
    messageHe,
    technicalMessage: redactDiagnosticText(message || code || 'Unknown failure'),
    line: location.line,
    column: location.column,
    offset: location.position,
    offendingCharacter: Number.isFinite(location.position) ? String(raw).slice(location.position, location.position + 1) : '',
    computedLine: location.computedLine,
    computedColumn: location.computedColumn,
    locationDisagreement: location.disagreement,
    safeContext: extractSafeFailureContext(raw, location.position),
    retryable: !['persistence-failed'].includes(category),
    currentPayloadRepairable: repairable,
    previousDataPreserved: true,
    recommendedUserActionHe: category === 'manual-input-not-json'
      ? 'חזור ל־Gemini, המתן לסיום הניתוח, העתק את תשובת ה־JSON בלבד והדבק אותה בחלון GEMS JSON. אין להדביק כאן את בלוק התמלול שמתחיל ב־VIDEO TITLE.'
      : repairable
      ? 'אפשר לנסות תיקון בטוח של ה־JSON הנוכחי, או להעתיק דוח ל־Codex כדי לתקן את מקור התקלה לניתוחים הבאים.'
      : 'אפשר לנסות שוב, או להעתיק דוח ל־Codex לצורך אבחון מקור התקלה.',
    codexReportAvailable: true,
  };
}

export function detectManualGemsInputKind(raw = '') {
  const text = String(raw || '').trimStart();
  if (!text) return 'empty';
  if (/^VIDEO TITLE\s*:/i.test(text) && /\nTRANSCRIPT\s*:/i.test(text)) return 'transcript-context';
  if (text.startsWith('{') || text.startsWith('[') || /^```(?:json)?/i.test(text)) return 'json-candidate';
  return 'plain-text';
}

function fingerprintText(value) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `afd-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildPayloadProcessingTrace({ rawProviderOutput = '', parserInput = '', position = null } = {}) {
  const raw = String(rawProviderOutput || '');
  const parsed = String(parserInput || '');
  const identical = raw === parsed;
  return {
    rawLength: raw.length,
    parserInputLength: parsed.length,
    rawHash: fingerprintText(raw),
    parserInputHash: fingerprintText(parsed),
    relation: identical ? 'identical' : 'changed-before-parse',
    originAssessment: identical
      ? 'The malformed sequence already existed in the captured input; no application post-processing change was detected before JSON.parse.'
      : 'The parser input differs from the captured provider output; audit the bounded transformation stages before assigning origin.',
    rawExcerpt: extractSafeFailureContext(raw, position),
    parserInputExcerpt: extractSafeFailureContext(parsed, position),
  };
}

export function buildAnalysisFailureFingerprint(diagnostic, { route = '', schemaVersion = '' } = {}) {
  const normalizedMessage = String(diagnostic?.technicalMessage || '')
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/\s+(?:at|position|line|column)\s+#.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return fingerprintText([diagnostic?.category, diagnostic?.stage, normalizedMessage, schemaVersion, route].join('|'));
}

export function buildCodexRepairPrompt(diagnostic, metadata = {}) {
  const line = diagnostic?.line ?? 'unknown';
  const column = diagnostic?.column ?? 'unknown';
  const safeContext = diagnostic?.safeContext || '(not available)';
  const fingerprint = buildAnalysisFailureFingerprint(diagnostic, metadata);
  const trace = metadata.payloadTrace || null;
  return `Fix the recurring Gemini transcript-analysis failure described below.

Failure category:
${diagnostic?.category || 'unknown-analysis-failure'}

Failure stage:
${diagnostic?.stage || 'unknown'}

Safe parser error:
${redactDiagnosticText(diagnostic?.technicalMessage || '(not available)')}

Location:
Line ${line}, column ${column}
Character offset: ${diagnostic?.offset ?? 'unknown'}
Offending character: ${diagnostic?.offendingCharacter ? JSON.stringify(diagnostic.offendingCharacter) : 'unknown'}
${diagnostic?.locationDisagreement ? `WARNING: message location differs from offset-derived location (computed line ${diagnostic.computedLine}, column ${diagnostic.computedColumn}).` : ''}

Safe nearby context (bounded and redacted):
${redactDiagnosticText(safeContext)}

Observed behavior:
${metadata.observedBehavior || 'The application rejected the provider output and preserved previous valid data.'}

Safe environment metadata:
- Route/component: ${metadata.route || 'VideoDetailPanel / GEMS JSON'}
- Provider: ${metadata.provider || 'Gemini'}
- Model: ${metadata.model || 'unknown'}
- Response MIME mode: ${metadata.responseMimeType || 'unknown'}
- Schema mode: ${metadata.schemaMode || 'unknown'}
- Direct parse result: ${metadata.directParseResult || 'failed'}
- Repair-attempt count: ${Number.isFinite(metadata.repairAttemptCount) ? metadata.repairAttemptCount : 0}
- Automatic repair eligible: ${String(Boolean(metadata.repairEligible))}
- Repair eligibility reason: ${metadata.repairEligibilityReason || 'not reported'}
- Output appears truncated: ${String(Boolean(metadata.outputTruncated))}
- Previous valid data preserved: ${String(diagnostic?.previousDataPreserved !== false)}
- App branch/version: ${metadata.branch || 'not exposed to browser'}
- Failure fingerprint: ${fingerprint}
- Transcript: [FULL TRANSCRIPT REDACTED]
${trace ? `
Safe payload processing trace:
- Raw captured length/hash: ${trace.rawLength} / ${trace.rawHash}
- Parser input length/hash: ${trace.parserInputLength} / ${trace.parserInputHash}
- Relationship: ${trace.relation}
- Origin assessment: ${trace.originAssessment}
- Raw excerpt: ${trace.rawExcerpt || '(not available)'}
- Parser-input excerpt: ${trace.parserInputExcerpt || '(not available)'}` : ''}

Expected behavior:
- Gemini output is valid structured JSON.
- Hebrew text containing abbreviations and quotes remains intact.
- Strict parsing and schema validation succeed.
- Previous valid application data is never overwritten on failure.
- At most one bounded repair attempt is allowed.

Instructions:
1. Audit the active Gemini route, response MIME type, response schema, parser, repair and persistence flow.
2. Identify the verified root cause before editing.
3. Prefer provider-supported structured JSON.
4. Do not implement broad regex quote replacement.
5. Add a focused regression fixture based on this failure.
6. Preserve 0, false, Unicode and decimal timestamps.
7. Preserve existing transcript segments and chapter timing.
8. Run focused tests, routing regressions, production build and git diff --check.
9. Do not stage, commit, push or deploy.`;
}

export const ANALYSIS_FAILURE_CATEGORIES = Object.freeze(Object.keys(CATEGORY_COPY));
