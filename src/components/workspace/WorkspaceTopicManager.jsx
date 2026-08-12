import { useMemo, useState } from 'react';
import { Edit2, Plus, Settings, Trash2, X } from 'lucide-react';
import {
  WORKSPACE_TOPIC_TYPES,
  buildWorkspaceTaxonomyRepairBackup,
  buildWorkspaceTopicChangePreview,
  getWorkspaceMainTopics,
  getWorkspaceSubtopics,
  getWorkspaceTopicType,
  sortWorkspaceTopics,
  validateWorkspaceTopicDraft,
} from '@/utils/workspaceTopicHierarchy';

const TOPIC_INPUT_CLASS = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

function topicDraft(topic = null) {
  return {
    name: topic?.name || '',
    emoji: topic?.emoji || '',
    type: topic ? getWorkspaceTopicType(topic) : WORKSPACE_TOPIC_TYPES.MAIN,
    parentId: topic?.parentId || '',
    displayOrder: Number.isFinite(Number(topic?.displayOrder)) ? Number(topic.displayOrder) : 0,
  };
}

export function WorkspaceTopicManager({ topics, items, addTopic, updateTopic, deleteTopic, onClose }) {
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(() => topicDraft());
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupJson, setBackupJson] = useState('');

  const selectedTopic = topics.find(topic => topic.id === selectedId) || null;
  const mainTopics = useMemo(() => getWorkspaceMainTopics(topics), [topics]);
  const orderedTopics = useMemo(() => sortWorkspaceTopics(topics), [topics]);

  const beginEdit = (topic) => {
    setSelectedId(topic.id);
    setDraft(topicDraft(topic));
    setPreview(null);
    setMessage('');
    setBackupMessage('');
    setBackupJson('');
  };

  const beginCreate = () => {
    setSelectedId(null);
    setDraft(topicDraft());
    setPreview(null);
    setMessage('');
    setBackupMessage('');
    setBackupJson('');
  };

  const updateDraft = (updates) => {
    setDraft(current => ({ ...current, ...updates }));
    setPreview(null);
    setMessage('');
  };

  const preparePreview = () => {
    const validation = validateWorkspaceTopicDraft({
      topicId: selectedTopic?.id || null,
      type: draft.type,
      parentId: draft.parentId,
      topics,
    });
    if (!draft.name.trim()) validation.errors.unshift('שם הנושא הוא שדה חובה.');
    validation.ok = validation.errors.length === 0;

    const nextPreview = selectedTopic
      ? buildWorkspaceTopicChangePreview({ topic: selectedTopic, draft, topics, items })
      : {
          topicId: 'ייווצר בעת השמירה',
          existingParentId: null,
          proposedParentId: validation.parentId,
          attachedItemCount: 0,
          affectedItemIds: [],
          canPreserveTopicId: true,
          itemIdsRemainUnchanged: true,
          validation,
          changesHierarchy: Boolean(validation.parentId),
        };
    nextPreview.validation = validation;
    setPreview(nextPreview);
  };

  const downloadTaxonomyBackup = () => {
    if (!selectedTopic) return;
    try {
      const backup = buildWorkspaceTaxonomyRepairBackup({ topics, items, topicId: selectedTopic.id });
      const url = URL.createObjectURL(new Blob([backup.serialized], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setBackupJson(backup.serialized);
      setBackupMessage(`הגיבוי אומת והורד: ${backup.filename}`);
    } catch (error) {
      setBackupMessage(error?.message || 'יצירת הגיבוי נכשלה.');
    }
  };

  const applyPreviewedChange = () => {
    if (!preview?.validation?.ok) return;
    const payload = {
      name: draft.name.trim(),
      emoji: draft.emoji.trim() || null,
      type: draft.type,
      parentId: draft.type === WORKSPACE_TOPIC_TYPES.SUBTOPIC ? draft.parentId : null,
      displayOrder: Number(draft.displayOrder) || 0,
    };
    const result = selectedTopic ? updateTopic(selectedTopic.id, payload) : addTopic(payload);
    if (!result?.ok) {
      setMessage((result?.errors || ['השינוי לא נשמר.']).join(' '));
      return;
    }
    setMessage('השינוי נשמר ללא שינוי במזהי הפריטים המשויכים.');
    setSelectedId(result.topic?.id || selectedTopic?.id || null);
    setPreview(null);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900" dir="rtl" aria-labelledby="workspace-topic-manager-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="workspace-topic-manager-title" className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-zinc-200">
          <Settings className="h-4 w-4 text-indigo-500" />
          ניהול נושאים
        </h2>
        <button type="button" onClick={onClose} aria-label="סגור ניהול נושאים" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="max-h-[32rem] space-y-2 overflow-y-auto pl-1">
          {mainTopics.map(mainTopic => (
            <div key={mainTopic.id} className="rounded-xl border border-slate-100 p-2 dark:border-zinc-800">
              <TopicRow topic={mainTopic} onEdit={beginEdit} onDelete={deleteTopic} />
              <div className="mr-5 mt-1 space-y-1 border-r border-slate-100 pr-3 dark:border-zinc-800">
                {getWorkspaceSubtopics(topics, mainTopic.id).map(subtopic => (
                  <TopicRow key={subtopic.id} topic={subtopic} onEdit={beginEdit} onDelete={deleteTopic} compact />
                ))}
              </div>
            </div>
          ))}
          {orderedTopics.length === 0 && <p className="text-sm text-slate-500">אין נושאים.</p>}
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-zinc-100">{selectedTopic ? `עריכת ${selectedTopic.name}` : 'נושא חדש'}</h3>
            <button type="button" onClick={beginCreate} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
              <Plus className="h-3.5 w-3.5" /> נושא חדש
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="שם">
              <input value={draft.name} onChange={event => updateDraft({ name: event.target.value })} className={TOPIC_INPUT_CLASS} aria-label="שם הנושא" />
            </Field>
            <Field label="אייקון">
              <input value={draft.emoji} onChange={event => updateDraft({ emoji: event.target.value })} className={TOPIC_INPUT_CLASS} aria-label="אייקון הנושא" placeholder="לדוגמה 📈" />
            </Field>
            <Field label="סוג">
              <select value={draft.type} onChange={event => updateDraft({ type: event.target.value, parentId: event.target.value === WORKSPACE_TOPIC_TYPES.MAIN ? '' : draft.parentId })} className={TOPIC_INPUT_CLASS} aria-label="סוג הנושא">
                <option value={WORKSPACE_TOPIC_TYPES.MAIN}>נושא ראשי</option>
                <option value={WORKSPACE_TOPIC_TYPES.SUBTOPIC}>תת־נושא</option>
              </select>
            </Field>
            <Field label="נושא אב">
              <select value={draft.parentId} onChange={event => updateDraft({ parentId: event.target.value })} disabled={draft.type !== WORKSPACE_TOPIC_TYPES.SUBTOPIC} className={`${TOPIC_INPUT_CLASS} disabled:opacity-50`} aria-label="נושא אב">
                <option value="">בחר נושא ראשי</option>
                {mainTopics.filter(topic => topic.id !== selectedTopic?.id).map(topic => (
                  <option key={topic.id} value={topic.id}>{topic.name}</option>
                ))}
              </select>
            </Field>
            <Field label="סדר תצוגה">
              <input type="number" value={draft.displayOrder} onChange={event => updateDraft({ displayOrder: event.target.value })} className={TOPIC_INPUT_CLASS} aria-label="סדר תצוגה" />
            </Field>
          </div>

          <button type="button" onClick={preparePreview} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
            הצג תצוגה מקדימה
          </button>

          {selectedTopic && (
            <button type="button" onClick={downloadTaxonomyBackup} className="mr-2 mt-4 rounded-lg border border-indigo-300 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/30">
              הורד גיבוי JSON לפני שינוי
            </button>
          )}

          {preview && <TopicChangePreview preview={preview} onApply={applyPreviewedChange} />}
          {backupJson && <textarea data-testid="workspace-taxonomy-backup-json" aria-label="גיבוי JSON מאומת" className="sr-only" value={backupJson} readOnly />}
          {backupMessage && <p role="status" className="mt-3 text-xs font-semibold text-slate-600 dark:text-zinc-400">{backupMessage}</p>}
          {message && <p role="status" className="mt-3 text-sm font-semibold text-slate-700 dark:text-zinc-300">{message}</p>}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return <label className="grid gap-1 text-xs font-semibold text-slate-600 dark:text-zinc-400"><span>{label}</span>{children}</label>;
}

function TopicRow({ topic, onEdit, onDelete, compact = false }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60">
      <span className={`flex-1 text-right ${compact ? 'text-xs text-slate-600 dark:text-zinc-400' : 'text-sm font-semibold text-slate-800 dark:text-zinc-200'}`}>
        {topic.emoji ? `${topic.emoji} ` : ''}{topic.name}
      </span>
      <button type="button" onClick={() => onEdit(topic)} aria-label={`ערוך את ${topic.name}`} className="rounded p-1 text-slate-400 hover:text-indigo-600"><Edit2 className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => onDelete(topic.id)} aria-label={`מחק את ${topic.name}`} className="rounded p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function TopicChangePreview({ preview, onApply }) {
  return (
    <div data-testid="workspace-topic-change-preview" className="mt-4 rounded-xl border border-amber-200 bg-white p-3 text-xs text-slate-700 dark:border-amber-800 dark:bg-zinc-900 dark:text-zinc-300">
      <h4 className="font-bold text-amber-800 dark:text-amber-300">תצוגה מקדימה בלבד — עדיין לא נשמר שינוי</h4>
      <dl className="mt-2 grid gap-1 font-mono" dir="ltr">
        <div>existingTopicId: {preview.topicId}</div>
        <div>proposedParentId: {preview.proposedParentId || 'null'}</div>
        <div>attachedItemCount: {preview.attachedItemCount}</div>
        <div>topicIdPreserved: {preview.canPreserveTopicId ? 'yes' : 'no'}</div>
      </dl>
      <div className="mt-2">
        <strong>רשומות שיושפעו:</strong>{' '}
        {preview.affectedItemIds.length ? preview.affectedItemIds.join(', ') : 'אין רשומות משויכות'}
      </div>
      {!preview.validation.ok && (
        <ul className="mt-2 list-disc pr-5 text-red-600 dark:text-red-400">
          {preview.validation.errors.map(error => <li key={error}>{error}</li>)}
        </ul>
      )}
      <button type="button" onClick={onApply} disabled={!preview.validation.ok} className="mt-3 rounded-lg border border-amber-400 px-3 py-1.5 font-bold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-300">
        אשר והחל את השינוי המוצג
      </button>
    </div>
  );
}
