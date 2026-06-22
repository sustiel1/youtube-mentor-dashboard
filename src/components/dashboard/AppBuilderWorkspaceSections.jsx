import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  mergeTriggersAndRisks,
  parseAppIdea,
  parseNumberedSteps,
  parseTasks,
  parseScreensList,
  serializeAppIdea,
  serializeNumberedSteps,
  serializeTasks,
  splitTriggersAndRisks,
} from '@/lib/appBuilderDisplay';
import {
  UniversalTabCheckbox,
  UniversalTabSelectRow,
} from '@/components/shared/UniversalTabSelectRow';
import { TAB_SECTION_LABEL_CLS } from '@/lib/summaryCardStyles';

function SectionShell({
  title,
  subtitle,
  children,
  hasContent,
  isSelected,
  onToggleSelect,
  onCopy,
  headerActions = null,
  hero = false,
  className = '',
}) {
  const actions = hasContent ? (headerActions || (onCopy ? (
    <button
      type="button"
      onClick={onCopy}
      title="העתק"
      className="p-1 rounded text-sm leading-none text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
    >
      📋
    </button>
  ) : null)) : null;

  return (
    <section
      className={`rounded-xl border transition-colors ${
        hero
          ? 'border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white dark:from-violet-950/30 dark:to-zinc-900 dark:border-violet-800/50'
          : isSelected
            ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/20'
            : 'border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60'
      } ${className}`}
      dir="rtl"
    >
      <UniversalTabSelectRow
        className="px-3 py-2.5 border-b border-slate-100/80 dark:border-zinc-800/60"
        checkbox={onToggleSelect ? (
          <UniversalTabCheckbox
            checked={!!isSelected}
            disabled={!hasContent}
            onChange={onToggleSelect}
          />
        ) : null}
        actions={actions}
      >
        <h3 className={TAB_SECTION_LABEL_CLS}>{title}</h3>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">{subtitle}</p>
        )}
      </UniversalTabSelectRow>
      <div className="px-3 py-3">{children}</div>
    </section>
  );
}

function FieldLabel({ children }) {
  return (
    <span className="block text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-1">{children}</span>
  );
}

function FieldInput({ value, onChange, placeholder, multiline = false }) {
  const cls =
    'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[15px] font-semibold text-right text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 leading-snug';
  if (multiline) {
    return (
      <textarea
        dir="rtl"
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${cls} resize-y min-h-[2.5rem]`}
      />
    );
  }
  return (
    <input
      dir="rtl"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cls}
    />
  );
}

export function AppIdeaHeroSection({
  summary,
  requirements,
  screens,
  onChangeSummary,
  onChangeRequirements,
  isSelected,
  onToggleSelect,
  onCopy,
  headerActions = null,
}) {
  const idea = useMemo(
    () => parseAppIdea(summary, requirements, screens),
    [summary, requirements, screens],
  );
  const screenList = useMemo(() => parseScreensList(screens), [screens]);
  const hasContent = Boolean(summary?.trim() || requirements?.trim() || screens?.trim());

  const updateField = (key, val) => {
    const next = { ...idea, [key]: val };
    const { summary: s, requirements: r } = serializeAppIdea(next);
    onChangeSummary(s);
    onChangeRequirements(r);
  };

  return (
    <SectionShell
      title="🚀 רעיון לאפליקציה"
      subtitle="שם, מטרה, ערך ומורכבות"
      hero
      hasContent={hasContent}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
      onCopy={onCopy}
      headerActions={headerActions}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <FieldLabel>שם האפליקציה</FieldLabel>
          <FieldInput
            value={idea.appName}
            onChange={(v) => updateField('appName', v)}
            placeholder="Pre-IPO Stock Scanner"
          />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>מטרה</FieldLabel>
          <FieldInput
            value={idea.purpose}
            onChange={(v) => updateField('purpose', v)}
            placeholder="Identify potential breakout stocks before institutional attention."
            multiline
          />
        </div>
        <div>
          <FieldLabel>ערך למשתמש</FieldLabel>
          <FieldInput
            value={idea.value}
            onChange={(v) => updateField('value', v)}
            placeholder="Find opportunities early."
            multiline
          />
        </div>
        <div>
          <FieldLabel>מורכבות</FieldLabel>
          <FieldInput
            value={idea.complexity}
            onChange={(v) => updateField('complexity', v)}
            placeholder="Medium"
          />
        </div>
      </div>
      {screenList.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <FieldLabel>מסכים (מ-GEM)</FieldLabel>
          <ul className="flex flex-wrap gap-1.5 justify-end">
            {screenList.map((s, i) => (
              <li
                key={i}
                className="text-sm font-medium text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-md"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionShell>
  );
}

export function LogicFlowSection({ value, onChange, isSelected, onToggleSelect, onCopy, headerActions = null }) {
  const steps = useMemo(() => parseNumberedSteps(value), [value]);
  const hasContent = steps.length > 0;

  const updateSteps = (next) => onChange(serializeNumberedSteps(next));

  const addStep = () => updateSteps([...steps, { id: steps.length, text: '' }]);
  const removeStep = (idx) => updateSteps(steps.filter((_, i) => i !== idx));
  const editStep = (idx, text) => updateSteps(steps.map((s, i) => (i === idx ? { ...s, text } : s)));

  return (
    <SectionShell
      title="🧠 לוגיקה עסקית"
      subtitle="זרימת לוגיקה ממוספרת"
      hasContent={hasContent}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
      onCopy={onCopy}
      headerActions={headerActions}
    >
      {steps.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-zinc-500 text-center py-2">אין שלבים — הוסף שלב ראשון</p>
      ) : (
        <ol className="space-y-2">
          {steps.map((step, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-sm font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <input
                dir="rtl"
                value={step.text}
                onChange={(e) => editStep(idx, e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[15px] font-semibold text-right dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder={`שלב ${idx + 1}`}
              />
              <button
                type="button"
                onClick={() => removeStep(idx)}
                className="shrink-0 p-1.5 text-slate-400 hover:text-red-500"
                title="הסר"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        onClick={addStep}
        className="mt-2 flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <Plus className="h-4 w-4" />
        הוסף שלב
      </button>
    </SectionShell>
  );
}

export function RisksCardsSection({
  risksText,
  triggersText,
  onChangeRisksBlob,
  isSelected,
  onToggleSelect,
  onCopy,
  headerActions = null,
}) {
  const { risks } = useMemo(() => {
    const split = splitTriggersAndRisks(risksText);
    if (split.triggers.length === 0 && triggersText) {
      return { risks: split.risks };
    }
    return split;
  }, [risksText, triggersText]);

  const hasContent = risks.length > 0;

  const updateRisks = (nextRisks) => {
    const triggers = splitTriggersAndRisks(risksText).triggers;
    onChangeRisksBlob(mergeTriggersAndRisks(triggers, nextRisks));
  };

  const addRisk = () => updateRisks([...risks, '']);
  const editRisk = (idx, text) => updateRisks(risks.map((r, i) => (i === idx ? text : r)));
  const removeRisk = (idx) => updateRisks(risks.filter((_, i) => i !== idx));

  return (
    <SectionShell
      title="⚠️ סיכונים"
      subtitle="סיכונים ואזהרות"
      hasContent={hasContent}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
      onCopy={onCopy}
      headerActions={headerActions}
    >
      {risks.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-zinc-500 text-center py-2">אין סיכונים מוגדרים</p>
      ) : (
        <ul className="space-y-2">
          {risks.map((risk, idx) => (
            <li
              key={idx}
              className="flex items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 px-3 py-2"
            >
              <span className="text-amber-600 dark:text-amber-400 shrink-0" aria-hidden>⚠</span>
              <input
                dir="rtl"
                value={risk}
                onChange={(e) => editRisk(idx, e.target.value)}
                className="flex-1 bg-transparent text-[15px] font-semibold text-amber-900 dark:text-amber-100 text-right focus:outline-none"
                placeholder="False Breakout"
              />
              <button type="button" onClick={() => removeRisk(idx)} className="text-slate-400 hover:text-red-500 shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={addRisk}
        className="mt-2 flex items-center gap-1 text-sm font-semibold text-amber-700 dark:text-amber-400 hover:underline"
      >
        <Plus className="h-4 w-4" />
        הוסף סיכון
      </button>
    </SectionShell>
  );
}

export function TasksChecklistSection({ value, onChange, isSelected, onToggleSelect, onCopy, headerActions = null }) {
  const tasks = useMemo(() => parseTasks(value), [value]);
  const hasContent = tasks.length > 0;

  const updateTasks = (next) => onChange(serializeTasks(next));

  const toggle = (idx) => {
    updateTasks(tasks.map((t, i) => (i === idx ? { ...t, done: !t.done } : t)));
  };
  const edit = (idx, text) => updateTasks(tasks.map((t, i) => (i === idx ? { ...t, text } : t)));
  const add = () => updateTasks([...tasks, { id: tasks.length, text: '', done: false }]);
  const remove = (idx) => updateTasks(tasks.filter((_, i) => i !== idx));

  return (
    <SectionShell
      title="📋 משימות פיתוח"
      subtitle="משימות פיתוח"
      hasContent={hasContent}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
      onCopy={onCopy}
      headerActions={headerActions}
    >
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-zinc-500 text-center py-2">אין משימות</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((task, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggle(idx)}
                className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                  task.done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-300 dark:border-zinc-600 text-transparent'
                }`}
                aria-label={task.done ? 'הושלם' : 'לא הושלם'}
              >
                ✓
              </button>
              <input
                dir="rtl"
                value={task.text}
                onChange={(e) => edit(idx, e.target.value)}
                className={`flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[15px] font-semibold text-right dark:border-zinc-700 dark:bg-zinc-800 ${
                  task.done ? 'line-through text-slate-400 dark:text-zinc-500' : 'text-slate-800 dark:text-zinc-100'
                }`}
              />
              <button type="button" onClick={() => remove(idx)} className="text-slate-400 hover:text-red-500 shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        className="mt-2 flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <Plus className="h-4 w-4" />
        הוסף משימה
      </button>
    </SectionShell>
  );
}

export function TriggersCardsSection({
  risksText,
  onChangeRisksBlob,
  isSelected,
  onToggleSelect,
  onCopy,
  headerActions = null,
}) {
  const { triggers, risks } = useMemo(() => splitTriggersAndRisks(risksText), [risksText]);
  const hasContent = triggers.length > 0;

  const updateTriggers = (nextTriggers) => {
    onChangeRisksBlob(mergeTriggersAndRisks(nextTriggers, risks));
  };

  const add = () => updateTriggers([...triggers, '']);
  const edit = (idx, text) => updateTriggers(triggers.map((t, i) => (i === idx ? text : t)));
  const remove = (idx) => updateTriggers(triggers.filter((_, i) => i !== idx));

  return (
    <SectionShell
      title="🎯 טריגרים והתראות"
      subtitle="טריגרים והתראות"
      hasContent={hasContent}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
      onCopy={onCopy}
      headerActions={headerActions}
    >
      {triggers.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-zinc-500 text-center py-2">אין טריגרים — הוסף טריגר או הדבק מ-GEM</p>
      ) : (
        <ul className="space-y-2">
          {triggers.map((trigger, idx) => {
            const isBearish = /falls?\s+below|מתחת|ירידה/i.test(trigger);
            const icon = isBearish ? '⚠' : '🚀';
            const tone = isBearish
              ? 'border-red-200/80 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20 text-red-800 dark:text-red-200'
              : 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200';
            return (
              <li key={idx} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${tone}`}>
                <span className="shrink-0" aria-hidden>{icon}</span>
                <input
                  dir="rtl"
                  value={trigger}
                  onChange={(e) => edit(idx, e.target.value)}
                  className="flex-1 bg-transparent text-[15px] font-semibold text-right focus:outline-none"
                  placeholder="NBIS crosses 2.33"
                />
                <button type="button" onClick={() => remove(idx)} className="text-slate-400 hover:text-red-500 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        className="mt-2 flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <Plus className="h-4 w-4" />
        הוסף טריגר
      </button>
    </SectionShell>
  );
}

// ── Feature Discovery Cards ──────────────────────────────────────────────────

const WORTH_BUILDING_HE = { Yes: 'כן', Maybe: 'אולי', No: 'לא' };

const WORTH_STYLES = {
  Yes: 'bg-emerald-50/90 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800/60',
  Maybe: 'bg-amber-50/90 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800/60',
  No: 'bg-slate-50/90 text-slate-700 border-slate-300 dark:bg-zinc-800/80 dark:text-zinc-300 dark:border-zinc-600',
};

const CATEGORY_STYLES = {
  Scanner: 'bg-violet-50/90 text-violet-800 border-violet-300 dark:bg-violet-950/50 dark:text-violet-200 dark:border-violet-800/60',
  Dashboard: 'bg-sky-50/90 text-sky-800 border-sky-300 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800/60',
  Tracker: 'bg-indigo-50/90 text-indigo-800 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800/60',
  Analytics: 'bg-fuchsia-50/90 text-fuchsia-800 border-fuchsia-300 dark:bg-fuchsia-950/50 dark:text-fuchsia-200 dark:border-fuchsia-800/60',
  'Alert System': 'bg-red-50/90 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800/60',
  Watchlist: 'bg-teal-50/90 text-teal-800 border-teal-300 dark:bg-teal-950/50 dark:text-teal-200 dark:border-teal-800/60',
  Index: 'bg-orange-50/90 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-200 dark:border-orange-800/60',
  Matrix: 'bg-purple-50/90 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800/60',
};

/** Shared pill styling for APP Discovery category + worth-building badges only */
const DISCOVERY_BADGE_BASE =
  'inline-flex items-center justify-center gap-1 rounded-full border px-3 py-1 min-h-[28px] text-[13px] leading-tight tracking-tight';

function ScorePill({ icon, label, value }) {
  const score = Number(value) || 0;
  if (!score) return null;
  const tone = score >= 8
    ? 'text-emerald-700 dark:text-emerald-400'
    : score >= 6
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-slate-500 dark:text-zinc-400';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${tone}`}>
      <span aria-hidden>{icon}</span>
      <span className="text-slate-400 dark:text-zinc-500 font-normal">{label}</span>
      {score}/10
    </span>
  );
}

function DiscoveryOpportunityCard({ idea, rank, isSelected, onSelect }) {
  const components = (idea.components || []).slice(0, 4);
  const categoryStyle = CATEGORY_STYLES[idea.category] || CATEGORY_STYLES.Dashboard;
  const worthStyle = WORTH_STYLES[idea.worthBuilding] || WORTH_STYLES.Maybe;

  return (
    <button
      type="button"
      onClick={() => onSelect(idea)}
      className={`w-full text-right rounded-xl border p-3.5 transition-all ${
        isSelected
          ? 'border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-300/60 dark:border-indigo-500 dark:bg-indigo-950/30 dark:ring-indigo-700/50'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
      }`}
      dir="rtl"
    >
      {/* Row 1: rank + name + category */}
      <div className="flex items-start gap-2 mb-2">
        <span
          className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            isSelected
              ? 'border-indigo-500 bg-indigo-500'
              : 'border-slate-300 dark:border-zinc-600'
          }`}
          aria-hidden
        >
          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0 text-right">
              <span className="text-[11px] font-semibold text-slate-300 dark:text-zinc-600 block mb-0.5">
                #{rank}
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50 leading-snug">
                {idea.titleHe || idea.productIdea}
              </h3>
              {(idea.titleEn || idea.productIdea) && (
                <p className="text-xs font-medium text-slate-400 dark:text-zinc-500 mt-0.5 leading-snug" dir="ltr">
                  {idea.titleEn || idea.productIdea}
                </p>
              )}
            </div>
            {idea.category && (
              <span className={`${DISCOVERY_BADGE_BASE} shrink-0 font-semibold ${categoryStyle}`}>
                <span aria-hidden>🔍</span>
                {idea.category}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Source insight */}
      {idea.sourceInsight && (
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-1.5 pr-6 leading-snug">
          📌 {idea.sourceInsight}
        </p>
      )}

      {/* Why it matters — one line */}
      {idea.whyItMatters && (
        <p className="text-sm text-slate-700 dark:text-zinc-200 mb-2 pr-6 leading-snug">
          🎯 {idea.whyItMatters}
        </p>
      )}

      {/* Components — compact inline */}
      {components.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2 pr-6 leading-relaxed">
          <span className="font-semibold text-slate-400 dark:text-zinc-500">🧩 </span>
          {components.join(' · ')}
        </p>
      )}

      {/* Scores row */}
      <div className="flex items-center gap-2.5 flex-wrap pt-2.5 border-t border-slate-100 dark:border-zinc-800 pr-6">
        <ScorePill icon="♻️" label="שימוש חוזר" value={idea.reusabilityScore} />
        <ScorePill icon="⭐" label="התאמה" value={idea.appFitScore} />
        {idea.worthBuilding && (
          <span className={`${DISCOVERY_BADGE_BASE} font-bold mr-auto ${worthStyle}`}>
            <span aria-hidden>🔥</span>
            שווה בנייה: {WORTH_BUILDING_HE[idea.worthBuilding] || idea.worthBuilding}
          </span>
        )}
      </div>
    </button>
  );
}

export function ProductIdeaGrid({ ideas = [], selectedId, onSelect }) {
  const list = Array.isArray(ideas) ? ideas : [];

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-bold text-slate-700 dark:text-zinc-200">
          {list.length > 0
            ? `${list.length} הזדמנויות מזוהו מהניתוח`
            : 'אין הזדמנויות מזוהות'}
        </span>
        {list.length > 0 && (
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            ממוין לפי ערך · לחץ לבחירה
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-700 py-10 text-center px-4">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            אין הזדמנויות עם ביטחון מספיק מהניתוח
          </p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5">
            הפעל ניתוח מאקרו / תוכן ייעודי — רק רעיונות מבוססי תובנות יוצגו כאן
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {list.map((idea, i) => (
            <DiscoveryOpportunityCard
              key={idea.id || i}
              idea={idea}
              rank={i + 1}
              isSelected={selectedId === idea.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DevelopmentPromptSection({
  value,
  onChange,
  isSelected,
  onToggleSelect,
  onCopy,
  onInsertTemplate,
  headerActions = null,
}) {
  const hasContent = Boolean(value?.trim());

  return (
    <SectionShell
      title="💬 פרומפט פיתוח"
      subtitle="העתק ל-Claude / Cursor / Codex"
      hasContent={hasContent}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
      onCopy={onCopy}
      headerActions={headerActions}
    >
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <span className="text-sm text-slate-500 dark:text-zinc-400 shrink-0">תבנית מהירה:</span>
        {[
          { id: 'claude', label: '⚡ Claude Code' },
          { id: 'codex', label: '🔵 Codex' },
          { id: 'base44', label: '🟣 Base44' },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onInsertTemplate(id)}
            className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-indigo-950/30 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        dir="rtl"
        rows={12}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="פרומפט מוכן ל-Claude Code, Codex, או Base44..."
        className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-right text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 font-mono leading-relaxed min-h-[200px]"
      />
    </SectionShell>
  );
}
