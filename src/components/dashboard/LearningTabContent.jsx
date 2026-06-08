import { Copy } from "lucide-react";
import { toast } from "sonner";

function formatItem(item) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return String(item ?? '').trim();
  const text = (
    item.text || item.title || item.content || item.summary || item.point ||
    item.name || item.rule || item.description || item.insight || item.fact ||
    item.definition || item.setup || item.pattern || ''
  ).trim();
  if (text) return text;
  // fallback: first non-empty string value in object
  const val = Object.values(item).find(v => typeof v === 'string' && v.trim());
  return val ? val.trim() : '';
}

function copyText(text) {
  navigator.clipboard.writeText(text)
    .then(() => toast.success('הועתק ✓'))
    .catch(() => toast.error('שגיאה בהעתקה'));
}

function ItemRow({ text, onBrain }) {
  return (
    <div className="group flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-white/80 dark:hover:bg-zinc-800/60 transition-colors">
      <span className="flex-1 text-sm text-slate-700 dark:text-zinc-300 leading-relaxed text-right whitespace-pre-line">
        {text}
      </span>
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onBrain && (
          <button
            type="button"
            onClick={onBrain}
            title="שמור למוח"
            className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm leading-none transition-colors"
          >
            🧠
          </button>
        )}
        <button
          type="button"
          onClick={() => copyText(text)}
          title="העתק"
          className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * Generic tab content renderer for learning-specific tabs.
 *
 * Props:
 *   items        — raw array from extractVideoTabItems (strings or objects)
 *   emptyLabel   — string shown when items is empty
 *   onSaveToBrain(text) — callback for saving an item to the brain
 */
export function LearningTabContent({ items = [], emptyLabel = 'אין עדיין נתונים בסעיף הזה', onSaveToBrain }) {
  const formatted = items.map(formatItem).filter(Boolean);

  if (formatted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500" dir="rtl">
        <span className="text-3xl mb-2 opacity-30">📭</span>
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5" dir="rtl">
      {formatted.map((text, i) => (
        <ItemRow
          key={i}
          text={text}
          onBrain={onSaveToBrain ? () => onSaveToBrain(text) : null}
        />
      ))}
    </div>
  );
}
