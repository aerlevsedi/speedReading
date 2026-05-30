---
project: Speed-Reading Training App
version: 1
status: draft
created: 2026-05-22
context_type: greenfield
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-06-22
  after_hours_only: true
---

# Product Requirements Document: Speed-Reading Training App

## Vision & Problem Statement

Young adults and adults (18-50) who read heavily — students, job-related readers, or developers reading code — spend too much time reading carefully and slowly. This wastes time that could be used for implementation, homework, or other work. They want to improve their reading speed but have no structured way to learn it. The moment of pain: when they need to find information quickly in large volumes of text (books, documentation, code files) and understand main ideas without reading every word. The cost today: time, energy, and money wasted on slow reading, lack of structured practice, no proof of progress, and uncertainty about if/when they've mastered speed-reading and can stop using the app.

Existing speed-reading apps lack two critical elements: (1) progress proof and graduation signal ("you learned it, now stop"), and (2) domain-specific exercises (code snippets, technical documentation for developers). Building for multiple user types is acknowledged as a hard task — domain-specificity may need to be scoped carefully in MVP. The key qualities required: pleasant and gamified experience (users are tired after work/studying), and visible progress with a graduation point (proof they learned something).

## User & Persona

**Primary persona:** Developers (18-50 years old) who read large volumes of code, documentation, and technical articles daily.

**Persona details:**
- Read heavily as part of their job (navigating codebases, understanding documentation, reviewing pull requests)
- Need to find the correct place in a file quickly
- Need to understand the main idea of a code snippet without reading every word carefully
- Tired after work — require an app that's pleasant and has gamification elements
- Want to see measurable progress and know when they've achieved mastery (graduation point)
- Motivated by time savings: less time reading = more time implementing tickets, writing code, or personal projects

**Out-of-scope personas for MVP:**
- Students reading textbooks/papers
- General heavy readers (business docs, reports, articles)

(These may be revisited post-MVP if domain-specific exercises can be abstracted.)

## Success Criteria

### Primary

User can complete one full exercise session:
1. Log in
2. See dashboard with goal, progress, and exercise cards (one marked "recommended")
3. Select an exercise
4. Complete the exercise (with first-time intro if applicable)
5. See results summary with comparison to goal and previous sessions (chart)
6. Navigate to another exercise or back to dashboard

**MVP flow details:**
- 4 exercise types
- 2 datasets per exercise type (8 exercise instances total)
- Recommendation logic: "least used" algorithm
- Goal setting: user sets target reading speed (e.g., 400 wpm)
- Goal comparison: display actual vs target (e.g., "you read at 250 wpm, goal is 400 wpm → 62.5% of goal")
- Auth: login/logout with auto-logout after 1 hour inactivity
- Results display: errors, duration, comparison chart to previous sessions

**Deferred from original idea:**
- Forecast (removed — unclear how to forecast speed-reading progress)
- Multiple datasets per exercise (scoped to 2 per type)
- Complex recommendation algorithms

### Secondary

**Leaderboard** — displays results of all users to motivate competition and engagement. Explicitly out of MVP scope; implement only if all other features are complete.

### Guardrails

1. **Privacy:** Only authenticated users can access the dashboard and personal exercise history. No unauthenticated access to user data.

2. **UX:** Exercises are nicely displayed and clear. Instructions are accessible (first-time intro + question-mark icon for subsequent sessions).

## User Stories

### US-01: Access and finish the exercise

**As a** existing user
**I want to** login to the app using email/gmail auth, enter my dashboard, and be able to select and start one exercise
**So that** I can work on my speed-reading skill and compare my results with previous sessions.

**Given** Landing page with login view
**When** the user logs in and selects an exercise from the dashboard
**Then** (s)he can finish it and see the result.

## Functional Requirements

### Authentication

- FR-001: User can log in using email/password or OAuth (Gmail). Priority: must-have
  > Socrates: Counter-argument considered: "OAuth might be down; email/password hard to implement safely and could be hacked." Resolution: kept, but consider picking one auth method for MVP to reduce complexity and attack surface.

- FR-002: User can log out manually. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

- FR-003: User is automatically logged out after 1 hour of inactivity. Priority: must-have
  > Socrates: Counter-argument considered: "Auto-logout adds complexity with no clear benefit." Resolution: consider making optional or removing if not essential for MVP security posture.

### Dashboard & Navigation

- FR-004: User can view the dashboard showing goal, current progress, and exercise cards. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

- FR-005: User can see which exercise is recommended (marked on dashboard). Priority: must-have
  > Socrates: Counter-argument considered: "Recommendation on first login is arbitrary — new users have no history." Resolution: kept; handle cold-start with default recommendation (e.g., first exercise alphabetically, or prompt user to pick starting exercise).

### Exercise Execution

- FR-006: User can select an exercise from the dashboard. Priority: must-have
  > Socrates: Counter-argument considered: "User agency is important." Resolution: kept; users want control over which exercise to do.

- FR-007: User sees an intro on first use of each exercise type. Priority: must-have
  > Socrates: Counter-argument considered: "First-time users need onboarding." Resolution: kept; intro is essential for UX.

- FR-008: User can access exercise instructions via question-mark icon (subsequent sessions). Priority: must-have
  > Socrates: Counter-argument considered: "Instructions should always be visible." Resolution: kept, but reconsider UI — ensure instructions are prominent enough or always visible, not buried in icon.

- FR-009: User can start an exercise. Priority: must-have
  > Socrates: Counter-argument considered: "Explicit start gives user control." Resolution: kept; users need a moment to prepare.

- FR-010: User can complete an exercise and receive results. Priority: must-have
  > Socrates: Counter-argument considered: "Completing and receiving results is core." Resolution: kept; this is the payoff.

- FR-011: User can navigate to another exercise after completion. Priority: must-have
  > Socrates: No counter-argument; it stands as written. Enhancement noted: suggest break after 3 exercises to prevent fatigue.

- FR-012: User can retry the same exercise type with a different dataset. Priority: must-have
  > Socrates: Counter-argument considered: "Retry with same dataset is useless — users memorize answers." Resolution: kept; different dataset is required for valid practice.

- FR-013: User can return to dashboard after exercise completion. Priority: must-have
  > Socrates: Counter-argument considered: "Auto-return removes user control." Resolution: kept; explicit 'Back to Dashboard' button is correct UX.

### Progress & History

- FR-014: User can view results summary showing errors, duration, and comparison to previous sessions (chart). Priority: must-have
  > Socrates: Counter-argument considered: "Comparison chart on first session is impossible — new users have no history." Resolution: kept; handle cold-start gracefully with placeholder message like "Complete more sessions to see your progress chart."

- FR-015: User can view comparison of actual reading speed to goal (e.g., "250 wpm / 400 wpm goal → 62.5%"). Priority: must-have
  > Socrates: Counter-argument considered: "Goal comparison on first session is demotivating — new users see low percentages." Resolution: kept; handle cold-start with encouragement message instead of percentage, or skip comparison until 2-3 sessions completed.

### Goal Management

- FR-016: User can set a reading speed goal (e.g., 400 wpm). Priority: must-have
  > Socrates: Counter-argument considered: "Users don't know what realistic wpm goal is." Resolution: kept; need to provide guidance — measure baseline first, suggest goal ranges (beginner: 200-250 wpm, intermediate: 300-350 wpm, advanced: 400+ wpm), or set smart default.

- FR-017: User can change/update their reading speed goal. Priority: must-have
  > Socrates: Counter-argument considered: "Users need flexibility to adjust goals." Resolution: kept; users should be able to set higher targets as they improve.

### System Capabilities

- FR-018: System provides 4 different exercise types. Priority: must-have
  > Socrates: Counter-argument considered: "4 types proves variety." Resolution: kept; need enough exercises to show the product isn't a one-trick app.

- FR-019: System provides 2 datasets per exercise type (8 total exercise instances). Priority: must-have
  > Socrates: Counter-argument considered: "2 datasets proves the system works." Resolution: kept; MVP just needs to show dataset-swapping is possible; more can be added later.

- FR-020: System recommends the least-used exercise type to the user. Priority: must-have
  > Socrates: Counter-argument considered: "Least-used prevents skill stagnation." Resolution: kept; recommendation pushes users to harder/neglected exercises. Note: cold-start problem — on first login, all exercises are equally unused; recommendation is arbitrary.

## Non-Functional Requirements

1. **Performance:** Dashboard and exercise views load quickly — perceived as fast by users on typical broadband connections (target: less than 2 seconds for initial load).

2. **Browser support:** App works on desktop browsers (Chrome, Firefox, Safari, Edge — latest stable versions). If the web app can be responsive and mobile-friendly without extra effort, that's acceptable, but desktop is the primary target. Native mobile app is out of scope.

3. **Data retention:** All exercise history is retained permanently. No automatic deletion or expiration of user data. Users build a complete historical record of their progress.

4. **Privacy:** Only authenticated users can access the dashboard and personal exercise history. No unauthenticated access to user data.

## Business Logic

**Core domain rule:** The app analyzes user exercise history to recommend which exercise to do next (least-used type) and tracks session activity (exercises completed in sequence) to suggest breaks that prevent fatigue.

**Inputs (user-facing):**
- Exercise completion history: which exercise types the user has done, how many times each type has been completed
- Current session state: how many exercises completed in a row or within a time window (hardcoded threshold)
- User's explicit exercise selection: user can override the recommendation and pick any exercise

**Output:**
- **Recommended exercise:** displayed on dashboard, marked visually (e.g., "Recommended" badge on exercise card). Determined by least-used algorithm — the exercise type the user has completed the fewest times is recommended.
- **Break suggestion:** triggered after threshold is reached (e.g., after 3 exercises completed in a row or within a hardcoded time window). Displays a message like "You've completed 3 exercises — consider taking a break to avoid fatigue."

**How the user encounters it:**
User logs into the dashboard and sees one exercise card marked "recommended" based on the least-used algorithm. User can select the recommended exercise or pick a different one (user agency preserved). After completing 3 exercises in a row (or within the hardcoded time window), the app displays a break suggestion. The user can dismiss it and continue, or follow the suggestion and return later.

**Cold-start handling:**
- New users: all exercise types are equally unused. Recommendation falls back to a default (e.g., first exercise alphabetically, or prompt user to pick starting exercise).
- After first few sessions: recommendation becomes meaningful as usage history differentiates.

## Access Control

**Authentication method:** Login (email + password / OAuth / passwordless)

**User model:** Flat — no roles, no admin/member/guest differentiation in MVP. All authenticated users have the same access level.

**Access flow:**
- User must log in to access the dashboard and personal exercise history
- Data persists across sessions and devices (server-side storage)

**Nice-to-have (out of MVP scope):**
- Landing page accessible to unauthenticated visitors (guests)
- Allows 2 exercises: reading speed test + app preview
- One-time results display only — no history persistence for guest sessions

## Non-Goals

This MVP explicitly does NOT include:

1. **Leaderboard / social features** — already marked out of scope in original idea; making it explicit to prevent feature creep. Users can see their own progress but not compare with other users.

2. **Advanced analytics / detailed progress reports** — simple charts only (comparison to previous sessions, goal percentage). No drill-down, export functionality, or complex visualizations. Keep data presentation straightforward.

3. **Custom exercise creation by users** — app ships with fixed exercise datasets (4 types × 2 datasets = 8 instances). Users cannot upload their own text, create custom exercises, or modify existing ones. Content is curated and provided by the app.

4. **Native mobile app** — no iOS/Android native app, no hybrid app framework. Web app accessed via desktop browsers is primary; responsive design is acceptable if it doesn't add complexity, but native mobile app development is out of scope.

## Open Questions

(None — all quality elements were present in the input and `quality_check_status: accepted`.)
