import { useState, useMemo, useEffect } from "react";
import { Loader2, Layers, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateTopic, useTopics } from "@/hooks/useTopics";
import { getTopicByName, DEFAULT_TOPIC_CONFIG } from "@/config/topicConfig";
import { getOrderedMainTopics } from "@/lib/topicFilters";
import { appendChannelCollection } from "@/lib/localChannelCollectionsStore";

const NEW_TOPIC_SENTINEL = "__new_topic__";
const DEFAULT_SUB_TOPIC_NAME = "כללי";

const EMPTY_FORM = {
  title: "",
  topicId: "",
  subtitle: "",
  description: "",
  tagsText: "",
  channelUrlsText: "",
  newTopicName: "",
  isOpponentView: false,
};

function buildFormState(initialValues = {}) {
  return {
    title: String(initialValues?.title || "").trim(),
    topicId: String(initialValues?.topicId || "").trim(),
    subtitle: String(initialValues?.subtitle || "").trim(),
    description: String(initialValues?.description || "").trim(),
    tagsText: Array.isArray(initialValues?.tags)
      ? initialValues.tags.map((tag) => String(tag || "").trim()).filter(Boolean).join(", ")
      : String(initialValues?.tagsText || "").trim(),
    channelUrlsText: Array.isArray(initialValues?.channelUrls)
      ? initialValues.channelUrls.map((url) => String(url || "").trim()).filter(Boolean).join("\n")
      : String(initialValues?.channelUrlsText || "").trim(),
    newTopicName: "",
    isOpponentView: Boolean(initialValues?.isOpponentView),
  };
}

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function AddChannelCollectionDialog({ open, onOpenChange, initialValues = null, onSaved = null }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const { data: allTopics = [] } = useTopics();
  const createTopic = useCreateTopic();

  const mainTopics = useMemo(() => getOrderedMainTopics(allTopics), [allTopics]);

  const selectedTopic = useMemo(
    () => mainTopics.find((topic) => topic.id === form.topicId) || null,
    [mainTopics, form.topicId]
  );

  const selectedSubTopics = useMemo(
    () => allTopics.filter((topic) => topic.parentId === form.topicId),
    [allTopics, form.topicId]
  );

  useEffect(() => {
    if (!open) return;
    setForm(buildFormState(initialValues));
    setErrors({});
  }, [open, initialValues]);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.title.trim()) nextErrors.title = "שדה חובה";
    if (!form.topicId) nextErrors.topicId = "יש לבחור נושא ראשי";
    if (form.topicId === NEW_TOPIC_SENTINEL && !form.newTopicName.trim()) {
      nextErrors.newTopicName = "יש להקליד נושא חדש";
    }

    const urls = form.channelUrlsText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const badUrl = urls.find((url) => !isValidUrl(url));
    if (badUrl) {
      nextErrors.channelUrlsText = `URL לא תקין: ${badUrl.slice(0, 48)}...`;
    }

    return nextErrors;
  };

  const handleSubmit = async () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      let topicIdToSave = form.topicId;
      let topicNameToSave = selectedTopic?.name || null;
      let subTopicIdToSave = String(initialValues?.subTopicId || "").trim() || null;
      let subTopicNameToSave = String(initialValues?.subTopic || "").trim() || null;

      if (form.topicId === NEW_TOPIC_SENTINEL) {
        const createdTopic = await createTopic.mutateAsync({
          name: form.newTopicName.trim(),
          color: "blue",
        });
        topicIdToSave = String(createdTopic?.id || "").trim();
        topicNameToSave = String(createdTopic?.name || form.newTopicName).trim();
      }

      if (!subTopicNameToSave) {
        const existingDefaultSubTopic = selectedSubTopics.find((topic) => String(topic.name || "").trim() === DEFAULT_SUB_TOPIC_NAME);
        subTopicIdToSave = existingDefaultSubTopic?.id || null;
        subTopicNameToSave = existingDefaultSubTopic?.name || DEFAULT_SUB_TOPIC_NAME;
      }

      const tags = form.tagsText
        .split(/[,]+/)
        .map((item) => item.trim())
        .filter(Boolean);

      const channelUrls = form.channelUrlsText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      const savedCollection = appendChannelCollection({
        title: form.title.trim(),
        topicId: topicIdToSave,
        topic: topicNameToSave,
        subTopicId: subTopicIdToSave,
        subTopic: subTopicNameToSave,
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim() || null,
        tags,
        channelUrls,
        channelId: initialValues?.channelId,
        channelName: initialValues?.channelName,
        channelUrl: initialValues?.channelUrl,
        channelThumbnail: initialValues?.channelThumbnail,
        videoId: initialValues?.videoId,
        videoTitle: initialValues?.videoTitle,
        videoUrl: initialValues?.videoUrl,
        isOpponentView: form.isOpponentView,
      });

      toast.success(`האוסף "${form.title.trim()}" נשמר`);
      onSaved?.(savedCollection);
      setForm(EMPTY_FORM);
      setErrors({});
      onOpenChange(false);
    } catch (err) {
      const message = String(err?.message || "").trim();
      toast.error(message.length > 2 && message.length < 220 ? message : "שגיאה בשמירת האוסף");
      console.error("[AddChannelCollectionDialog]", err);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setForm(EMPTY_FORM);
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="p-0 max-w-md overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-gray-900">
                אוסף ערוצים חדש
              </DialogTitle>
              <DialogDescription className="sr-only">
                יצירת אוסף ערוצים עם נושא, תיאור וקישורי YouTube אופציונליים.
              </DialogDescription>
              <p className="text-xs text-gray-400 mt-0.5">
                פרטי האוסף נשמרים מקומית בדפדפן
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <Field label="שם האוסף" required error={errors.title}>
            <input
              type="text"
              placeholder="לדוגמה: אוסף TV דוקרטי"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={fieldCls(errors.title)}
            />
          </Field>

          <Field label="נושא ראשי" required error={errors.topicId}>
            <div className="grid grid-cols-2 gap-1.5">
              {mainTopics.map((topic) => {
                const cfg = getTopicByName(topic.name) || DEFAULT_TOPIC_CONFIG;
                const Icon = cfg.Icon;
                const selected = form.topicId === topic.id;

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => set("topicId", selected ? "" : topic.id)}
                    className={[
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-right transition-all",
                      selected
                        ? "border-indigo-400 bg-indigo-50 text-indigo-700 font-medium"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.text}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1 truncate">{topic.name}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => set("topicId", form.topicId === NEW_TOPIC_SENTINEL ? "" : NEW_TOPIC_SENTINEL)}
                className={[
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-right transition-all",
                  form.topicId === NEW_TOPIC_SENTINEL
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700 font-medium"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 truncate">+ הוסף נושא חדש</span>
                {form.topicId === NEW_TOPIC_SENTINEL && <Check className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
              </button>
            </div>

            {mainTopics.length === 0 && (
              <p className="text-xs text-gray-400 py-2 text-center">טוען נושאים...</p>
            )}

            {form.topicId === NEW_TOPIC_SENTINEL && (
              <div className="pt-3">
                <input
                  type="text"
                  placeholder="הקלד נושא חדש..."
                  value={form.newTopicName}
                  onChange={(e) => set("newTopicName", e.target.value)}
                  className={fieldCls(errors.newTopicName)}
                />
                {errors.newTopicName && <p className="mt-1 text-xs text-red-500">{errors.newTopicName}</p>}
              </div>
            )}
          </Field>

          <Field label="תת-נושא / כותרת משנה" hint="אופציונלי">
            <input
              type="text"
              placeholder="לדוגמה: Hands-on tutorials"
              value={form.subtitle}
              onChange={(e) => set("subtitle", e.target.value)}
              className={fieldCls()}
            />
          </Field>

          <Field label="תיאור / הערות" hint="אופציונלי">
            <textarea
              placeholder="תיאור קצר של מטרת האוסף..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
            />
          </Field>

          <Field label="תגיות / קטגוריות" hint="מופרדות בפסיקים">
            <input
              type="text"
              placeholder="AI, השקעות, Python"
              value={form.tagsText}
              onChange={(e) => set("tagsText", e.target.value)}
              className={fieldCls()}
            />
          </Field>

          <Field label="קישורי YouTube (אופציונלי)" hint="שורה אחת לכל ערוץ" error={errors.channelUrlsText}>
            <textarea
              placeholder={"https://www.youtube.com/@handle\nhttps://www.youtube.com/channel/UC..."}
              value={form.channelUrlsText}
              onChange={(e) => set("channelUrlsText", e.target.value)}
              rows={3}
              dir="ltr"
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition text-left"
            />
          </Field>

          {/* Opponent View toggle */}
          <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-rose-100 bg-rose-50 px-3 py-2.5 transition hover:bg-rose-100">
            <input
              type="checkbox"
              checked={form.isOpponentView}
              onChange={(e) => set("isOpponentView", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-rose-600"
            />
            <span className="text-sm font-medium text-rose-700">☑ דעת האויב</span>
            <span className="text-xs text-rose-500 mr-auto">תוכן זה מייצג עמדה חיצונית — לא עמדתי האישית</span>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "שומר..." : "שמור אוסף"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fieldCls(error) {
  return [
    "w-full rounded-lg border px-3 py-2 text-sm text-gray-800 bg-white",
    "placeholder:text-gray-400 transition",
    "focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300",
    error ? "border-red-300 focus:ring-red-200" : "border-gray-200",
  ].join(" ");
}

function Field({ label, required, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-1.5">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {required && <span className="text-xs text-red-400">*</span>}
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
