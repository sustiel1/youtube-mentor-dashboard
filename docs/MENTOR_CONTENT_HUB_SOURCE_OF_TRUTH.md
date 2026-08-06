# Mentor Content Hub — Source of Truth

## Canonical identity

The YouTube channel ID is the stable primary identity. A handle or validated channel URL is a backward-compatible fallback and is never inferred from a display name. Mentor records own channel identity; video fields are compatibility evidence only.

## Content contract

`mentor.contentHub` may contain `tabs`, `playlists`, `curatedLinks`, `updatedAt`, and `status`. UI state is not persisted in this object. A tab is displayed only when verified, explicitly configured, or supported by local video evidence. Home and channel search are safely derived from a valid canonical channel URL.

## Channel quick navigation

`src/lib/mentorChannelResources.js` owns compact, mentor-level channel shortcuts. Resolution prefers an exact YouTube channel ID, then mentor ID, explicit handle/channel URL, and finally a legacy display name only when no stable identity is present. Components never guess a handle or construct tab URLs from display text.

The mentor-owned `channelResources` collection is the canonical editable source. It preserves stable `id`, `type`, Hebrew label and description, HTTPS `url`, `enabled`, numeric `order`, `source`, and `verified`. Local built-in mentors persist this field through the versioned mentor-resource override adapter; custom/database mentors retain it on their mentor record as well. Disabled entries remain stored but are not rendered.

Micha.Stocks (`UCSxjNbPriyBh9RNl_QNSAtw`) retains six explicitly verified legacy destinations as a compatibility fallback. Precedence is persisted mentor resources, verified legacy registry, then no menu. Saving even an empty resource collection suppresses the fallback and never rewrites video records. No render-time migration occurs.

The shared `MentorChannelQuickNav` trigger and portal menu are consumed by the main Dashboard toolbar and the Video Detail channel-name control. Additional mentor surfaces must reuse the same component and resolver, selecting an appropriate visual variant rather than duplicating resource arrays or menu behavior.

Standard channel tabs and topic/course resources are rendered in separate non-empty groups. The Administration mentor editor is the only management UI: it validates before save, requires explicit confirmation before deriving standard links from an explicit handle, and updates all consumers through the shared mentors query.

## Persistence, validation and portability

Only safe HTTPS URLs are accepted. Standard tabs require a YouTube host; playlist resources require an explicit playlist target; duplicate IDs and normalized URLs, credential-bearing URLs, sensitive query keys, empty labels, and overlong descriptions are rejected. Arbitrary icon markup is not accepted.

`exportMentorChannelResourceOverrides` and `importMentorChannelResourceOverrides` provide a versioned, validated, idempotent configuration round trip for backup tooling. Older mentor records and backups without `channelResources` remain valid. The current Workspace knowledge ZIP and video JSON backup are not mentor-configuration import flows and must not be described as restoring mentor settings until their UI explicitly adopts this adapter.

## Discovery and ownership

Public playlist discovery must use the official YouTube Data API through a server-side adapter. Playlist URLs are built only from exact playlist IDs. The UI does not scrape YouTube HTML, call undocumented endpoints, expose API keys, or guess URLs from titles. Manual overrides supplement discovered data and do not replace it.

## Cache and failure behavior

Discovered content is mentor-owned and should retain `updatedAt` and a `ready`, `partial`, or `unavailable` status. A failed refresh preserves the last valid cache. Private, inaccessible, malformed, or non-HTTPS resources are excluded.

## Security and accessibility

External links open in a new tab with `noopener noreferrer`. The internal dialog is keyboard accessible, RTL-aware, and does not mutate card selection or mentor filters.

## Regression requirements

Tests cover stable channel identity, exact playlist IDs, verified tab visibility, hidden unavailable tabs, unknown-channel behavior, secure links, and compatibility for newly added mentors.
