import { useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { ExternalLink, Sparkles, Eye, X, Clock, StickyNote } from "lucide-react";
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

  // הערות מה-entity הנפרד — הקוורי כבר קיים ב-NoteEditor, אז זה cached
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
        code === "QUOTA_ZERO"              ? "ה-API Key אין לו quota פעיל. ניתן להפעיל GEMINI_MOCK=true לבדיקה." :
        code === "GEMINI_API_KEY_MISSING"  ? "מפתח ה-API חסר — הוסף GEMINI_API_KEY ב-Base44 → Environment Variables" :
        code === "RATE_LIMIT"             ? "הגעת למגבלת הבקשות — נסה שוב בעוד כמה שניות" :
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
    if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K צפיות`;
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
          className="absolute top-3 left-3 z-50 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>

        {/* Note indicator — מופיע בצד שמאל רק אם קיימת הערה */}
        {hasNote && (
          <button
            onClick={() => setActiveTab("notes")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-1.5 py-3 rounded-r-xl shadow-md transition-all duration-200 animate-in fade-in slide-in-from-left-2"
            title="יש הערה — לחץ לצפייה"
          >
            <StickyNote className="h-4 w-4" />
            <span className="text-[10px] font-semibold leading-tight [writing-mode:vertical-rl] rotate-180">
              יש הערה
            </span>
          </button>
        )}

        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto p-5 space-y-3">

            {/* תמונה — קטנה, ממורכזת */}
            <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 max-w-[300px] mx-auto">
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
                <div className="bg-white/90 rounded-full p-3">
                  <ExternalLink className="h-5 w-5 text-gray-800" />
                </div>
              </a>
            </div>

            {/* כותרת + שמירה */}
            <div className="flex items-start gap-2 flex-row-reverse">
              <h2 className="flex-1 text-right text-xl font-bold leading-snug text-gray-900">
                {video.title}
              </h2>
              <SaveButton isSaved={video.isSaved} onClick={() => onSaveToggle?.(video)} size="md" />
            </div>

            {/* preview הערה — שורת טקסט אדומה מתחת לכותרת */}
            {notePreview && (
              <button
                onClick={() => setActiveTab("notes")}
                className="flex items-start gap-1.5 flex-row-reverse text-right hover:opacity-70 transition-opacity"
              >
                <StickyNote className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-500 line-clamp-2 leading-relaxed">
                  {notePreview}
                </p>
              </button>
            )}

            {/* שורת מטא — מנטור · תאריך · צפיות · אורך · תגיות */}
            <div className="flex items-center gap-x-3 gap-y-1.5 flex-row-reverse flex-wrap">
              {mentorName && (
                <div className="flex items-center gap-1.5 flex-row-reverse">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {mentorName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{mentorName}</span>
                </div>
              )}
              {publishDate && <span className="text-xs text-gray-500">{publishDate}</span>}
              {viewCountFormatted && (
                <span className="text-xs text-gray-500 flex items-center gap-1 flex-row-reverse">
                  <Eye className="h-3 w-3" />{viewCountFormatted}
                </span>
              )}
              {video.duration && (
                <span className="text-xs text-gray-500 flex items-center gap-1 flex-row-reverse">
                  <Clock className="h-3 w-3" />{video.duration}
                </span>
              )}
              <CategoryBadge category={video.category} />
              <StatusBadge status={video.status} />
            </div>

            {/* תקציר החלטה — shortSummary קצר, placeholder אם אין */}
            <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 text-right">
              {video.shortSummary ? (
                <>
                  <p className="text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">מה תלמד כאן</p>
                  <p className="text-sm text-gray-800 leading-6 line-clamp-3">{video.shortSummary}</p>
                </>
              ) : (
                <p className="text-xs text-gray-400 text-center py-0.5">הסרטון טרם נותח — פתח את טאב הסיכום כדי לנתח עם AI</p>
              )}
            </div>

            {/* סטטוס למידה + badge — שורה קומפקטית */}
            <div className="flex items-center gap-3 flex-row-reverse">
              <span className="text-xs font-medium text-gray-500 shrink-0">סטטוס למידה:</span>
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
              <LearningStatusBadge status={video.learningStatus} />
            </div>

            {/* נושאים */}
            {videoTopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 flex-row-reverse">
                {videoTopics.map((topic) => (
                  <span key={topic.id} className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">
                    #{topic.name}
                    {onRemoveTopic && (
                      <button onClick={() => onRemoveTopic(video, topic.id)} className="hover:text-gray-600 leading-none">×</button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* שגיאה */}
            {video.status === "error" && video.errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-right">
                <p className="text-sm text-red-700">{video.errorMessage}</p>
              </div>
            )}

            {/* טאבים — משניים, מתחת לאזור ההחלטה */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir="rtl">
              <TabsList className="h-8 flex w-fit mx-auto">
                <TabsTrigger value="summary" className="text-xs px-3">סיכום</TabsTrigger>
                <TabsTrigger value="keypoints" className="text-xs px-3">נקודות מפתח</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs px-3">הערות</TabsTrigger>
                <TabsTrigger value="chapters" className="text-xs px-3">פרקי הסרטון</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4 space-y-5 min-h-[220px]">
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
                            <h4 className="text-sm font-semibold text-gray-800 mb-2">נקודות מפתח</h4>
                            <ul className="space-y-2">
                              {video.keyPoints.map((point, i) => (
                                <li key={i} className="flex items-start gap-2.5 flex-row-reverse text-sm text-gray-700">
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                  <span className="leading-relaxed">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all">
                          {isAnalyzing ? <div className="h-3.5 w-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          {isAnalyzing ? "מנתח..." : "נתח מחדש עם AI"}
                        </button>
                        {analyzeError && (
                          <div className="w-full rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 text-right leading-relaxed">{analyzeError}</div>
                        )}
                      </>
                    );
                  }
                  return (
                    <div className="flex flex-col items-center gap-4 py-10 text-center">
                      <div className="p-3 bg-indigo-50 rounded-xl"><Sparkles className="h-6 w-6 text-indigo-500" /></div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">הסרטון טרם נותח</p>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">ניתוח AI יפיק סיכום, נקודות מפתח ותגיות</p>
                      </div>
                      <button onClick={handleAnalyze} disabled={isAnalyzing} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all shadow-sm">
                        {isAnalyzing ? <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isAnalyzing ? "מנתח..." : "נתח עם AI"}
                      </button>
                      {analyzeError && (
                        <div className="w-full rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 text-right leading-relaxed">{analyzeError}</div>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="keypoints" className="mt-4 space-y-4 min-h-[220px]" dir="rtl">
                {video.keyPoints && video.keyPoints.length > 0 ? (
                  <ul className="space-y-3 text-right">
                    {video.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-3 flex-row-reverse text-sm text-gray-800">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                        <span className="leading-7">{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 text-right py-6">אין נקודות מפתח זמינות</p>
                )}
                {video.tags && video.tags.length > 0 && (
                  <div className="text-right">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">תגיות</h4>
                    <div className="flex flex-wrap gap-2 flex-row-reverse">
                      {video.tags.map((tag, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4 min-h-[220px]">
                <NoteEditor videoId={video.id} />
              </TabsContent>

              <TabsContent value="chapters" className="mt-4 min-h-[220px]" dir="rtl">
                {video.videoTopics?.length > 0 ? (
                  <ul className="space-y-1">
                    {video.videoTopics.map((chapter, i) => {
                      const url = video.url
                        ? `${video.url}${video.url.includes('?') ? '&' : '?'}t=${chapter.timestampSeconds}s`
                        : null;
                      return (
                        <li key={i}>
                          <a
                            href={url || '#'}
                            target={url ? '_blank' : undefined}
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 flex-row-reverse px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                          >
                            <span className="text-xs font-mono text-indigo-500 shrink-0 group-hover:text-indigo-700">
                              {chapter.timestampLabel || `${Math.floor(chapter.timestampSeconds / 60)}:${String(chapter.timestampSeconds % 60).padStart(2, '0')}`}
                            </span>
                            <span className="flex-1 text-sm text-gray-700 text-right leading-snug">{chapter.title}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-sm text-gray-400">עדיין לא נוצרה חלוקה לפי נושאים</p>
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
