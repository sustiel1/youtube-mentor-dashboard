import { useState, useCallback, useMemo, useEffect } from "react";
import { Copy } from "lucide-react";
import { ProductIdeaGrid } from "@/components/dashboard/AppBuilderWorkspaceSections";
import { AppBuilderPromptFallbackDialog } from "@/components/dashboard/AppBuilderPromptFallbackDialog";
import { TabBulkItemsRegistrar } from "@/components/dashboard/TabBulkItemsRegistrar";
import { useUniversalTabBulk } from "@/context/UniversalTabBulkContext";
import {
  discoverFeaturesFromMacro,
  discoverFeaturesFromAppBuilding,
  buildDiscoveryGemBrief,
} from "@/lib/featureDiscovery";
import { toast } from "sonner";

/**
 * APP tab — Product Opportunity Discovery only.
 * No PRD, prompts, or builder sections. User copies selection to App Builder GEM manually.
 * Ideas come from two independent sources: the fundamental-analysis GEM's own curated
 * video.appBuilding.suggestedFeatures (when present), topped up with macro heuristic
 * ideas derived from marketBriefData.
 */
export function AppBuilderTab({
  video,
  topicName = '',
  marketBriefData = null,
}) {
  const videoId = video?.videoId || video?.id || '';
  const universalBulk = useUniversalTabBulk();
  const bulkSelection = universalBulk?.bulkSelectionShare ?? null;
  const [selectedId, setSelectedId] = useState(null);
  const [promptFallback, setPromptFallback] = useState({ open: false, text: "" });

  useEffect(() => {
    setSelectedId(null);
  }, [videoId]);

  const discoveredIdeas = useMemo(() => {
    // GEM-authored ideas (fundamental-analysis path, video.appBuilding.suggestedFeatures)
    // are already curated — show them first, then fill in with the macro heuristic
    // ideas derived from marketBriefData, skipping any title collision.
    const gemIdeas = discoverFeaturesFromAppBuilding(video?.appBuilding);
    const macroIdeas = discoverFeaturesFromMacro(marketBriefData);
    if (!gemIdeas.length) return macroIdeas;
    const seen = new Set(gemIdeas.map((idea) => idea.titleHe.toLowerCase()));
    return [
      ...gemIdeas,
      ...macroIdeas.filter((idea) => !seen.has(String(idea.titleHe || '').toLowerCase())),
    ];
  }, [marketBriefData, video]);

  const featureBulkItems = useMemo(
    () => discoveredIdeas.map((idea, index) => {
      const ideaKey = String(idea.id ?? index);
      return {
        id: `app-builder:feature:${videoId || 'unknown'}:${ideaKey}`,
        ideaKey,
        text: buildDiscoveryGemBrief(idea, video, topicName),
        sectionLabel: idea.titleHe || idea.productIdea || idea.titleEn || 'פיצ׳ר',
        type: 'app-builder',
        tabScope: 'app-builder',
        rawItem: idea,
      };
    }),
    [discoveredIdeas, topicName, video, videoId],
  );

  const selectedFeatureItems = useMemo(
    () => featureBulkItems.filter((item) => bulkSelection?.multiSelected?.has(item.id)),
    [bulkSelection?.multiSelected, featureBulkItems],
  );

  const selectedFeatureIds = useMemo(
    () => new Set(selectedFeatureItems.map((item) => item.ideaKey)),
    [selectedFeatureItems],
  );

  const selectedIdea = useMemo(
    () => {
      if (!bulkSelection) {
        return discoveredIdeas.find((idea, index) => String(idea.id ?? index) === selectedId) ?? null;
      }
      const preferred = selectedFeatureItems.find((item) => item.ideaKey === selectedId);
      return preferred?.rawItem
        ?? selectedFeatureItems[selectedFeatureItems.length - 1]?.rawItem
        ?? null;
    },
    [bulkSelection, discoveredIdeas, selectedFeatureItems, selectedId],
  );

  const handleSelect = useCallback((idea) => {
    const ideaIndex = discoveredIdeas.indexOf(idea);
    const ideaKey = String(idea.id ?? ideaIndex);
    const entry = featureBulkItems.find((item) => item.ideaKey === ideaKey);

    if (!entry || !bulkSelection?.onToggle) {
      setSelectedId((prev) => (prev === ideaKey ? null : ideaKey));
      return;
    }

    const wasSelected = bulkSelection.multiSelected?.has(entry.id) ?? false;
    bulkSelection.onToggle(entry.id, entry);
    setSelectedId((prev) => {
      if (!wasSelected) return ideaKey;
      if (prev !== ideaKey) return prev;
      return selectedFeatureItems.find((item) => item.id !== entry.id)?.ideaKey ?? null;
    });
  }, [bulkSelection, discoveredIdeas, featureBulkItems, selectedFeatureItems]);

  const handleCopyToGem = useCallback(async () => {
    if (!selectedIdea) return;
    const brief = buildDiscoveryGemBrief(selectedIdea, video, topicName);
    try {
      await navigator.clipboard.writeText(brief);
      toast.success(`הועתק: ${selectedIdea.titleHe || selectedIdea.productIdea}`, {
        description: 'הדבק ב-App Builder GEM להמשך פיתוח',
        duration: 5000,
      });
    } catch {
      setPromptFallback({ open: true, text: brief });
    }
  }, [selectedIdea, video, topicName]);

  return (
    <div dir="rtl" className="space-y-3 pb-4">
      <TabBulkItemsRegistrar tab="app-builder" items={featureBulkItems} />

      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50/80 to-white dark:from-indigo-950/20 dark:to-zinc-900 dark:border-zinc-800 px-4 py-3">
        <div className="flex flex-col text-right gap-0.5">
          <span className="text-base font-bold text-slate-800 dark:text-zinc-100">
            🔍 גילוי הזדמנויות מוצר
          </span>
          <span className="text-sm text-slate-500 dark:text-zinc-400">
            מה שווה לבנות מהסרטון הזה? בחר פיצ׳ר אחד או יותר, והעתק את הפעיל ל-App Builder GEM.
          </span>
        </div>
      </div>

      {selectedIdea && (
        <div
          data-app-builder-gem-action
          className="sticky top-0 z-20 rounded-xl border border-indigo-200 bg-white/95 px-4 py-3 shadow-md backdrop-blur-sm dark:border-indigo-900/50 dark:bg-zinc-950/95"
        >
          <div className="mx-auto flex max-w-3xl flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center" dir="rtl">
            <div className="min-w-0 text-right">
              <span className="block text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                פיצ׳ר פעיל להעתקה
              </span>
              <span className="block truncate text-sm font-bold text-slate-800 dark:text-zinc-100">
                {selectedIdea.titleHe || selectedIdea.productIdea}
              </span>
              {selectedIdea.titleEn && (
                <span className="block truncate text-xs text-slate-400 dark:text-zinc-500" dir="ltr">
                  {selectedIdea.titleEn}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleCopyToGem}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
            >
              <Copy className="h-4 w-4" />
              העתק ל-App Builder GEM
            </button>
          </div>
        </div>
      )}

      <ProductIdeaGrid
        ideas={discoveredIdeas}
        selectedId={bulkSelection ? null : selectedId}
        selectedIds={bulkSelection ? selectedFeatureIds : null}
        onSelect={handleSelect}
      />

      <AppBuilderPromptFallbackDialog
        open={promptFallback.open}
        onOpenChange={(v) => setPromptFallback((p) => ({ ...p, open: v }))}
        promptText={promptFallback.text}
      />
    </div>
  );
}
