import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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

const SOURCE_TYPE_LABELS = {
  youtube: "YouTube",
  rss: "RSS Feed",
  site: "אתר",
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

  const detectedSourceType = form.sourceUrl ? detectSourceType(form.sourceUrl) : null;

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear error on change
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "שם המנטור הוא שדה חובה";
    if (!form.category) errs.category = "קטגוריה היא שדה חובה";
    if (!form.sourceUrl.trim()) {
      errs.sourceUrl = "קישור למקור הוא שדה חובה";
    } else if (!isValidUrl(form.sourceUrl.trim())) {
      errs.sourceUrl = "הקישור אינו תקין — יש להזין URL מלא (https://...)";
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
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הוספת מנטור חדש</DialogTitle>
          <DialogDescription>
            מלא את פרטי המנטור — ייצור רשומת מנטור ומקור יחד
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Name */}
          <Field label="שם המנטור" required error={errors.name}>
            <Input
              placeholder="לדוגמה: Andrej Karpathy"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={errors.name ? "border-red-300 focus-visible:ring-red-200" : ""}
            />
          </Field>

          {/* Category */}
          <Field label="קטגוריה ראשית" required error={errors.category}>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger className={errors.category ? "border-red-300" : ""}>
                <SelectValue placeholder="בחר קטגוריה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AI">🤖 AI</SelectItem>
                <SelectItem value="Food">🍳 אוכל</SelectItem>
                <SelectItem value="Markets">📈 שוק ההון</SelectItem>
                <SelectItem value="Other">📌 אחר</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {/* Topic */}
          <Field label="נושא / תחום" hint="אופציונלי — לדוגמה: Deep Learning, השקעות ערך, תזונה">
            <Input
              placeholder="לדוגמה: Prompt Engineering"
              value={form.topic}
              onChange={(e) => set("topic", e.target.value)}
            />
          </Field>

          {/* Source URL */}
          <Field label="קישור למקור" required error={errors.sourceUrl}>
            <div className="space-y-1.5">
              <Input
                placeholder="https://www.youtube.com/@karpathy"
                value={form.sourceUrl}
                onChange={(e) => set("sourceUrl", e.target.value)}
                className={errors.sourceUrl ? "border-red-300 focus-visible:ring-red-200" : ""}
                dir="ltr"
              />
              {detectedSourceType && !errors.sourceUrl && (
                <p className="text-xs text-indigo-600">
                  זוהה כ-{SOURCE_TYPE_LABELS[detectedSourceType]}
                </p>
              )}
            </div>
          </Field>

          {/* Description */}
          <Field label="תיאור קצר / הערות" hint="אופציונלי">
            <textarea
              placeholder="תיאור קצר של תחום המנטור..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </Field>

          {/* Avatar URL */}
          <Field label="קישור לתמונה (avatar)" hint="אופציונלי">
            <Input
              placeholder="https://..."
              value={form.avatarUrl}
              onChange={(e) => set("avatarUrl", e.target.value)}
              dir="ltr"
            />
          </Field>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-200"
            />
            <span className="text-sm text-gray-700">מנטור פעיל</span>
          </label>
        </div>

        <DialogFooter>
          <button
            onClick={handleSubmit}
            disabled={addMentor.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {addMentor.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {addMentor.isPending ? "שומר..." : "שמור מנטור"}
          </button>
          <button
            onClick={handleClose}
            disabled={addMentor.isPending}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            ביטול
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Field wrapper — label + hint + error
function Field({ label, required, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 mr-0.5"> *</span>}
        {hint && <span className="text-xs text-gray-400 font-normal mr-1">— {hint}</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
