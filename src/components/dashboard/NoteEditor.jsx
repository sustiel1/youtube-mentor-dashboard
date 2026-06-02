import { useState, useRef } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Trash2, Send, Check, AlertCircle, Clock, X, Image as ImageIcon } from "lucide-react";
import { useNotesByVideo, useCreateNote, useDeleteNote } from "@/hooks/useNotes";

function formatTime(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function resizeImageDataUrl(dataUrl, maxWidth = 800) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = dataUrl;
  });
}

async function fileToResizedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        resolve(await resizeImageDataUrl(e.target.result));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Props:
//   videoId       — required
//   getPlayerTime — optional () => number | null
//   onSeek        — optional (seconds: number) => void
//   hideEmptyState — optional boolean
export function NoteEditor({ videoId, getPlayerTime, onSeek, hideEmptyState = false, maxNotesHeight }) {
  const [newNote, setNewNote] = useState("");
  const [noteTimestamp, setNoteTimestamp] = useState(null);
  const [pendingImages, setPendingImages] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);
  const { data: notes = [], isLoading } = useNotesByVideo(videoId);
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();

  const processImageFiles = async (files) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) return;
    const resized = await Promise.all(imageFiles.map(fileToResizedDataUrl));
    setPendingImages((prev) => [...prev, ...resized]);
  };

  const handlePaste = async (e) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItems = items.filter((item) => item.type.startsWith("image/"));
    if (!imageItems.length) return;
    e.preventDefault();
    const textItem = items.find((item) => item.type === "text/plain");
    if (textItem) {
      textItem.getAsString((text) => {
        if (text) setNewNote((prev) => prev + text);
      });
    }
    const files = imageItems.map((item) => item.getAsFile()).filter(Boolean);
    await processImageFiles(files);
  };

  const handleFileInput = (e) => {
    if (e.target.files?.length) {
      processImageFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleAddTimestamp = () => {
    const seconds = getPlayerTime?.();
    if (seconds == null || isNaN(seconds)) return;
    setNoteTimestamp({ seconds: Math.floor(seconds), label: formatTime(seconds) });
  };

  const handleSubmit = () => {
    const trimmed = newNote.trim();
    if (!trimmed && !pendingImages.length) return;
    createNote.mutate({
      videoId,
      content: trimmed,
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
      ...(noteTimestamp && {
        timestampSeconds: noteTimestamp.seconds,
        timestampLabel: noteTimestamp.label,
      }),
    });
    setNewNote("");
    setNoteTimestamp(null);
    setPendingImages([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[240px] space-y-3 animate-pulse" dir="rtl" aria-busy="true" aria-label="טוען הערות">
        <div className="h-16 rounded-lg bg-gray-100 dark:bg-zinc-800" />
        <div className="h-20 rounded-lg bg-gray-50 dark:bg-zinc-800/60" />
        <div className="h-14 rounded-lg bg-gray-50 dark:bg-zinc-800/40" />
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">

      {/* Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85"
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewImage}
            alt="תמונה מוגדלת"
            className="max-w-[92vw] max-h-[92vh] rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2 flex-row-reverse">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="הוסף הערה..."
          rows={2}
          dir="rtl"
          className="flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 text-right"
        />
        <div className="flex flex-col gap-1.5 self-end">
          <button
            onClick={handleSubmit}
            disabled={(!newNote.trim() && !pendingImages.length) || createNote.isPending}
            title={createNote.isPending ? "שומר..." : "שמור הערה (Enter)"}
            className="p-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {createNote.isPending ? (
              <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
            title="העלה תמונה"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      </div>

      {/* Paste hint */}
      {pendingImages.length === 0 && (
        <p className="text-[10px] text-gray-400 text-right flex items-center justify-end gap-1 flex-row-reverse">
          <ImageIcon className="h-3 w-3 shrink-0" />
          אפשר להדביק צילום מסך עם Ctrl+V
        </p>
      )}

      {/* Pending images preview grid */}
      {pendingImages.length > 0 && (
        <div className="flex flex-wrap gap-2 flex-row-reverse">
          {pendingImages.map((img, i) => (
            <div key={i} className="relative group">
              <img
                src={img}
                alt={`תמונה ${i + 1}`}
                className="h-16 w-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setPreviewImage(img)}
              />
              <button
                type="button"
                onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                title="הסר תמונה"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Timestamp row */}
      <div className="flex items-center gap-2 flex-row-reverse flex-wrap">
        {getPlayerTime && (
          <button
            type="button"
            onClick={handleAddTimestamp}
            className="flex items-center gap-1.5 text-xs font-medium text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Clock className="h-3.5 w-3.5" />
            הוסף זמן נוכחי
          </button>
        )}
        {noteTimestamp && (
          <div className="flex items-center gap-1.5 bg-cyan-50 border border-cyan-200 rounded-lg px-2.5 py-1.5">
            <button
              type="button"
              onClick={() => setNoteTimestamp(null)}
              className="text-cyan-400 hover:text-cyan-600 transition-colors"
              title="הסר זמן"
            >
              <X className="h-3 w-3" />
            </button>
            <span className="text-xs font-mono font-semibold text-cyan-700 tabular-nums">
              {noteTimestamp.label}
            </span>
            <Clock className="h-3 w-3 text-cyan-500" />
          </div>
        )}
      </div>

      {/* Mutation feedback */}
      {createNote.isSuccess && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 flex-row-reverse">
          <Check className="h-3.5 w-3.5" />
          <span>הערה נשמרה</span>
        </div>
      )}
      {createNote.isError && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 flex-row-reverse">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>שמירה נכשלה — נסה שוב</span>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 ? (
        hideEmptyState ? (
          <div className="min-h-[120px] flex items-start justify-end py-2 text-sm text-gray-400 text-right dark:text-zinc-500">
            אין הערות עדיין — הוסף את ההערה הראשונה למטה
          </div>
        ) : (
          <div className="py-8 text-sm text-gray-500 text-right">
            אין הערות עדיין — הוסף את ההערה הראשונה
          </div>
        )
      ) : (
        <div
          className="space-y-3"
          style={maxNotesHeight ? { maxHeight: maxNotesHeight, overflowY: "auto", paddingRight: "2px" } : undefined}
        >
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-gray-50 rounded-lg p-3 border border-gray-100 group"
            >
              {/* Images attached to this note */}
              {Array.isArray(note.images) && note.images.length > 0 && (
                <div className="flex flex-wrap gap-2 flex-row-reverse mb-2">
                  {note.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`תמונה ${i + 1}`}
                      className="h-20 rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity object-cover"
                      style={{ maxWidth: "130px" }}
                      onClick={() => setPreviewImage(img)}
                    />
                  ))}
                </div>
              )}

              {/* Timestamp badge */}
              {note.timestampSeconds != null && (
                <div className="mb-2">
                  {onSeek ? (
                    <button
                      onClick={() => onSeek(note.timestampSeconds)}
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 px-2 py-1 rounded-md transition-colors"
                      title="קפוץ לנקודה זו בסרטון"
                    >
                      <Clock className="h-3 w-3" />
                      {note.timestampLabel || formatTime(note.timestampSeconds)}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-1 rounded-md">
                      <Clock className="h-3 w-3" />
                      {note.timestampLabel || formatTime(note.timestampSeconds)}
                    </span>
                  )}
                </div>
              )}

              {/* Note text */}
              {note.content && (
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed text-right">
                  {note.content}
                </p>
              )}

              <div className="flex items-center justify-between mt-2 flex-row-reverse">
                <span className="text-xs text-gray-500">
                  {format(new Date(note.createdAt), "d MMM yyyy, HH:mm", { locale: he })}
                </span>
                <button
                  onClick={() => deleteNote.mutate({ id: note.id, videoId })}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
