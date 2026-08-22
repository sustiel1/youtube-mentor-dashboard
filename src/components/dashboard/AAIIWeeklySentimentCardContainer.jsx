import { useCallback, useEffect, useState } from 'react';
import { AAIIWeeklySentimentCard } from './AAIIWeeklySentimentCard';
import { AAIIWeeklySentimentEditor } from './AAIIWeeklySentimentEditor';
import {
  buildAaiiWeeklyRecord,
  getLatestApplicableAaiiWeeklyRecord,
  listAaiiWeeklyRecordsDescending,
} from '@/lib/aaiiWeeklySentiment';
import {
  readAaiiWeeklySentimentStore,
  saveAaiiWeeklySentimentRecord,
} from '@/lib/persistence/aaiiWeeklySentimentStore';

export function AAIIWeeklySentimentCardContainer() {
  const [store, setStore] = useState(null);
  const [status, setStatus] = useState('loading');
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const nextStore = await readAaiiWeeklySentimentStore();
        if (!alive) return;
        setStore(nextStore);
        const latest = getLatestApplicableAaiiWeeklyRecord(nextStore);
        setStatus(latest ? 'ready' : 'idle');
      } catch {
        if (alive) setStatus('unavailable');
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleSave = useCallback(async (draft) => {
    const built = buildAaiiWeeklyRecord(
      draft,
      draft.publicationDate,
    );
    if (!built.valid) return; // editor already blocked save on invalid input
    const nextStore = await saveAaiiWeeklySentimentRecord(built.record);
    setStore(nextStore);
    setStatus('ready');
  }, []);

  const latest = store ? getLatestApplicableAaiiWeeklyRecord(store) : null;
  const history = store
    ? listAaiiWeeklyRecordsDescending(store).filter((r) => r.weekStart !== latest?.weekStart)
    : [];

  return (
    <>
      <AAIIWeeklySentimentCard
        bullish={latest?.bullish ?? null}
        neutral={latest?.neutral ?? null}
        bearish={latest?.bearish ?? null}
        bullishAverage={latest?.bullishAverage ?? null}
        neutralAverage={latest?.neutralAverage ?? null}
        bearishAverage={latest?.bearishAverage ?? null}
        bullBearSpread={latest?.bullBearSpread ?? null}
        weekStart={latest?.weekStart ?? null}
        weekEnd={latest?.weekEnd ?? null}
        updatedAt={latest?.updatedAt ?? null}
        status={status}
        onEdit={() => setEditorOpen(true)}
      />
      <AAIIWeeklySentimentEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        currentRecord={latest}
        history={history}
        onSave={handleSave}
      />
    </>
  );
}
