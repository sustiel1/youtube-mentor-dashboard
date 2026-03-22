import { useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Trash2, Send, Check, AlertCircle, Clock, X } from "lucide-react";
import { useNotesByVideo, useCreateNote, useDeleteNote } from "@/hooks/useNotes";

// Format raw seconds → "M:SS" or "H:MM:SS"
function formatTime(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Props:
//   videoId      — required
//   getPlayerTime — optional () => number | null  (from YouTube IFrame API)
//   onSeek        — optional (seconds: number) => void
export function NoteEditor({ videoId, getPlayerTime, onSeek }) {
  const [newNote, setNewNote] = useState("");
  const [noteTimestamp, setNoteTimestamp] = useState(null); // { seconds, label }
  const { data: notes = [], isLoading } = useNotesByVideo(videoId);
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();

  const handleAddTimestamp = () => {
    const seconds = getPlayerTime?.();
    if (seconds == null || isNaN(seconds)) return;
    setNoteTimestamp({ seconds: Math.floor(seconds), label: formatTime(seconds) });
  };

  const handleSubmit = () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    createNote.mutate({
      videoId,
      content: trimmed,
      ...(noteTimestamp && {
        timestampSeconds: noteTimestamp.seconds,
        timestampLabel:   noteTimestamp.label,
      }),
    });
    setNewNote("");
    setNoteTimestamp(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-sm text-gray-400">טוען הערות...</div>;
  }

  return (
    <div className="space-y-3" dir="rtl">

      {/* ── Input area ── */}
      <div className="flex gap-2 flex-row-reverse">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="הוסף הערה..."
          rows={2}
          dir="rtl"
          className="flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 text-right"
        />
        <button
          onClick={handleSubmit}
          disabled={!newNote.trim() || createNote.isPending}
          title={createNote.isPending ? "שומר..." : "שמור הערה (Enter)"}
          className="self-end p-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {createNote.isPending ? (
            <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* ── Timestamp row (shown only if player is available) ── */}
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

      {/* ── Mutation feedback ── */}
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

      {/* ── Notes list ── */}
      {notes.length === 0 ? (
        <div className="py-8 text-sm text-gray-400 text-right">
          אין הערות עדיין — הוסף את ההערה הראשונה
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-gray-50 rounded-lg p-3 border border-gray-100 group"
            >
              {/* Timestamp badge — clickable if onSeek is provided */}
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

              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed text-right">
                {note.content}
              </p>
              <div className="flex items-center justify-between mt-2 flex-row-reverse">
                <span className="text-xs text-gray-400">
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
