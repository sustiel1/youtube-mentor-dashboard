import { useState, useCallback, useMemo, useEffect } from "react";
import { Copy } from "lucide-react";
import { ProductIdeaGrid } from "@/components/dashboard/AppBuilderWorkspaceSections";
import { AppBuilderPromptFallbackDialog } from "@/components/dashboard/AppBuilderPromptFallbackDialog";
import {
  discoverFeaturesFromMacro,
  buildDiscoveryGemBrief,
} from "@/lib/featureDiscovery";
import { toast } from "sonner";

/**
 * APP tab — Product Opportunity Discovery only.
 * No PRD, prompts, or builder sections. User copies selection to App Builder GEM manually.
 */
export function AppBuilderTab({
  video,
  topicName = '',
  marketBriefData = null,
}) {
  const videoId = video?.videoId || video?.id || '';
  const [selectedId, setSelectedId] = useState(null);
  const [promptFallback, setPromptFallback] = useState({ open: false, text: "" });

  useEffect(() => {
    setSelectedId(null);
  }, [videoId]);

  const discoveredIdeas = useMemo(
    () => discoverFeaturesFromMacro(marketBriefData),
    [marketBriefData],
  );

  const selectedIdea = useMemo(
    () => discoveredIdeas.find((idea) => idea.id === selectedId) ?? null,
    [discoveredIdeas, selectedId],
  );

  const handleSelect = useCallback((idea) => {
    setSelectedId((prev) => (prev === idea.id ? null : idea.id));
  }, []);

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
    <div dir="rtl" className="space-y-3 pb-24">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50/80 to-white dark:from-indigo-950/20 dark:to-zinc-900 dark:border-zinc-800 px-4 py-3">
        <div className="flex flex-col text-right gap-0.5">
          <span className="text-base font-bold text-slate-800 dark:text-zinc-100">
            🔍 גילוי הזדמנויות מוצר
          </span>
          <span className="text-sm text-slate-500 dark:text-zinc-400">
            מה שווה לבנות מהסרטון הזה? בחר פיצ׳ר אחד והעתק ל-App Builder GEM.
          </span>
        </div>
      </div>

      <ProductIdeaGrid
        ideas={discoveredIdeas}
        selectedId={selectedId}
        onSelect={handleSelect}
      />

      {selectedIdea && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-indigo-200 bg-white/95 backdrop-blur-sm dark:border-indigo-900/50 dark:bg-zinc-950/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3" dir="rtl">
            <div className="text-right min-w-0">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 block">
                פיצ׳ר נבחר
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate block">
                {selectedIdea.titleHe || selectedIdea.productIdea}
              </span>
              {selectedIdea.titleEn && (
                <span className="text-xs text-slate-400 dark:text-zinc-500 truncate block" dir="ltr">
                  {selectedIdea.titleEn}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleCopyToGem}
              className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 transition-colors shrink-0"
            >
              <Copy className="h-4 w-4" />
              העתק ל-App Builder GEM
            </button>
          </div>
        </div>
      )}

      <AppBuilderPromptFallbackDialog
        open={promptFallback.open}
        onOpenChange={(v) => setPromptFallback((p) => ({ ...p, open: v }))}
        promptText={promptFallback.text}
      />
    </div>
  );
}
