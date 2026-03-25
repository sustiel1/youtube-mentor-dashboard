import { useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { ExternalLink, Sparkles, Eye, X, Clock, StickyNote, Calendar, PlayCircle } from "lucide-react";
import { analyzeVideoWithAI } from "@/api/functions";
import { useUpdateSummary } from "@/hooks/useVideos";
import { useNotesByVideo } from "@/hooks/useNotes";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";
import { LearningStatusBadge, LEARNING_STATUSES } from "./LearningStatusBadge";
import { SaveButton } from "./SaveButton";
import { NoteEditor } from "./NoteEditor";

export function VideoDetailPanel({
  video,
  mentorName,
  open,
  onOpenChange,
  topics = [],
  onSaveToggle,
  onLearningStatusChange,
  onRemoveTopic,
  onAnalyzeDone,
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const updateSummary = useUpdateSummary();

  const { data: videoNotes = [] } = useNotesByVideo(video?.id);
  const hasNote = videoNotes.length > 0;
  const notePreview = hasNote ? videoNotes[0].content : null;

  if (!video) return null;

  const handleAnalyze = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzeVideoWithAI({
        videoId:     video.id,
        title:       video.title,
        description: video.fullSummary || video.shortSummary || "",
        keyPoints:   video.keyPoints || [],
      });
      updateSummary.mutate({ id: video.id, ...result });
      onAnalyzeDone?.({ ...result, status: "done" });
    } catch (err) {
      const code = err?.code;
      setAnalyzeError(
        code === "QUOTA_ZERO"             ? "ה-API Key אין לו quota פעיל. ניתן להפעיל GEMINI_MOCK=true לבדיקה." :
        code === "GEMINI_API_KEY_MISSING" ? "מפתח ה-API חסר — הוסף GEMINI_API_KEY ב-Base44 → Environment Variables" :
        code === "RATE_LIMIT"            ? "הגעת למגבלת הבקשות — נסה שוב בעוד כמה שניות" :
                                           "הניתוח נכשל — נסה שוב"
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const publishDate = video.publishedAt
    ? format(new Date(video.publishedAt), "d MMMM yyyy", { locale: he })
    : "";

  const viewCountFormatted = (() => {
    const n = video.viewCount;
    if (!n) return null;
    if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M צפיות`;
    if (n >= 1_000)     return `${+(n / 1_000).toFixed(1)}K צפיות`;
    return `${n} צפיות`;
  })();

  const videoTopics = (video.topicIds || [])
    .map((id) => topics.find((t) => t.id === id))
    .filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-[96vw] w-[96vw] h-[94vh] p-0 overflow-hidden flex flex-col gap-0"
      >
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 left-3 z-50 p-1.5 rounded-full bg-white/80 hover:bg-gray-100 shadow-sm transition-colors"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>

        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">

            {/* ── Thumbnail ── */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-gray-100 shadow-md">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover"
              />
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
              >
                <div className="bg-white/90 rounded-full p-3 shadow-lg">
                  <ExternalLink className="h-5 w-5 text-gray-800" />
                </div>
              </a>
            </div>

            {/* ── 3. כותרת — hierarchy חזקה יותר ── */}
            <div className="space-y-3">
              <div className="flex items-start gap-2 flex-row-reverse">
                <h2 className="flex-1 text-right text-2xl font-bold leading-snug text-gray-900 tracking-tight">
                  {video.title}
                </h2>
                <SaveButton isSaved={video.isSaved} onClick={() => onSaveToggle?.(video)} size="md" />
              </div>

              {/* Metadata row — right to left: date | views | duration | mentor | badges */}
              <div className="flex flex-wrap items-center gap-2" dir="rtl">
                {publishDate && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                    <Calendar className="h-3 w-3 text-gray-400" />{publishDate}
                  </span>
                )}
                {publishDate && (viewCountFormatted || video.duration) && (
                  <span className="text-gray-300 text-xs">·</span>
                )}
                {viewCountFormatted && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                    <Eye className="h-3 w-3 text-gray-400" />{viewCountFormatted}
                  </span>
                )}
                {viewCountFormatted && video.duration && (
                  <span className="text-gray-300 text-xs">·</span>
                )}
                {video.duration && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                    <Clock className="h-3 w-3 text-gray-400" />{video.duration}
                  </span>
                )}
                {(publishDate || viewCountFormatted || video.duration) && mentorName && (
                  <span className="text-gray-300 text-xs">·</span>
                )}
                {mentorName && (
                  <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    <span className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                      {mentorName.charAt(0).toUpperCase()}
                    </span>
                    {mentorName}
                  </span>
                )}
                <CategoryBadge category={video.category} />
                <StatusBadge status={video.status} />
              </div>
            </div>

            {/* Note preview */}
            {notePreview && (
              <button
                onClick={() => setActiveTab("notes")}
                className="flex items-start gap-1.5 flex-row-reverse text-right hover:opacity-70 transition-opacity w-full"
              >
                <StickyNote className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-500 line-clamp-2 leading-relaxed">{notePreview}</p>
              </button>
            )}

            {/* ── 4. תקציר — white card with shadow ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-4 text-right">
              {video.shortSummary ? (
                <>
                  <p className="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">מה תלמד כאן</p>
                  <p className="text-sm text-gray-800 leading-7 line-clamp-3">{video.shortSummary}</p>
                </>
              ) : (
                <p className="text-xs text-gray-500 text-center py-1">הסרטון טרם נותח — פתח את טאב הסיכום כדי לנתח עם AI</p>
              )}
            </div>

            {/* ── Progress bar + סטטוס למידה ── */}
            {(() => {
              const pctMap = { not_started: 0, in_progress: 40, learned: 80, completed: 100 };
              const pct    = pctMap[video.learningStatus] ?? 0;
              return (
                <div className="space-y-3">
                  {/* Status row */}
                  <div className="flex items-center justify-between">
                    <Select
                      value={video.learningStatus || "not_started"}
                      onValueChange={(val) => onLearningStatusChange?.(video, val)}
                    >
                      <SelectTrigger className="h-7 text-xs bg-white border-gray-200 w-[145px]" dir="rtl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {LEARNING_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">סטטוס למידה</span>
                      <LearningStatusBadge status={video.learningStatus} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-2.5 bg-gray-200 rounded-full overflow-visible" dir="ltr">
                    {/* Filled track */}
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)",
                      }}
                    />
                    {/* Dot indicator */}
                    {pct > 0 && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-indigo-600 border-[3px] border-white shadow-md transition-all duration-500"
                        style={{ left: `calc(${pct}% - 9px)` }}
                      />
                    )}
                  </div>
                </div>
              );
            })()}

            {/* נושאים */}
            {videoTopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 flex-row-reverse">
                {videoTopics.map((topic) => (
                  <span key={topic.id} className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">
                    #{topic.name}
                    {onRemoveTopic && (
                      <button onClick={() => onRemoveTopic(video, topic.id)} className="hover:text-gray-700 leading-none">×</button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Error */}
            {video.status === "error" && video.errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-right">
                <p className="text-sm text-red-700">{video.errorMessage}</p>
              </div>
            )}

            {/* ── 2. טאבים — segmented control pills ── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir="rtl">
              <TabsList className="w-full bg-gray-100 rounded-2xl p-1 h-auto grid grid-cols-4 gap-0.5">
                <TabsTrigger
                  value="summary"
                  className="text-xs rounded-xl py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-gray-900 text-gray-500 transition-all"
                >
                  סיכום
                </TabsTrigger>
                <TabsTrigger
                  value="keypoints"
                  className="text-xs rounded-xl py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-gray-900 text-gray-500 transition-all"
                >
                  נקודות מפתח
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="text-xs rounded-xl py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-gray-900 text-gray-500 transition-all"
                >
                  הערות
                </TabsTrigger>
                <TabsTrigger
                  value="chapters"
                  className="text-xs rounded-xl py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-gray-900 text-gray-500 transition-all"
                >
                  פרקי הסרטון
                </TabsTrigger>
              </TabsList>

              {/* ── Summary tab ── */}
              <TabsContent value="summary" className="mt-5 space-y-5 min-h-[220px]">
                {(() => {
                  const hasData = video.shortSummary || video.fullSummary || (video.keyPoints && video.keyPoints.length > 0);
                  if (hasData) {
                    return (
                      <>
                        {video.shortSummary && (
                          <div className="text-right">
                            <h4 className="text-sm font-bold text-gray-900 mb-2">סיכום קצר</h4>
                            <p className="text-sm text-gray-800 leading-7">{video.shortSummary}</p>
                          </div>
                        )}
                        {video.fullSummary && (
                          <div className="text-right">
                            <h4 className="text-sm font-bold text-gray-900 mb-2">סיכום מלא</h4>
                            <p className="text-sm text-gray-800 leading-7">{video.fullSummary}</p>
                          </div>
                        )}
                        {!video.shortSummary && !video.fullSummary && video.keyPoints?.length > 0 && (
                          <div className="text-right">
                            <h4 className="text-sm font-semibold text-gray-800 mb-3">נקודות מפתח</h4>
                            <ul className="space-y-2.5">
                              {video.keyPoints.map((point, i) => (
                                <li key={i} className="flex items-start gap-2.5 flex-row-reverse text-sm text-gray-800">
                                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                  <span className="leading-relaxed">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <button
                          onClick={handleAnalyze}
                          disabled={isAnalyzing}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all"
                        >
                          {isAnalyzing ? <div className="h-3.5 w-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          {isAnalyzing ? "מנתח..." : "נתח מחדש עם AI"}
                        </button>
                        {analyzeError && (
                          <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 text-right leading-relaxed">{analyzeError}</div>
                        )}
                      </>
                    );
                  }
                  return (
                    <div className="flex flex-col items-center gap-4 py-10 text-center">
                      <div className="p-3 bg-indigo-50 rounded-2xl">
                        <Sparkles className="h-6 w-6 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">הסרטון טרם נותח</p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">ניתוח AI יפיק סיכום, נקודות מפתח ותגיות</p>
                      </div>
                      <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all shadow-sm"
                      >
                        {isAnalyzing ? <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isAnalyzing ? "מנתח..." : "נתח עם AI"}
                      </button>
                      {analyzeError && (
                        <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 text-right leading-relaxed">{analyzeError}</div>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>

              {/* ── Key Points tab ── */}
              <TabsContent value="keypoints" className="mt-5 space-y-4 min-h-[220px]" dir="rtl">
                {video.keyPoints && video.keyPoints.length > 0 ? (
                  <ul className="space-y-3 text-right">
                    {video.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-3 flex-row-reverse">
                        {/* numbered chip */}
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-800 leading-7">{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 text-right py-6">אין נקודות מפתח זמינות</p>
                )}
                {video.tags && video.tags.length > 0 && (
                  <div className="text-right pt-2">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">תגיות</h4>
                    <div className="flex flex-wrap gap-2 flex-row-reverse">
                      {video.tags.map((tag, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-700">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Notes tab ── */}
              <TabsContent value="notes" className="mt-5 min-h-[220px]">
                <NoteEditor videoId={video.id} />
              </TabsContent>

              {/* ── 1. Chapters tab — cards ── */}
              <TabsContent value="chapters" className="mt-5 min-h-[220px]" dir="rtl">
                {video.videoTopics?.length > 0 ? (
                  <ul className="space-y-2">
                    {video.videoTopics.map((chapter, i) => {
                      const tsLabel = chapter.timestampLabel ||
                        `${Math.floor(chapter.timestampSeconds / 60)}:${String(chapter.timestampSeconds % 60).padStart(2, "0")}`;
                      const url = video.url
                        ? `${video.url}${video.url.includes("?") ? "&" : "?"}t=${chapter.timestampSeconds}s`
                        : null;
                      return (
                        <li key={i}>
                          <a
                            href={url || "#"}
                            target={url ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 flex-row-reverse bg-white border border-gray-100 rounded-2xl px-4 py-3.5 hover:border-indigo-200 hover:shadow-sm transition-all group"
                          >
                            {/* Play icon */}
                            <PlayCircle className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 shrink-0 mt-0.5 transition-colors" />

                            {/* Chapter info */}
                            <div className="flex-1 text-right min-w-0">
                              <p className="text-sm font-medium text-gray-800 leading-snug group-hover:text-indigo-700 transition-colors">
                                {chapter.title}
                              </p>
                              {chapter.description && (
                                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{chapter.description}</p>
                              )}
                            </div>

                            {/* Timestamp chip */}
                            <span className="inline-flex items-center bg-indigo-50 text-indigo-600 text-xs font-mono font-medium px-2 py-0.5 rounded-full shrink-0 group-hover:bg-indigo-100 transition-colors">
                              {tsLabel}
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-sm text-gray-500">עדיין לא נוצרה חלוקה לפרקים</p>
                    <p className="text-xs text-gray-400 mt-1">ניתן להוסיף פרקים דרך ניתוח AI בעתיד</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
