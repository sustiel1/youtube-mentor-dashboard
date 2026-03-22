import { useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Trash2, Send, StickyNote } from "lucide-react";
import { useNotesByTopic, useCreateNote, useDeleteNote } from "@/hooks/useNotes";

export function TopicNoteEditor({ topicId }) {
  const [newNote, setNewNote] = useState("");
  const { data: notes = [], isLoading } = useNotesByTopic(topicId);
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();

  const handleSubmit = () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    createNote.mutate({ topicId, content: trimmed });
    setNewNote("");
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
    <div className="space-y-4">
      {/* Input area */}
      <div className="flex gap-2">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="הוסף הערה לנושא..."
          rows={3}
          className="flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
        />
        <button
          onClick={handleSubmit}
          disabled={!newNote.trim() || createNote.isPending}
          className="self-end p-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="text-center py-12">
          <StickyNote className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">אין הערות לנושא זה</p>
          <p className="text-xs text-gray-400 mt-1">הוסף את ההערה הראשונה</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-gray-50 rounded-lg p-3 border border-gray-100 group"
            >
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {note.content}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {format(new Date(note.createdAt), "d MMM yyyy, HH:mm", { locale: he })}
                </span>
                <button
                  onClick={() => deleteNote.mutate({ id: note.id })}
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
