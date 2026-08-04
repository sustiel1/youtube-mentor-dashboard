import { MENTOR_CHANNEL_DESTINATIONS } from '@/lib/mentorRegistry';

export default function MentorChannelLinksEditor({ value, onChange, error = '' }) {
  const links = value && typeof value === 'object' ? value : {};
  return (
    <section className="space-y-3 rounded-xl bg-slate-50 p-3" aria-labelledby="mentor-channel-links-title">
      <div>
        <h4 id="mentor-channel-links-title" className="text-sm font-semibold text-slate-900">
          מרכז הערוץ
        </h4>
        <p className="text-xs text-slate-500">
          מזינים רק כתובות YouTube מאומתות. שדה ריק נשאר לא זמין ולא נוצר אוטומטית.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MENTOR_CHANNEL_DESTINATIONS.map((destination) => (
          <label key={destination.key} className="min-w-0 space-y-1 text-xs font-medium text-slate-600">
            <span>{destination.icon} {destination.labelHe}</span>
            <input
              type="url"
              dir="ltr"
              value={links[destination.key] ?? ''}
              onChange={(event) => onChange({ ...links, [destination.key]: event.target.value })}
              placeholder="https://www.youtube.com/..."
              className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              data-mentor-channel-link-input={destination.key}
            />
          </label>
        ))}
      </div>
      {error ? <p className="text-xs font-medium text-red-600" role="alert">{error}</p> : null}
    </section>
  );
}
