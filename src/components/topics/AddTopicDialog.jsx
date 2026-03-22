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
import { useCreateTopic } from "@/hooks/useTopics";

const COLOR_OPTIONS = [
  { value: "violet", label: "סגול",   dot: "bg-violet-400" },
  { value: "cyan",   label: "ים",     dot: "bg-cyan-400"   },
  { value: "orange", label: "כתום",   dot: "bg-orange-400" },
  { value: "emerald",label: "ירוק",   dot: "bg-emerald-400"},
  { value: "rose",   label: "ורוד",   dot: "bg-rose-400"   },
  { value: "amber",  label: "צהוב",   dot: "bg-amber-400"  },
];

const EMPTY_FORM = {
  name: "",
  description: "",
  color: "violet",
  category: "",
  active: true,
};

export function AddTopicDialog({ open, onOpenChange }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const createTopic = useCreateTopic();

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "שם הנושא הוא שדה חובה";
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    try {
      await createTopic.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim() || null,
        color: form.color,
        category: form.category || null,
        active: form.active,
        icon: null,
        createdAt: new Date().toISOString(),
      });
      toast.success(`הנושא "${form.name.trim()}" נוסף בהצלחה`);
      setForm(EMPTY_FORM);
      setErrors({});
      onOpenChange(false);
    } catch (err) {
      toast.error("שגיאה בשמירת הנושא — נסה שוב");
      console.error("[AddTopicDialog]", err);
    }
  };

  const handleClose = () => {
    if (createTopic.isPending) return;
    setForm(EMPTY_FORM);
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הוספת נושא חדש</DialogTitle>
          <DialogDescription>הגדר נושא ידע חדש לארגון הסרטונים</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Name */}
          <Field label="שם הנושא" required error={errors.name}>
            <Input
              placeholder="לדוגמה: Transformers, בישול יפני"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={errors.name ? "border-red-300 focus-visible:ring-red-200" : ""}
            />
          </Field>

          {/* Category */}
          <Field label="קטגוריה משויכת" hint="אופציונלי">
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger>
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

          {/* Color */}
          <Field label="צבע תגית">
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
              placeholder="תיאור קצר של הנושא..."
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
            <span className="text-sm text-gray-700">נושא פעיל</span>
          </label>
        </div>

        <DialogFooter>
          <button
            onClick={handleSubmit}
            disabled={createTopic.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createTopic.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {createTopic.isPending ? "שומר..." : "שמור נושא"}
          </button>
          <button
            onClick={handleClose}
            disabled={createTopic.isPending}
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
