ParkTracker notes.md
# ParkTracker

A browser-based park journey tracker focused on reflection, memory, and long-term exploration rather than gamification or performance tracking.

ParkTracker is intentionally lightweight, calm, outdoors-oriented, and personal in tone. The app emphasizes continuity, revisit history, and personal park memories over metrics or competition.

---

# Core Philosophy

ParkTracker is not intended to feel like:
- a fitness tracker
- a hiking analytics platform
- a social feed
- a competitive leaderboard
- a productivity dashboard

Instead, the experience should feel:
- reflective
- personal
- outdoorsy
- lightly nostalgic
- calm and uncluttered

The app focuses on:
- remembering parks explored over time
- maintaining a personal journey history
- revisiting meaningful places
- gradual long-term progress

Feature decisions should preserve this tone.

---

# Branding

Current brand name:
- ParkTracker

Current positioning:
- “Remember your park journey.”

Branding direction:
- lightweight
- future multi-state friendly
- nature-oriented
- minimal over-branding

---

# Frontend Stack

- Vanilla JavaScript
- HTML
- CSS
- Supabase REST API
- No frameworks
- No ORM
- No build step

Hosting:
- GitHub + Vercel auto deploy

---

# File Structure

```text
app.js
env.js
index.html
privacy.html
styles.css
terms.html
README.md

/public
 favicon.png

/public/images
 dashboard.png
 details.png
 parks.png
 logo-primary.svg

Application Architecture
Central Rendering Pattern
renderApp() is the single source of truth for UI rendering.
The app uses a centralized state-driven rendering architecture.
State updates flow through:
setState(updates)
which:
merges updates into global state
automatically triggers renderApp()
This keeps rendering predictable and avoids fragmented UI updates.

Global State Shape
const state = {
 parks: [],
 visits: [],
 achievements: [],
 userAchievements: [],
 currentPark: null,
 currentView: "dashboard",
 editingVisitId: null,
};

Rendering Philosophy
The app prefers:
derived state
simple helper functions
readable rendering logic
incremental improvements
minimal abstraction
Avoid:
overengineering
excessive componentization
unnecessary indirection
framework-style architecture patterns

View System
Primary views:
Landing view
Dashboard view
Parks list view
Park detail view
Visibility is controlled via:
style.display
Current view values:
dashboard
parks
detail

Visit System
The visit model is the core of the app.
Important Architectural Rule
Visit history is the source of truth.
The app does NOT store:
visited flags
completion states
counters
Instead, all derived state comes from the visits table.
Examples:
visited parks
visit counts
last visited dates
momentum messages
achievements
are all derived dynamically from visit history.

Visit Architecture
Each visit is its own database row.
Supported fields:
visit date
notes
Users can:
add visits
edit visits
delete visits
revisit parks multiple times

Optimistic UI Pattern
Visit mutations use optimistic updates with rollback on failure.
Flow:
save optimistic local state
render immediately
attempt API mutation
rollback if failed
re-fetch visits after success
This pattern is used for:
add visit
edit visit
delete visit

Achievement System
Achievements are threshold-based.
Examples:
first park
milestone counts
completion milestones
Achievements are intentionally:
lightweight
secondary to the journey itself
not overly gamified
Unlocked achievements trigger:
toast notification
achievement highlight animation

Momentum Messaging
Momentum messaging is intentionally reflective rather than streak-based.
Examples:
“You’ve visited 3 parks this month.”
“It’s been over a year since your last visit here.”
“Your park journey is just beginning.”
Avoid:
streak pressure
urgency
productivity language
competitive framing
The app should never feel like a fitness app.

Current Major Features
Implemented:
Landing page
Persistent branded header
Logo system
Favicon
Dashboard
Recent visits
Achievement system
Toast notifications
Park detail pages
Visit history
Add/edit/delete visits
Optimistic updates
Last visit signals
Momentum messaging
Progress tracking
Park filtering
Visit badges
Responsive/mobile layout

Current UX Principles
Preferred:
reuse existing UI
lightweight flows
practical UX
calm visual hierarchy
Avoid:
modal-heavy flows
aggressive notifications
over-gamification
cluttered dashboards

Supabase Architecture
ParkTracker currently uses:
Supabase REST API
anonymous/localStorage-based user identity
no formal authentication yet
Important
ParkTracker currently uses anonymous users with localStorage UUIDs.
Policies and grants are designed around this architecture.
Future migration path may include:
optional accounts
guest-to-account upgrade flow
cross-device syncing

Database Tables
parks
Reference table containing park information.
No RLS currently enabled.
Used for:
park list
detail pages
metadata
future multi-state support
Schema
create table public.parks (
id bigint generated always as identity not null,
park_name text not null,
nearest_city text null,
county text null,
latitude numeric(9, 6) null,
longitude numeric(9, 6) null,
year_established integer null,
dnr_url text null,
description text null,
state character(2) null,
constraint parks_pkey primary key (id)
);
Indexes
create index IF not exists idx_parks_name
on public.parks using btree (park_name);

visits
Core source-of-truth table.
Stores all user visit history.
Schema
create table public.visits (
id bigint generated always as identity not null,
user_id uuid null,
park_id bigint null,
visit_date date not null,
notes text null,
created_at timestamp with time zone null default now(),
constraint visits_pkey primary key (id),
constraint visits_park_id_fkey foreign KEY (park_id)
references parks (id) on delete CASCADE
);
Indexes
create index IF not exists idx_visits_user_id
on public.visits using btree (user_id);

create index IF not exists idx_visits_park_id
on public.visits using btree (park_id);
RLS
Enabled.
Policies support:
select
insert
update
delete

achievements
Static reference table.
Contains achievement definitions.
No RLS currently enabled.
Schema
create table public.achievements (
id bigint generated always as identity not null,
title text not null,
description text null,
threshold integer not null,
created_at timestamp with time zone null default now(),
constraint achievements_pkey primary key (id)
);

user_achievements
Stores unlocked achievements per user.
Schema
create table public.user_achievements (
id bigint generated always as identity not null,
user_id uuid null,
achievement_id bigint null,
date_unlocked timestamp with time zone null default now(),
unlocked_at timestamp without time zone null,
constraint user_achievements_pkey primary key (id),
constraint user_achievements_achievement_id_fkey foreign KEY (achievement_id)
references achievements (id) on delete CASCADE
);
Indexes
create index IF not exists idx_user_achievements_user_id
on public.user_achievements using btree (user_id);

create index IF not exists idx_user_achievements_achievement_id
on public.user_achievements using btree (achievement_id);
RLS
Enabled.
Policies support:
insert
select

photos (future feature)
Currently empty placeholder table.
Intended for future optional visit photo uploads.
Schema
create table public.photos (
id bigint generated always as identity not null,
visit_id bigint null,
photo_url text not null,
caption text null,
uploaded_at timestamp with time zone null default now(),
constraint photos_pkey primary key (id),
constraint photos_visit_id_fkey foreign KEY (visit_id)
references visits (id) on delete CASCADE
);
Indexes
create index IF not exists idx_photos_visit_id
on public.photos using btree (visit_id);

Grants
grant select on public.parks to anon;
grant select on public.parks to authenticated;

grant select on public.achievements to anon;
grant select on public.achievements to authenticated;

grant select, insert, update, delete
on public.visits
to anon;

grant select, insert
on public.user_achievements
to anon;
These grants were added explicitly in response to Supabase Data API exposure changes announced for 2026.

Current Technical Debt / Future Architecture Considerations
Authentication
Current anonymous UUID system is acceptable for MVP usage but may eventually evolve toward:
optional accounts
Supabase Auth
cross-device sync
subscriptions

Multi-State Expansion
Database already includes:
state character(2)
in parks table.
Future architecture should support:
Wisconsin
Illinois
Minnesota
additional state systems
without major frontend rewrites.

Future Features (Planned / Possible)
Medium Priority:
quick add visit
improved error surface
retry-friendly save UX
Longer-Term:
state-specific achievements
multi-state expansion
photo uploads
story/journal links
export/backup
optional accounts
monetization
freemium features

Product Direction
ParkTracker should continue emphasizing:
memory
personal history
quiet progress
exploration over optimization
The emotional tone is one of the app’s strongest differentiators and should be protected during future development.
