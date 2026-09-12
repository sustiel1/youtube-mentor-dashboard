import React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  Gauge,
  Info,
  LockKeyhole,
  ShieldAlert,
  Sparkles,
  Upload,
  WalletCards,
} from "lucide-react";

const blockTitles = [
  "שורת מצב",
  "כלל פסילה יומי ומגבלות סיכון מהמחקר",
  "אירועי המאקרו של היום",
  "מיקוד לפעולה",
  "התוכנית שלי להיום",
  "החלטות שמועד סקירתן הגיע",
];

function Freshness({ children, tone = "default" }) {
  return <span className={`freshness freshness--${tone}`}>{children}</span>;
}

function SectionHeading({ number, icon: Icon, title, aside }) {
  return (
    <div className="section-heading">
      <div className="section-heading__title">
        <span className="section-number">{number}</span>
        <Icon aria-hidden="true" size={19} strokeWidth={1.9} />
        <h2>{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function StatusRow({ items, closureNotice }) {
  const icons = [CalendarDays, Clock3, WalletCards, Gauge];
  return (
    <section className="panel status-panel" aria-labelledby="status-heading">
      <SectionHeading number="01" icon={Gauge} title={blockTitles[0]} />
      {closureNotice && (
        <div className="closure-notice" role="status">
          <CalendarDays aria-hidden="true" size={20} />
          <div><strong>{closureNotice.title}</strong><p>{closureNotice.message}</p></div>
          <Freshness>{closureNotice.freshness}</Freshness>
        </div>
      )}
      <div className="status-grid" id="status-heading">
        {items.map((item, index) => {
          const Icon = icons[index];
          return (
            <article className={`status-card ${item.state ? `status-card--${item.state}` : ""}`} key={item.label}>
              <div className="status-card__label"><Icon aria-hidden="true" size={16} />{item.label}</div>
              <strong className={item.valueTone ? `market-value market-value--${item.valueTone}` : ""}>{item.value}</strong>
              <Freshness>{item.freshness}</Freshness>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RiskPanel({ data }) {
  return (
    <section className="panel" aria-labelledby="risk-heading">
      <SectionHeading number="02" icon={ShieldAlert} title={blockTitles[1]} />
      <div className="risk-layout">
        <div className="invalidation-card">
          <div className="invalidation-card__label"><ShieldAlert aria-hidden="true" size={18} />כלל הפסילה היומי</div>
          <p id="risk-heading">{data.rule}</p>
          <Freshness tone="required">{data.requiredLabel}</Freshness>
        </div>
        <div className="risk-limit-grid">
          {[data.stopWidth, data.positionSize].map((item) => (
            <article className="risk-limit" key={item.label}>
              <span>{item.label}</span><strong dir="ltr">{item.value}</strong><Freshness>{item.freshness}</Freshness>
            </article>
          ))}
        </div>
      </div>
      <div className="boundary-note"><Info aria-hidden="true" size={18} /><span>{data.boundary}</span></div>
    </section>
  );
}

function MacroPanel({ data }) {
  const isEmpty = data.items.length === 0;
  const tone = data.status === "not-checked" ? "unchecked" : "confirmed";
  return (
    <section className="panel" aria-labelledby="macro-heading">
      <SectionHeading
        number="03"
        icon={BellRing}
        title={blockTitles[2]}
        aside={(
          <div className="macro-heading-actions">
            <button className="macro-upload-button" type="button" aria-label="העלאת קובץ CSV לנתוני אירועי מאקרו — הדגמה בלבד">
              <Upload aria-hidden="true" size={16} />
              <span className="macro-upload-copy"><strong>העלאת קובץ CSV</strong><small>נתוני אירועי מאקרו · הדגמה בלבד</small></span>
            </button>
            <Freshness tone={tone}>{data.headingState}</Freshness>
          </div>
        )}
      />
      {isEmpty ? (
        <div className={`macro-empty macro-empty--${tone}`} id="macro-heading">
          {tone === "unchecked" ? <AlertTriangle aria-hidden="true" size={22} /> : <CheckCircle2 aria-hidden="true" size={22} />}
          <div><strong>{data.title}</strong><p>{data.message}</p><Freshness tone={tone}>{data.freshness}</Freshness></div>
        </div>
      ) : (
        <div className="macro-table" id="macro-heading">
          <div className="macro-row macro-row--head" aria-hidden="true">
            <span>שעה בישראל</span><span>אירוע</span><span>השפעה</span><span>קונצנזוס</span><span>מצב המקור</span>
          </div>
          {data.items.map((event) => (
            <article className="macro-row" key={`${event.time}-${event.name}`}>
              <strong className="numeric" dir="ltr">{event.time}</strong><span className="macro-event-name">{event.name}</span><span className="impact-badge">{event.impact}</span>
              <span><b dir="ltr">{event.consensus}</b><small>{event.consensusState}</small></span>
              <Freshness tone={event.freshness.includes("עיכוב") ? "delayed" : "default"}>{event.freshness}</Freshness>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function FocusPanel({ data }) {
  return (
    <section className="panel" aria-labelledby="focus-heading">
      <SectionHeading number="04" icon={Sparkles} title={blockTitles[3]} aside={<span className="count-badge">{data.items.length} נכסים לכל היותר</span>} />
      {data.items.length === 0 ? (
        <div className="focus-empty" id="focus-heading">
          <CircleDot aria-hidden="true" size={26} /><div><strong>{data.empty.title}</strong><p>{data.empty.message}</p><Freshness tone="confirmed">{data.empty.freshness}</Freshness></div>
        </div>
      ) : (
        <div className="focus-list" id="focus-heading">
          {data.items.map((item, index) => (
            <article className="focus-row" key={item.symbol}>
              <div className="asset-identity"><span className="asset-index">0{index + 1}</span><strong dir="ltr">{item.symbol}</strong><small>{item.company}</small></div>
              <div className="focus-cell focus-cell--primary"><span>מבנה מחיר</span><strong>{item.structure}</strong></div>
              <div className="focus-cell"><span>רמה או תנאי</span><p>{item.level}</p></div>
              <div className="focus-cell"><span>מרחק מההפעלה</span><p className={`distance distance--${item.distanceTone}`}>{item.distance}</p></div>
              <div className="focus-cell"><span>הקשר תומך</span><p>{item.context}</p></div>
              <div className="focus-source"><span>מקורות וזמן</span>{item.sources.map((source) => <small key={source}>{source}</small>)}</div>
              <button className="chart-button" type="button" aria-label={`פתח גרף של ${item.symbol} — הדגמה בלבד`}><BarChart3 aria-hidden="true" size={17} />גרף<span>הדגמה</span></button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RatingField({ value, locked }) {
  const options = ["דרוך", "רגוע", "ממוקד"];
  return <div className="rating-group" aria-label="דירוג מצב מנטלי">{options.map((option) => <button className={value === option ? "is-selected" : ""} disabled={locked} key={option} type="button">{option}</button>)}</div>;
}

function PlanField({ field, value, locked }) {
  const id = `plan-${field.key}`;
  if (field.type === "flag") {
    return <div className="plan-field plan-field--flag"><span className="field-label">{field.label}</span><label className="flag-control" htmlFor={id}><input id={id} type="checkbox" disabled={locked} defaultChecked={value === "סומן"} /><span>{value}</span></label></div>;
  }
  if (field.type === "rating") return <div className="plan-field"><span className="field-label">{field.label}</span><RatingField value={value} locked={locked} /></div>;
  if (field.type === "select") return <label className="plan-field" htmlFor={id}><span className="field-label">{field.label}</span><select id={id} defaultValue={value} disabled={locked}>{field.options.map((option) => <option key={option}>{option}</option>)}</select></label>;
  if (field.type === "textarea") return <label className="plan-field plan-field--wide" htmlFor={id}><span className="field-label">{field.label}</span><textarea id={id} defaultValue={value} readOnly={locked} rows="2" /></label>;
  return <label className="plan-field" htmlFor={id}><span className="field-label">{field.label}</span><input id={id} type={field.type} defaultValue={value === "—" ? "" : value} placeholder={value === "—" ? "טרם נקבע" : undefined} readOnly={locked} dir={field.ltr ? "ltr" : "rtl"} />{field.note && <small className="field-note">{field.note}</small>}</label>;
}

function PlanPanel({ data }) {
  return (
    <section className={`panel plan-panel ${data.locked ? "plan-panel--locked" : ""}`} aria-labelledby="plan-heading">
      <SectionHeading number="05" icon={LockKeyhole} title={blockTitles[4]} aside={<span className={`plan-state ${data.locked ? "plan-state--locked" : ""}`}>{data.locked && <LockKeyhole aria-hidden="true" size={14} />}{data.statusText}</span>} />
      <div className="plan-intro" id="plan-heading"><div><strong>{data.title}</strong><p>אפשר להשאיר יום ללא תוכנית. נעילה מתעדת החלטה ואינה מאשרת עסקה.</p></div><button className="no-plan-button" type="button">{data.noPlanOption}</button></div>
      <form className="plan-grid" onSubmit={(event) => event.preventDefault()}>
        {data.fields.map((field) => <PlanField field={field} key={field.key} locked={data.locked} value={data.values[field.key]} />)}
        <div className="plan-actions">
          <span><Info aria-hidden="true" size={16} />כלל הפסילה היומי הוא השדה היחיד שחובה למלא לכל היום.</span>
          <button className="lock-button" type="button" disabled={data.locked}>{data.locked ? <><LockKeyhole aria-hidden="true" size={18} />התוכנית נעולה</> : <><LockKeyhole aria-hidden="true" size={18} />נעילת התוכנית</>}</button>
        </div>
      </form>
    </section>
  );
}

function ReviewPanel({ items }) {
  return (
    <section className="panel" aria-labelledby="review-heading">
      <SectionHeading number="06" icon={Clock3} title={blockTitles[5]} aside={<span className="count-badge">{items.length} ממתינות</span>} />
      <div className="review-list" id="review-heading">
        {items.map((item) => (
          <article className="review-row" key={`${item.asset}-${item.reviewDate}`}>
            <div><strong>{item.asset}</strong><small>החלטה או נכס</small></div><div><strong>{item.horizon}</strong><small>אופק מקורי</small></div><div><strong>{item.reviewDate}</strong><small>תאריך סקירה</small></div><div><span className="review-status">{item.status}</span><small>מצב סקירה</small></div>
            <button type="button">פתיחת סקירה<ArrowLeft aria-hidden="true" size={16} /></button>
          </article>
        ))}
      </div>
      <p className="review-footnote">התור מציג החלטות לסקירה בלבד ואינו מחשב ביצועים.</p>
    </section>
  );
}

export function DailySnapshot({ snapshot, presentation }) {
  return (
    <main className="daily-snapshot" dir="rtl">
      <header className="page-header">
        <div><p className="eyebrow">{snapshot.eyebrow}</p><h1>{snapshot.title}</h1><p>{snapshot.subtitle}</p></div>
        <div className="presentation-selector" aria-label={presentation.title}>
          <div><strong>{presentation.title}</strong><small>{presentation.helper}</small></div>
          <div className="segmented-control">{presentation.options.map((option) => <button className={presentation.activeKey === option.key ? "is-active" : ""} key={option.key} onClick={() => presentation.onChange(option.key)} type="button">{option.label}</button>)}</div>
        </div>
      </header>
      <div className="content-stack">
        <StatusRow items={snapshot.status} closureNotice={snapshot.closureNotice} />
        <RiskPanel data={snapshot.risk} />
        <MacroPanel data={snapshot.macro} />
        <FocusPanel data={snapshot.focus} />
        <PlanPanel data={snapshot.plan} />
        <ReviewPanel items={snapshot.reviews} />
      </div>
    </main>
  );
}
