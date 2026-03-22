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
import { useCreateCategory } from "@/hooks/useCategories";

const ICON_OPTIONS = [
  { value: "Bot",             label: "🤖 AI / בינה מלאכותית" },
  { value: "UtensilsCrossed", label: "🍴 אוכל / בישול" },
  { value: "TrendingUp",      label: "📈 שוק ההון" },
  { value: "BookOpen",        label: "📖 לימוד" },
  { value: "Code",            label: "💻 תכנות" },
  { value: "Music",           label: "🎵 מוזיקה" },
  { value: "Dumbbell",        label: "💪 כושר" },
  { value: "Globe",           label: "🌍 עולם" },
  { value: "Lightbulb",       label: "💡 רעיונות" },
  { value: "Layers",          label: "🗂 כללי" },
];

const COLOR_OPTIONS = [
  { value: "violet", label: "סגול",  dot: "bg-violet-400" },
  { value: "cyan",   label: "ים",    dot: "bg-cyan-400"   },
  { value: "orange", label: "כתום",  dot: "bg-orange-400" },
  { value: "emerald",label: "ירוק",  dot: "bg-emerald-400"},
  { value: "rose",   label: "ורוד",  dot: "bg-rose-400"   },
  { value: "amber",  label: "צהוב",  dot: "bg-amber-400"  },
];

const EMPTY_FORM = {
  name: "",
  description: "",
  icon: "Layers",
  color: "violet",
  active: true,
};

export function AddCategoryDialog({ open, onOpenChange }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const createCategory = useCreateCategory();

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "שם הקטגוריה הוא שדה חובה";
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    try {
      await createCategory.mutateAsync({
        id: form.name.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        icon: form.icon,
        color: form.color,
        active: form.active,
      });
      toast.success(`הקטגוריה "${form.name.trim()}" נוספה בהצלחה`);
      setForm(EMPTY_FORM);
      setErrors({});
      onOpenChange(false);
    } catch (err) {
      toast.error("שגיאה בשמירת הקטגוריה — נסה שוב");
      console.error("[AddCategoryDialog]", err);
    }
  };

  const handleClose = () => {
    if (createCategory.isPending) return;
    setForm(EMPTY_FORM);
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הוספת קטגוריה חדשה</DialogTitle>
          <DialogDescription>צור קטגוריה לארגון סרטונים ומנטורים</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Name */}
          <Field label="שם הקטגוריה" required error={errors.name}>
            <Input
              placeholder="לדוגמה: מדע, ספורט, טכנולוגיה"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={errors.name ? "border-red-300 focus-visible:ring-red-200" : ""}
            />
          </Field>

          {/* Icon */}
          <Field label="אייקון">
            <Select value={form.icon} onValueChange={(v) => set("icon", v)}>
              <SelectTrigger>
                <SelectValue placeholder="בחר אייקון" />
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Color */}
          <Field label="צבע">
            <div className="flex gap-2.5 flex-wrap">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("color", opt.value)}
                  title={opt.label}
                  className={`w-7 h-7 rounded-full ${opt.dot} transition-all ${
                    form.color === opt.value
                      ? "ring-2 ring-offset-2 ring-gray-500 scale-110"
                      : "opacity-50 hover:opacity-80"
                  }`}
                />
              ))}
            </div>
          </Field>

          {/* Description */}
          <Field label="תיאור קצר" hint="אופציונלי">
            <textarea
              placeholder="תיאור קצר של הקטגוריה..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </Field>

          {/* Active */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-200"
            />
            <span className="text-sm text-gray-700">קטגוריה פעילה</span>
          </label>
        </div>

        <DialogFooter>
          <button
            onClick={handleSubmit}
            disabled={createCategory.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createCategory.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {createCategory.isPending ? "שומר..." : "שמור קטגוריה"}
          </button>
          <button
            onClick={handleClose}
            disabled={createCategory.isPending}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            ביטול
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
