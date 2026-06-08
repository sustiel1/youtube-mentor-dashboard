/**
 * Normalizes and validates political content analysis results.
 * Supports both old Gemini string[] format, Claude rich object[] format,
 * and external GEM JSON format (timestamp strings, nested ideologyAnalysis, etc).
 */

function tsToSec(ts) {
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  if (typeof ts !== 'string') return null;
  const parts = ts.split(':').map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1];
  return null;
}

function pickStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => {
      if (typeof x === 'string') return x.trim();
      if (x && typeof x === 'object') {
        // counterArguments old: { topic, counterArgument }
        if (x.counterArgument) {
          const topic = typeof x.topic === 'string' ? x.topic.trim() : '';
          const ca = String(x.counterArgument).trim();
          return topic ? `${topic}: ${ca}` : ca;
        }
        // counterArguments GEM format: { claim, counter }
        if (x.counter) {
          const claim = typeof x.claim === 'string' ? x.claim.trim() : '';
          const counter = String(x.counter).trim();
          return claim ? `${claim} — ${counter}` : counter;
        }
        // socialMediaReplies: { platform, text }
        if (x.text && x.platform) {
          return `[${String(x.platform).trim()}] ${String(x.text).trim()}`;
        }
        // arguments: { claim, evidence/proof/strength }
        if (x.claim) {
          const claim = String(x.claim).trim();
          const proof = String(x.proof || x.evidence || '').trim();
          return proof ? `${claim} — ${proof}` : claim;
        }
        // allPoints / knowledgePoints: various GEM formats
        return String(
          x.point || x.fact || x.insight || x.rule || x.warning ||
          x.text || x.summary || x.title || x.value || ''
        ).trim();
      }
      return String(x || '').trim();
    })
    .filter(Boolean);
}

export function normalizePoliticalResult(parsed) {
  // Extract nested ideologyAnalysis if present (GEM format)
  const ideologyData = (parsed?.ideologyAnalysis && typeof parsed.ideologyAnalysis === 'object')
    ? parsed.ideologyAnalysis
    : {};

  // allPoints → merge into keyPoints
  const allPointsExtra = Array.isArray(parsed?.allPoints)
    ? pickStrings(parsed.allPoints)
    : [];

  // brainInsights → merge into keyPoints
  const brainInsightsExtra = Array.isArray(parsed?.brainInsights)
    ? parsed.brainInsights.filter((x) => typeof x === 'string' && x.trim())
    : [];

  // knowledgePoints (GEM format) → merge into keyPoints; supports strings AND objects ({ fact, insight, rule, warning, point, text, ... })
  const rawKnowledgePoints = parsed?.knowledgePoints;
  const knowledgePointsExtra = pickStrings(Array.isArray(rawKnowledgePoints) ? rawKnowledgePoints : []);
  if (Array.isArray(rawKnowledgePoints) && rawKnowledgePoints.length > 0) {
    console.log('[knowledge-debug] validatePolitical', {
      rawKnowledgePointsCount: rawKnowledgePoints.length,
      normalizedKnowledgePointsCount: knowledgePointsExtra.length,
      sample: rawKnowledgePoints[0],
    });
  }

  const baseKeyPoints = pickStrings(parsed?.keyPoints);
  let mergedKeyPoints = [
    ...new Set([...baseKeyPoints, ...allPointsExtra, ...brainInsightsExtra, ...knowledgePointsExtra]),
  ].slice(0, 60);

  // Fallback: if keyPoints empty after merge, derive reusable insights from other rich fields
  if (mergedKeyPoints.length === 0) {
    const fallback = [
      ...pickStrings(parsed?.arguments).slice(0, 10),
      ...(Array.isArray(parsed?.viralQuotes)
        ? parsed.viralQuotes.filter(q => typeof q === 'string' && q.trim()).map(q => q.trim()).slice(0, 5)
        : []),
      ...pickStrings(parsed?.weakPoints).slice(0, 5),
      ...pickStrings(parsed?.counterArguments).slice(0, 5),
    ];
    mergedKeyPoints = [...new Set(fallback)].slice(0, 30);
  }

  // chapters — support both startSeconds (Claude) and timestamp "HH:MM:SS" (GEM)
  const chapters = Array.isArray(parsed?.chapters)
    ? parsed.chapters.map((ch, i, arr) => {
        const startSeconds = tsToSec(ch.startSeconds) ?? tsToSec(ch.timestamp) ?? (i * 120);
        const nextCh = arr[i + 1];
        const endSeconds = tsToSec(ch.endSeconds)
          ?? (nextCh ? (tsToSec(nextCh.startSeconds) ?? tsToSec(nextCh.timestamp)) : null);
        return {
          ...ch,
          startSeconds,
          endSeconds: endSeconds ?? null,
          title: String(ch.title || '').trim(),
          summary: String(ch.summary || '').trim(),
          keyPoints: Array.isArray(ch.keyPoints)
            ? ch.keyPoints.filter((p) => typeof p === 'string' && p.trim())
            : [],
        };
      })
    : [];

  const networkSlogans = Array.isArray(parsed?.networkSlogans)
    ? parsed.networkSlogans
        .filter((s) => s && (typeof s === 'string' ? s.trim() : s.text))
        .map((s) => {
          if (typeof s === 'string') return { text: s.trim(), tone: '', useCase: '', sourceIdea: '' };
          return {
            text: String(s.text || '').trim(),
            tone: String(s.tone || '').trim(),
            useCase: String(s.useCase || '').trim(),
            sourceIdea: String(s.sourceIdea || '').trim(),
          };
        })
        .filter((s) => s.text)
    : [];

  const politicalSlogans = Array.isArray(parsed?.politicalSlogans)
    ? parsed.politicalSlogans
        .filter((s) => s && (typeof s === 'string' ? s.trim() : s.text))
        .map((s) => {
          if (typeof s === 'string') return { text: s.trim(), tone: '', confidence: 0, sourceIdea: '' };
          return {
            text: String(s.text || '').trim(),
            tone: String(s.tone || '').trim(),
            confidence: Number(s.confidence) || 0,
            sourceIdea: String(s.sourceIdea || '').trim(),
          };
        })
        .filter((s) => s.text)
    : [];

  const viralQuotes = Array.isArray(parsed?.viralQuotes)
    ? parsed.viralQuotes.filter((q) => typeof q === 'string' && q.trim()).map((q) => q.trim())
    : [];

  // debateResponses: support strings OR { claim, response } objects (GEM format)
  const debateResponses = Array.isArray(parsed?.debateResponses)
    ? parsed.debateResponses
        .filter(Boolean)
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item?.response) {
            const claim = typeof item.claim === 'string' ? item.claim.trim() : '';
            const response = String(item.response).trim();
            return claim ? `${claim}: ${response}` : response;
          }
          return null;
        })
        .filter(Boolean)
    : [];

  // commentBank: support strings OR { text, tone } objects (GEM format)
  const commentBank = Array.isArray(parsed?.commentBank)
    ? parsed.commentBank
        .filter(Boolean)
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item?.text) return String(item.text).trim();
          return null;
        })
        .filter(Boolean)
    : [];

  // Extract from ideologyAnalysis nested object (GEM format)
  const rhetoricalTechniques = pickStrings(
    Array.isArray(parsed?.rhetoricalTechniques) ? parsed.rhetoricalTechniques
      : Array.isArray(ideologyData?.persuasionTechniques) ? ideologyData.persuasionTechniques
      : null
  );
  const hiddenAssumptions = pickStrings(
    Array.isArray(parsed?.hiddenAssumptions) ? parsed.hiddenAssumptions
      : Array.isArray(ideologyData?.hiddenAssumptions) ? ideologyData.hiddenAssumptions
      : null
  );
  const emotionalFraming = pickStrings(
    Array.isArray(parsed?.emotionalFraming) ? parsed.emotionalFraming
      : Array.isArray(ideologyData?.emotionalTriggers) ? ideologyData.emotionalTriggers
      : null
  );
  const audienceTargeting = parsed?.audienceTargeting
    || (ideologyData?.targetAudience ? { segments: Array.isArray(ideologyData.targetAudience) ? ideologyData.targetAudience : [ideologyData.targetAudience] } : null);
  const ideologicalMapping = parsed?.ideologicalMapping
    || (ideologyData?.politicalCamp ? {
        description: ideologyData.politicalCamp,
        values: Array.isArray(ideologyData.coreValues) ? ideologyData.coreValues : [],
      } : null);

  // weakPoints: merge from parsed + ideologyAnalysis.logicalWeaknesses
  const weakPoints = pickStrings([
    ...(Array.isArray(parsed?.weakPoints) ? parsed.weakPoints : []),
    ...(Array.isArray(ideologyData?.logicalWeaknesses) ? ideologyData.logicalWeaknesses : []),
  ]);

  return {
    ...parsed,
    contentType: 'political',
    keyPoints: mergedKeyPoints,
    arguments: pickStrings(parsed?.arguments),
    weakPoints,
    counterArguments: pickStrings(parsed?.counterArguments),
    socialMediaReplies: pickStrings(parsed?.socialMediaReplies),
    chapters,
    tags: pickStrings(parsed?.tags),
    networkSlogans,
    politicalSlogans,
    viralQuotes,
    debateResponses,
    commentBank,
    // Extended Claude fields — pass through for UI access
    ideologicalMapping,
    rhetoricalTechniques,
    hiddenAssumptions,
    audienceTargeting,
    emotionalFraming,
    contradictions: pickStrings(parsed?.contradictions),
    longTermImplications: pickStrings(parsed?.longTermImplications),
    // Explicit passthrough so UI can access the full ideologyAnalysis object
    ideologyAnalysis: parsed?.ideologyAnalysis || null,
  };
}

export function validatePoliticalQuality({ parsed, transcriptLength = 0 }) {
  const reasons = [];
  const shortSummary = String(parsed?.shortSummary || '').trim();
  const fullSummary = String(parsed?.fullSummary || '').trim();
  const mainClaim = String(parsed?.mainClaim || '').trim();
  const chapters = Array.isArray(parsed?.chapters) ? parsed.chapters : [];
  const allowChapterless = transcriptLength >= 300 && transcriptLength < 2000;

  if (!mainClaim && shortSummary.length + fullSummary.length < 40) {
    reasons.push('political analysis missing mainClaim and summary');
  }
  if (!allowChapterless && chapters.length === 0) {
    reasons.push('political analysis missing chapters');
  }
  if (
    !allowChapterless &&
    chapters.some((c) => !Number.isFinite(Number(c?.startSeconds)))
  ) {
    reasons.push('political chapter timestamp missing');
  }

  return { ok: reasons.length === 0, reasons };
}

export function serializePoliticalResponse(parsed, modelId) {
  return {
    mode: 'analysis',
    provider: 'gemini',
    model: modelId,
    contentType: 'political',
    language: parsed?.language || 'he',
    shortSummary: String(parsed?.shortSummary || '').trim(),
    fullSummary: String(parsed?.fullSummary || '').trim(),
    mainClaim: String(parsed?.mainClaim || '').trim() || null,
    speakerPosition: String(parsed?.speakerPosition || '').trim() || null,
    politicalArguments: Array.isArray(parsed?.arguments) ? parsed.arguments : [],
    weakPoints: Array.isArray(parsed?.weakPoints) ? parsed.weakPoints : [],
    counterArguments: Array.isArray(parsed?.counterArguments) ? parsed.counterArguments : [],
    socialMediaReplies: Array.isArray(parsed?.socialMediaReplies) ? parsed.socialMediaReplies : [],
    keyPoints: Array.isArray(parsed?.keyPoints) ? parsed.keyPoints : [],
    chapters: Array.isArray(parsed?.chapters) ? parsed.chapters : [],
    tags: Array.isArray(parsed?.tags) ? parsed.tags : [],
    networkSlogans: Array.isArray(parsed?.networkSlogans) ? parsed.networkSlogans : [],
    politicalSlogans: Array.isArray(parsed?.politicalSlogans) ? parsed.politicalSlogans : [],
    viralQuotes: Array.isArray(parsed?.viralQuotes) ? parsed.viralQuotes : [],
    debateResponses: Array.isArray(parsed?.debateResponses) ? parsed.debateResponses : [],
    commentBank: Array.isArray(parsed?.commentBank) ? parsed.commentBank : [],
    // Extended Claude fields
    ideologicalMapping: parsed?.ideologicalMapping || null,
    rhetoricalTechniques: Array.isArray(parsed?.rhetoricalTechniques) ? parsed.rhetoricalTechniques : [],
    hiddenAssumptions: Array.isArray(parsed?.hiddenAssumptions) ? parsed.hiddenAssumptions : [],
    audienceTargeting: parsed?.audienceTargeting || null,
    emotionalFraming: Array.isArray(parsed?.emotionalFraming) ? parsed.emotionalFraming : [],
    contradictions: Array.isArray(parsed?.contradictions) ? parsed.contradictions : [],
    longTermImplications: Array.isArray(parsed?.longTermImplications) ? parsed.longTermImplications : [],
  };
}
