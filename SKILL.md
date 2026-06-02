# SKILL.md — YouTube Mentor Dashboard

## Project Identity

**Name:** YouTube Mentor Dashboard  
**Stack:** React + localStorage (Base44 platform)  
**Purpose:** Personal system for managing, fetching, and AI-analyzing YouTube videos from a fixed list of mentors/channels — with zero automatic AI usage.

---

## Core Concept

Two separate flows — **never mix them**:

| Flow | Trigger | What it does |
|------|---------|-------------|
| Fetch Videos | Manual button or every 12h | Pulls new video metadata only |
| AI Analysis | Manual click per video | Fetches transcript + runs AI |

---

## Data Models

### Mentor
```js
{
  id: "mentor_123",
  name: "Mentor Name",
  channelName: "YouTube Channel Name",
  channelUrl: "https://youtube.com/@example",
  channelId: "UCxxxx",
  category: "Trading | Psychology | AI | Business",
  description: "Short description",
  isActive: true,
  fetchMode: "manual | every_12_hours",
  lastFetchedAt: null,
  createdAt: "ISO date",
  updatedAt: "ISO date"
}
```

### Video
```js
{
  id: "youtube_video_id",
  mentorId: "mentor_123",
  channelId: "UCxxxx",
  url: "https://youtube.com/watch?v=xxxx",
  title: "Video Title",
  description: "Video description",
  thumbnail: "thumbnail url",
  channelName: "Channel Name",
  publishedAt: "ISO date",
  duration: "PT20M10S",
  viewCount: null,
  createdAt: "ISO date",

  transcriptStatus: "not_checked | found | found_empty | unavailable",
  transcriptSource: null,
  transcript: null,

  analysisStatus: "not_analyzed | analyzing | completed | failed",
  analysisLevel: "none | basic | advanced | notebook | lm",
  chapters: [],
  summary: null,
  keyInsights: [],
  actionItems: [],
  analysisError: null,
  analyzedAt: null
}
```

### Advanced Analysis (optional, added after basic)
```js
{
  advancedAnalysis: {
    status: "not_started | analyzing | completed | failed",
    modelType: "notebook | lm | other",
    deepSummary: "",
    concepts: [],
    frameworks: [],
    examples: [],
    quotes: [],
    practicalApplications: [],
    questionsForReview: [],
    createdAt: null
  }
}
```

### Settings
```js
{
  autoFetchEnabled: true,
  fetchIntervalHours: 12,
  maxVideosPerChannel: 10,
  defaultLanguagePriority: ["he", "iw", "en"],
  aiAnalysisMode: "manual_only"
}
```

### Fetch Log
```js
{
  id: "log_123",
  startedAt: "ISO date",
  endedAt: "ISO date",
  status: "success | partial | failed",
  channelsChecked: 5,
  videosAdded: 12,
  errors: []
}
```

---

## localStorage Keys

| Key | Content |
|-----|---------|
| `youtubeAnalyzer.mentors` | Array of mentor objects |
| `youtubeAnalyzer.videos` | Array of video objects |
| `youtubeAnalyzer.settings` | Settings object |
| `youtubeAnalyzer.fetchLogs` | Array of fetch log objects |

---

## File Structure

```
src/
├── services/
│   ├── youtubeChannels.js     — fetch channel metadata, validate channelId
│   ├── youtubeVideos.js       — fetch new videos per channel
│   ├── youtubeTranscript.js   — fetch transcript (captions priority order)
│   ├── aiAnalysis.js          — basic + advanced AI analysis
│   ├── storage.js             — localStorage read/write wrappers
│   ├── mentorStorage.js       — mentor CRUD in localStorage
│   ├── videoStorage.js        — video CRUD in localStorage
│   ├── rssIngestion.js        — RSS feed ingestion per channel
│   ├── rssFeedHealth.js       — check RSS feed status
│   ├── autoRssSync.js         — 12h scheduler logic
│   ├── videoAnalytics.js      — video stats helpers
│   └── youtubeMetadata.js     — video metadata utilities
│
├── hooks/
│   ├── useMentors.js          — mentor list state + CRUD
│   ├── useVideos.js           — video list state + filters
│   ├── useFetchScheduler.js   — 12h auto-fetch timer
│   ├── useVideoAnalysis.js    — trigger + track AI analysis
│   ├── useCategories.js       — category list management
│   ├── useNotes.js            — per-video notes
│   └── useProcessingJobs.js   — background job queue state
│
├── components/
│   ├── mentors/
│   │   └── AddMentorDialog.jsx
│   ├── dashboard/
│   │   ├── VideoCard.jsx
│   │   ├── VideoDetailPanel.jsx
│   │   ├── ChapterItem.jsx
│   │   ├── FilterBar.jsx
│   │   ├── KpiCards.jsx
│   │   └── NoteEditor.jsx
│   └── ui/                    — shadcn/radix base components
│
└── pages/
    ├── Dashboard.jsx           — KPIs + fetch button + status
    ├── MentorPage.jsx          — mentor table + add/edit/delete
    ├── SavedVideos.jsx         — all videos + filters + analysis buttons
    ├── Admin.jsx               — settings + fetch logs
    └── TopicLearningPage.jsx   — topic-based learning hub
```

---

## Screens

### 1. Dashboard
- KPI cards: mentor count, video count, analyzed/unanalyzed
- "Fetch Videos Now" button
- Last fetch status + timestamp

### 2. Mentors Page
- Table: name, channel, category, active toggle, fetchMode selector, lastFetchedAt
- Add / Edit / Delete mentor
- fetchMode: `manual` | `every_12_hours`

### 3. Videos Page (SavedVideos)
- Video list from all channels
- Filters: by mentor, by analysisStatus, by date
- Per video: "AI Analysis" button, "Re-analyze" button, "Open Details" button

### 4. Video Detail Panel
- Metadata (title, channel, duration, publishedAt)
- Transcript (if available)
- Chapters with timestamps
- Summary, keyInsights, actionItems
- "Advanced Analysis" button
- "Send to Notebook / LLM" button

---

## Flows

### Fetch Videos Flow
1. User clicks "Fetch Videos" or scheduler fires (every 12h, checks `lastFetchedAt`)
2. Loop over active mentors only
3. Per mentor: fetch new videos via RSS or YouTube API
4. Skip videos already in localStorage (dedup by video id)
5. Save metadata only — no transcript, no AI
6. Write fetch log entry

### Basic AI Analysis Flow
1. User clicks "AI Analysis" on a video
2. Fetch transcript using priority order:
   - Manual captions
   - Manual captions in Hebrew / English
   - Auto-generated captions
   - json3 format
   - srv3 format
3. If transcript found → save it → send to AI
4. AI returns: summary, chapters (with timestamps), keyInsights, actionItems
5. Save result, update `analysisStatus: "completed"`
6. If no transcript → show clear error, set `transcriptStatus: "unavailable"`, do not call AI

### Advanced Analysis Flow
1. User clicks "Advanced Analysis" (only after basic is complete)
2. If no transcript → show error, block flow
3. Send transcript + basic summary to advanced AI model
4. Save result in `advancedAnalysis` field

---

## System Rules (must always follow)

1. Never run AI during video fetch
2. Never fetch transcript during video fetch
3. Never auto-analyze any video
4. AI analysis only on explicit user click
5. 12h scheduler must check `lastFetchedAt` before running
6. Never add a duplicate video (dedup by YouTube video id)
7. Store all data in localStorage, separated by key
8. Display clear errors to user — never crash silently
9. If a channel returns no videos — handle gracefully, don't crash
10. Keep fetch flow and analysis flow completely independent

---

## Existing Services (already in repo)

| File | Status |
|------|--------|
| `youtubeTranscript.js` | exists |
| `youtubeApi.js` | exists |
| `youtubeMetadata.js` | exists |
| `rssIngestion.js` | exists |
| `rssFeedHealth.js` | exists |
| `autoRssSync.js` | exists |
| `videoStorage.js` | exists |
| `mentorStorage.js` | exists |
| `videoAnalytics.js` | exists |
| `aiAnalysisStore.js` (lib) | exists |
| `localVideoStore.js` (lib) | exists |

---

## Key Constraints

- React only — no backend
- localStorage only — no database
- AI is manual-only — no auto triggers
- Fetch and analysis are fully separate flows
- Base44 platform — use Base44 entities/functions where applicable
- API keys in `.env` only — never in code
