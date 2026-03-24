import { useState } from "react";
import { Loader2, UserRound, Youtube, Rss, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddMentorWithSource } from "@/hooks/useMentors";

// Detect source type from URL
function detectSourceType(url) {
  try {
    const lower = url.toLowerCase();
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
    if (lower.includes("rss") || lower.includes("feed") || lower.endsWith(".xml")) return "rss";
    return "site";
  } catch {
    return "site";
  }
}

// Minimal URL validation
function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const SOURCE_TYPE_CONFIG = {
  youtube: { label: "YouTube", icon: Youtube, color: "text-red-500 bg-red-50" },
  rss:     { label: "RSS Feed", icon: Rss,     color: "text-orange-500 bg-orange-50" },
  site:    { label: "אתר",      icon: Globe,   color: "text-blue-500 bg-blue-50" },
};

const EMPTY_FORM = {
  name: "",
  category: "",
  topic: "",
  sourceUrl: "",
  description: "",
  avatarUrl: "",
  active: true,
};

export function AddMentorDialog({ open, onOpenChange }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const addMentor = useAddMentorWithSource();

  const detectedType = form.sourceUrl ? detectSourceType(form.sourceUrl) : null;
  const sourceConfig = detectedType ? SOURCE_TYPE_CONFIG[detectedType] : null;

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "שדה חובה";
    if (!form.category) errs.category = "שדה חובה";
    if (!form.sourceUrl.trim()) {
      errs.sourceUrl = "שדה חובה";
    } else if (!isValidUrl(form.sourceUrl.trim())) {
      errs.sourceUrl = "URL לא תקין — יש להזין כתובת מלאה (https://...)";
    }
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    try {
      await addMentor.mutateAsync({
        mentorData: {
          name: form.name.trim(),
          category: form.category,
          topic: form.topic.trim() || null,
          avatarUrl: form.avatarUrl.trim() || null,
          active: form.active,
          description: form.description.trim() || null,
        },
        sourceUrl: form.sourceUrl.trim(),
        sourceType: detectSourceType(form.sourceUrl.trim()),
      });
      toast.success(`המנטור "${form.name.trim()}" נוסף בהצלחה`);
      setForm(EMPTY_FORM);
      setErrors({});
      onOpenChange(false);
    } catch (err) {
      toast.error("שגיאה בשמירת המנטור — נסה שוב");
      console.error("[AddMentorDialog]", err);
    }
  };

  const handleClose = () => {
    if (addMentor.isPending) return;
    setForm(EMPTY_FORM);
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="p-0 max-w-md overflow-hidden">

        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <UserRound className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-gray-900">
                הוספת מנטור חדש
              </DialogTitle>
              <p className="text-xs text-gray-400 mt-0.5">
                מלא את הפרטים הבסיסיים — ייצור מנטור ומקור יחד
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Form body ── */}
        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">

          {/* שם המנטור */}
          <Field label="שם המנטור" required error={errors.name}>
            <input
              type="text"
              placeholder="לדוגמה: Andrej Karpathy"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={fieldCls(errors.name)}
            />
          </Field>

          {/* קטגוריה */}
          <Field label="קטגוריה" required error={errors.category}>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger className={errors.category ? "border-red-300 focus:ring-red-200" : "border-gray-200 text-sm"}>
                <SelectValue placeholder="בחר קטגוריה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AI">🤖 AI ובינה מלאכותית</SelectItem>
                <SelectItem value="Markets">📈 שוק ההון</SelectItem>
                <SelectItem value="Food">🍳 אוכל ובישול</SelectItem>
                <SelectItem value="Health">🏥 בריאות</SelectItem>
                <SelectItem value="Music">🎶 מוזיקה</SelectItem>
                <SelectItem value="Politics">🏛️ פוליטיקה ותוכן</SelectItem>
                <SelectItem value="Other">📌 אחר</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {/* קישור למקור */}
          <Field label="קישור למקור" required error={errors.sourceUrl}>
            <div className="space-y-1.5">
              <input
                type="url"
                placeholder="https://www.youtube.com/@username"
                value={form.sourceUrl}
                onChange={(e) => set("sourceUrl", e.target.value)}
                className={fieldCls(errors.sourceUrl) + " text-left"}
                dir="ltr"
              />
              {sourceConfig && !errors.sourceUrl && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sourceConfig.color}`}>
                  <sourceConfig.icon className="h-3 w-3" />
                  {sourceConfig.label}
                </span>
              )}
            </div>
          </Field>

          <hr className="border-gray-100" />

          {/* נושא / תחום */}
          <Field label="נושא / תחום" hint="אופציונלי">
            <input
              type="text"
              placeholder="לדוגמה: Prompt Engineering, ניתוח טכני"
              value={form.topic}
              onChange={(e) => set("topic", e.target.value)}
              className={fieldCls()}
            />
          </Field>

          {/* תיאור */}
          <Field label="תיאור קצר" hint="אופציונלי">
            <textarea
              placeholder="כמה מילים על המנטור ותחום ההתמחות שלו..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
            />
          </Field>

          {/* Avatar */}
          <Field label="תמונה (avatar)" hint="אופציונלי">
            <div className="flex items-center gap-3">
              {form.avatarUrl ? (
                <img
                  src={form.avatarUrl}
                  alt="preview"
                  className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <UserRound className="h-4 w-4 text-gray-400" />
                </div>
              )}
              <input
                type="url"
                placeholder="https://..."
                value={form.avatarUrl}
                onChange={(e) => set("avatarUrl", e.target.value)}
                className={fieldCls() + " text-left flex-1"}
                dir="ltr"
              />
            </div>
          </Field>

          {/* Active */}
          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-200"
            />
            <span className="text-sm text-gray-700">מנטור פעיל</span>
          </label>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
          <button
            onClick={handleClose}
            disabled={addMentor.isPending}
            className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            onClick={handleSubmit}
            disabled={addMentor.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {addMentor.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {addMentor.isPending ? "שומר..." : "שמור מנטור"}
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

// Base input classes
function fieldCls(error) {
  return [
    "w-full rounded-lg border px-3 py-2 text-sm text-gray-800 bg-white",
    "placeholder:text-gray-400 transition",
    "focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300",
    error ? "border-red-300 focus:ring-red-200" : "border-gray-200",
  ].join(" ");
}

// Field wrapper
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
