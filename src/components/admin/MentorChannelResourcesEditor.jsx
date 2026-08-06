import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, Youtube } from 'lucide-react';
import { getMentorChannelResources, MENTOR_CHANNEL_RESOURCE_TYPES } from '@/lib/mentorChannelResources';

const TYPE_LABELS = {
  home: 'דף הבית', videos: 'סרטונים', live: 'שידורים חיים', courses: 'קורסים', playlists: 'פלייליסטים',
  posts: 'פוסטים', shorts: 'Shorts', playlist: 'פלייליסט נושאי', course: 'קורס נושאי', 'topic-playlist': 'פלייליסט נושאי', 'topic-course': 'קורס נושאי', topic: 'נושא', custom: 'מותאם אישית',
};
const STANDARD_PATHS = { home: 'featured', videos: 'videos', live: 'streams', courses: 'courses', playlists: 'playlists', posts: 'posts', shorts: 'shorts' };

function createId() {
  return globalThis.crypto?.randomUUID?.() || `resource_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function editableResources(mentor) {
  const source = Array.isArray(mentor.channelResources) ? mentor.channelResources : getMentorChannelResources(mentor);
  return source.map((resource, index) => ({ ...resource, id: resource.id || resource.key || createId(), enabled: resource.enabled !== false, order: resource.order ?? index }));
}

export default function MentorChannelResourcesEditor({ mentor, value, onChange }) {
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantSelection, setAssistantSelection] = useState([]);
  const handle = String(mentor.handle || mentor.channelHandle || '').trim().replace(/^@/, '');
  const assistantRows = useMemo(() => Object.entries(STANDARD_PATHS).map(([type, path]) => ({
    id: createId(), type, labelHe: TYPE_LABELS[type], descriptionHe: `גישה ישירה אל ${TYPE_LABELS[type]} בערוץ`,
    url: `https://www.youtube.com/@${handle}/${path}`, icon: '🔗', enabled: true, verified: false, source: 'derived',
  })).filter((row) => !value.some((current) => current.type === row.type)), [handle, value]);

  const update = (id, field, nextValue) => onChange(value.map((row) => row.id === id ? { ...row, [field]: nextValue } : row));
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((row, order) => ({ ...row, order })));
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3" aria-labelledby="mentor-resources-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h4 id="mentor-resources-title" className="text-sm font-semibold text-slate-900">קישורי הערוץ ותתי־נושאים</h4><p className="text-xs text-slate-500">הקישורים מופיעים במרכז הערוץ בדשבורד ובפרטי הסרטון.</p></div>
        <div className="flex gap-1.5">
          {handle ? <button type="button" onClick={() => { setShowAssistant((open) => !open); setAssistantSelection([]); }} className="rounded-lg border bg-white px-2 py-1 text-xs"><Youtube className="inline h-3.5 w-3.5" /> הוסף קישורי YouTube רגילים</button> : null}
          <button type="button" onClick={() => onChange([...value, { id: createId(), type: 'custom', labelHe: '', descriptionHe: '', url: '', icon: '🔗', enabled: true, verified: false, source: 'manual', order: value.length }])} className="rounded-lg border bg-white px-2 py-1 text-xs"><Plus className="inline h-3.5 w-3.5" /> הוסף קישור</button>
        </div>
      </div>
      {showAssistant ? <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs"><p className="mb-2">תצוגה מקדימה עבור <b>@{handle}</b>. בחר קישורים ואשר.</p><div className="mb-2 grid gap-1">{assistantRows.map((row) => <label key={row.type} className="flex items-center gap-2"><input type="checkbox" checked={assistantSelection.includes(row.type)} onChange={(event) => setAssistantSelection((current) => event.target.checked ? [...current, row.type] : current.filter((type) => type !== row.type))} /><span>{row.labelHe}</span><code dir="ltr" className="truncate text-[10px] text-slate-500">{row.url}</code></label>)}</div><button type="button" disabled={!assistantSelection.length} onClick={() => { const selected = assistantRows.filter((row) => assistantSelection.includes(row.type)); onChange([...value, ...selected].map((row, order) => ({ ...row, order }))); setShowAssistant(false); setAssistantSelection([]); }} className="rounded-md bg-blue-600 px-2 py-1 text-white disabled:opacity-50">אשר והוסף {assistantSelection.length} קישורים</button></div> : null}
      <div className="space-y-2">
        {value.map((row, index) => <div key={row.id} className="grid grid-cols-1 gap-2 rounded-lg border bg-white p-2 sm:grid-cols-[auto_9rem_1fr_auto]">
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={row.enabled !== false} onChange={(event) => update(row.id, 'enabled', event.target.checked)} /> פעיל</label>
          <select value={row.type} onChange={(event) => update(row.id, 'type', event.target.value)} className="rounded-md border px-2 py-1 text-xs">{MENTOR_CHANNEL_RESOURCE_TYPES.map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}</select>
          <div className="grid gap-1"><input aria-label="שם הקישור" value={row.labelHe} onChange={(event) => update(row.id, 'labelHe', event.target.value)} placeholder="שם בעברית" className="rounded-md border px-2 py-1 text-xs" /><input aria-label="תיאור הקישור" value={row.descriptionHe || ''} onChange={(event) => update(row.id, 'descriptionHe', event.target.value)} placeholder="תיאור קצר" className="rounded-md border px-2 py-1 text-xs" /><input dir="ltr" aria-label="כתובת הקישור" value={row.url} onChange={(event) => update(row.id, 'url', event.target.value)} placeholder="https://..." className="rounded-md border px-2 py-1 text-xs" /></div>
          <div className="flex items-start gap-1"><input aria-label="סדר תצוגה" type="number" value={row.order ?? index} onChange={(event) => update(row.id, 'order', Number(event.target.value))} className="w-12 rounded border px-1 text-xs" /><button type="button" aria-label="העבר למעלה" onClick={() => move(index, -1)} disabled={!index}><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label="העבר למטה" onClick={() => move(index, 1)} disabled={index === value.length - 1}><ArrowDown className="h-4 w-4" /></button><button type="button" aria-label="הסר קישור" onClick={() => { if (window.confirm('האם להסיר את הקישור ממרכז הערוץ?')) onChange(value.filter((item) => item.id !== row.id).map((item, order) => ({ ...item, order }))); }}><Trash2 className="h-4 w-4 text-red-500" /></button></div>
        </div>)}
        {!value.length ? <p className="rounded-lg border border-dashed p-3 text-center text-xs text-slate-500">לא הוגדרו קישורים. תפריט מרכז הערוץ יישאר מוסתר.</p> : null}
      </div>
    </section>
  );
}

export { editableResources };
