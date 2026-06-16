/**
 * Humanization rules for App Ideas Brain display layer.
 * Add new rules to HUMANIZATION_RULES — no changes to the engine required.
 *
 * @typedef {Object} HumanizationRule
 * @property {string} id
 * @property {number} priority — higher runs first
 * @property {(text: string) => boolean} matches
 * @property {(text: string) => string|null} humanize
 */
import {
  formatDisplayNumber,
  parseKeyValueSegments,
  translateLevelWord,
} from '@/lib/appIdeasBrainHumanization/parseUtils';

/** @type {HumanizationRule} */
export const metricRule = {
  id: 'metric',
  priority: 100,
  matches(text) {
    const map = parseKeyValueSegments(text);
    return Boolean(map && (map.metric || (map.name && map.value != null)));
  },
  humanize(text) {
    const map = parseKeyValueSegments(text);
    if (!map) return null;
    const name = map.metric || map.name || map.asset || map.symbol;
    const value = map.value ?? map.price ?? map.level;
    if (!name && !value) return null;
    if (name && value != null && value !== '') {
      return `${name} נסחר כעת סביב ${formatDisplayNumber(value)}.`;
    }
    if (name) return `מדד/נכס: ${name}.`;
    return null;
  },
};

/** @type {HumanizationRule} */
export const triggerRule = {
  id: 'trigger',
  priority: 95,
  matches(text) {
    const t = String(text || '').toLowerCase();
    if (t.startsWith('trigger:')) return true;
    const map = parseKeyValueSegments(text);
    return Boolean(map?.trigger);
  },
  humanize(text) {
    const map = parseKeyValueSegments(text);
    const triggerText = map?.trigger || text.replace(/^trigger:\s*/i, '').split(/\s*\|\s*/)[0]?.trim();
    if (!triggerText) return null;

    const type = map?.type ? ` (${map.type})` : '';
    const crossesAbove = triggerText.match(/^(.+?)\s+crosses?\s+([\d.,]+)/i);
    if (crossesAbove) {
      return `לעקוב אחרי פריצה של ${crossesAbove[1].trim()} מעל ${formatDisplayNumber(crossesAbove[2])}${type}.`;
    }
    const fallsBelow = triggerText.match(/^(.+?)\s+falls?\s+below\s+([\d.,]+)/i);
    if (fallsBelow) {
      return `לעקוב אחרי ירידה של ${fallsBelow[1].trim()} מתחת ${formatDisplayNumber(fallsBelow[2])}${type}.`;
    }
    const exceeds = triggerText.match(/^(.+?)\s+exceeds?\s+([\d.,%]+)/i);
    if (exceeds) {
      return `לעקוב כש-${exceeds[1].trim()} חוצה ${formatDisplayNumber(exceeds[2])}${type}.`;
    }
    return `טריגר: ${triggerText}${type}.`;
  },
};

/** @type {HumanizationRule} */
export const riskRule = {
  id: 'risk',
  priority: 90,
  matches(text) {
    const t = String(text || '').trim().toLowerCase();
    if (/^risk:\s*(high|medium|low|critical)/i.test(t)) return true;
    const map = parseKeyValueSegments(text);
    return Boolean(map?.risk);
  },
  humanize(text) {
    const map = parseKeyValueSegments(text);
    const level = map?.risk || text.replace(/^risk:\s*/i, '').trim().split(/\s*\|\s*/)[0]?.trim();
    if (!level) return null;
    const he = translateLevelWord(level);
    if (/^(high|medium|low|critical)$/i.test(level)) {
      return `תרחיש סיכון ${he} — מומלץ אישור נוסף לפני פעולה.`;
    }
    return `סיכון: ${level}.`;
  },
};

/** @type {HumanizationRule} */
export const levelRule = {
  id: 'level',
  priority: 85,
  matches(text) {
    const t = String(text || '').trim().toLowerCase();
    if (/^level:\s*(high|medium|low)/i.test(t)) return true;
    const map = parseKeyValueSegments(text);
    return Boolean(map?.level && !map?.metric && !map?.symbol);
  },
  humanize(text) {
    const map = parseKeyValueSegments(text);
    const level = map?.level || text.replace(/^level:\s*/i, '').trim();
    if (!level) return null;
    const he = translateLevelWord(level);
    if (/^(high|medium|low)$/i.test(level)) {
      return `רמת חשיבות: ${he}.`;
    }
    return `רמה: ${formatDisplayNumber(level)}.`;
  },
};

/** @type {HumanizationRule} */
export const symbolRule = {
  id: 'symbol',
  priority: 80,
  matches(text) {
    const map = parseKeyValueSegments(text);
    return Boolean(map?.symbol && (map?.strategy || map?.reason || map?.note || Object.keys(map).length <= 3));
  },
  humanize(text) {
    const map = parseKeyValueSegments(text);
    if (!map?.symbol) return null;
    const sym = map.symbol;
    const ctx = map.strategy || map.reason || map.note || map.type;
    if (ctx) return `מעקב על ${sym} — ${ctx}.`;
    return `מעקב על ${sym}.`;
  },
};

/**
 * Phase P1 placeholder — watchlist rows (symbol + level + note).
 * @type {HumanizationRule}
 */
export const watchlistRule = {
  id: 'watchlist',
  priority: 75,
  matches(text) {
    const map = parseKeyValueSegments(text);
    return Boolean(
      map?.symbol && (map?.level || map?.price || map?.target) && !map?.metric && !map?.trigger,
    );
  },
  humanize(text) {
    const map = parseKeyValueSegments(text);
    if (!map?.symbol) return null;
    const level = map.level || map.price || map.target;
    const note = map.note || map.reason || map.catalyst;
    const parts = [`מעקב על ${map.symbol}`];
    if (level) parts.push(`ברמה ${formatDisplayNumber(level)}`);
    if (note) parts.push(`— ${note}`);
    return `${parts.join(' ')}.`;
  },
};

/**
 * Phase P1 placeholder — generic pipe key:value fallback for known technical keys.
 * @type {HumanizationRule}
 */
export const genericKeyValueRule = {
  id: 'generic-kv',
  priority: 10,
  matches(text) {
    const map = parseKeyValueSegments(text);
    if (!map || Object.keys(map).length < 2) return false;
    return Object.keys(map).every((k) => /^[a-z_]+$/i.test(k));
  },
  humanize(text) {
    const map = parseKeyValueSegments(text);
    if (!map) return null;
    const parts = Object.entries(map).map(([k, v]) => {
      const label = {
        event: 'אירוע',
        impact: 'השפעה',
        sector: 'סקטור',
        opportunity: 'הזדמנות',
        earnings: 'דוחות',
        note: 'הערה',
      }[k.toLowerCase()] || k;
      return `${label}: ${v}`;
    });
    return parts.join(' · ');
  },
};

/** Ordered rule registry — add new rules here for Phase P1+. */
export const HUMANIZATION_RULES = [
  metricRule,
  triggerRule,
  riskRule,
  levelRule,
  symbolRule,
  watchlistRule,
  genericKeyValueRule,
].sort((a, b) => b.priority - a.priority);
