import { BookOpen, ExternalLink, PlaySquare, Search, Youtube } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resolveMentorContentHub } from "@/lib/mentorContentHub";

const TAB_ICONS = { videos: PlaySquare, playlists: BookOpen, search: Search };

function ExternalAction({ href, children, className = "" }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 ${className}`}>
      {children}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

export function MentorContentHubDialog({ mentor, fallback, videos = [], open, onOpenChange }) {
  const hub = resolveMentorContentHub(mentor, { videos, fallback });
  const mentorName = hub.identity?.channelTitle || mentor?.name || fallback?.channelTitle || "המנטור";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[88vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="pr-6 pl-14">
          <DialogTitle>מרכז התוכן של {mentorName}</DialogTitle>
          <DialogDescription>קישורי ערוץ ומשאבי למידה מאומתים או מוגדרים במפורש.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 p-6">
          {!hub.identity ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">נדרש קישור YouTube תקין כדי להפעיל את מרכז התוכן.</p>
          ) : (
            <>
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                <div className="flex min-w-0 items-center gap-3">
                  {hub.identity.thumbnailUrl ? <img src={hub.identity.thumbnailUrl} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><Youtube /></div>}
                  <div className="min-w-0"><p className="truncate font-bold">{mentorName}</p><p className="text-xs text-slate-500">{hub.identity.channelId ? `Channel ID: ${hub.identity.channelId}` : "זהות חלקית — מבוססת קישור מאומת"}</p></div>
                </div>
                <ExternalAction href={hub.identity.canonicalChannelUrl} className="shrink-0 border-red-200 text-red-700"><Youtube className="h-4 w-4" />פתח ערוץ YouTube</ExternalAction>
              </div>

              {hub.tabs.length > 0 && <section><h3 className="mb-2 text-sm font-bold">תוכן בערוץ</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{hub.tabs.map((tab) => { const Icon = TAB_ICONS[tab.key] || Youtube; return <ExternalAction key={tab.key} href={tab.url}><Icon className="h-4 w-4" />{tab.labelHe}</ExternalAction>; })}</div></section>}

              {hub.playlists.length > 0 ? <section><h3 className="mb-2 text-sm font-bold">פלייליסטים ונושאי למידה</h3><div className="grid gap-3 sm:grid-cols-2">{hub.playlists.map((playlist) => <div key={playlist.playlistId} className="rounded-xl border border-slate-200 p-3 dark:border-zinc-800"><p className="font-semibold">{playlist.title || "פלייליסט"}</p>{playlist.description && <p className="mt-1 text-xs text-slate-500">{playlist.description}</p>}<ExternalAction href={playlist.url} className="mt-3">פתח פלייליסט</ExternalAction></div>)}</div></section> : <p className="text-sm text-slate-500">לא נמצאו פלייליסטים ציבוריים שמורים לערוץ זה.</p>}

              {hub.curatedLinks.length > 0 && <section><h3 className="mb-2 text-sm font-bold">משאבי למידה נבחרים</h3><div className="flex flex-wrap gap-2">{hub.curatedLinks.map((link, index) => <ExternalAction key={link.key || `${link.url}-${index}`} href={link.url}>{link.labelHe || "משאב"}</ExternalAction>)}</div></section>}
              {hub.status === "partial" && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">המרכז מחובר חלקית. מוצגים רק יעדים שנגזרו מזהות הערוץ או הוגדרו במפורש.</p>}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
