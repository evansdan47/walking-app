User Menu / Account Hub Plan

The current Clerk menu should be replaced with a Rambleio-branded account panel that keeps Clerk for authentication, but owns the product experience. Clerk remains responsible for identity/sign-in, while Rambleio owns profile, preferences, subscription, goals, rewards, and future sharing.

This fits the existing architecture because the app already uses Clerk + Convex user records, with a users table created from the auth identity. The current schema only stores tokenIdentifier, name, and email, so this is a good point to expand the user model.

Recommended Menu Structure
1. Compact User Dropdown

Clicking the avatar opens a branded dropdown:

Header

Avatar
Display name
Email
Subscription badge: Beta

Quick actions

View profile
Settings & preferences
Goals & progress
Badges & awards
Subscription
Sign out

The dropdown should stay lightweight. Anything detailed opens a full page, drawer, or modal.

2. Full Account Area

Create an /account area with sections:

Section	Purpose
Profile	Avatar, display name, email
Subscription	Current plan, billing status, future upgrade/manage buttons
Preferences	Units, weight, display settings, app defaults
Goals	User-created walking goals
Rewards	Badges, awards, streaks, milestones
Sharing	Later: share profile, invite friends, export/share routes
Account	Sign out, delete/export data
User Preferences

Store preferences in an expandable JSON/object field on the user record.

Suggested starting preferences:

preferences: {
  units: {
    distance: "km" | "miles",
    weight: "kg" | "lb",
  },
  profile: {
    weightKg?: number,
  },
  display: {
    defaultMapView?: "terrain" | "standard",
    showCalories?: boolean,
  },
  privacy: {
    defaultWalkVisibility: "private" | "public",
  },
}

Weight should be optional and clearly explained as used for calorie/energy estimates.

Subscription Model

For now:

subscription: {
  plan: "beta",
  status: "active",
}

Later this can become:

subscription: {
  plan: "free" | "plus" | "pro" | "beta",
  status: "active" | "trialing" | "past_due" | "cancelled",
  providerCustomerId?: string,
}
Goals System

Users should be able to create multiple active goals:

Examples:

Walk 20 km this month
Complete 3 walks this week
Walk 100 km in 90 days
Record 5 new routes
Walk 30 minutes a day for 7 days

Goal types:

goalType:
  | "distance"
  | "walk_count"
  | "duration"
  | "streak"
  | "elevation"
  | "route_creation"

Progress can be calculated from completed walks, which already store distance, duration, moving time, stopped time, pace, elevation, and point count after recording.

Badges / Awards System

Use 10 categories with 10 awards each. Badges should unlock automatically from user activity.

1. Getting Started
First Steps — Record your first walk
Route Rookie — Plan your first route
First Review — Open your first completed walk
First Photo — Add a photo to a walk
Profile Ready — Add an avatar
Preference Setter — Set your units
Goal Setter — Create your first goal
Badge Beginner — Unlock your first badge
Weekend Walker — Walk on a weekend
Rambleio Beta Explorer — Join during beta
2. Distance Milestones
1 km Walked
5 km Walked
10 km Walked
25 km Total
50 km Total
100 km Total
250 km Total
500 km Total
1,000 km Total
Long Hauler — Complete a 20 km walk
3. Consistency
Two-Day Streak
Three-Day Streak
Five-Day Streak
Seven-Day Streak
Weekend Habit
Walked 3 Times in a Week
Walked 5 Times in a Week
Walked Every Week for a Month
Monthly Regular
Ramble Rhythm — 12 active weeks
4. Monthly Challenges
10 km in a Month
25 km in a Month
50 km in a Month
100 km in a Month
3 Walks in a Month
10 Walks in a Month
20 Walks in a Month
5 Hours Walking in a Month
10 Hours Walking in a Month
Month Master
5. Exploration
First New Area
Walked 3 Different Areas
Walked 5 Different Areas
Walked 10 Different Areas
Coastal Explorer
Woodland Wanderer
Hill Walker
Urban Rambler
Countryside Explorer
New Horizons
6. Route Planning
First Planned Walk
Planned 3 Routes
Planned 10 Routes
Planned a Circular Route
Planned a Short Walk
Planned a Long Walk
Added First POI
Added 10 POIs
Published First Route
Route Architect
7. Recording Quality
Clean Track — Complete a walk with good GPS quality
No Pauses — Walk continuously for 30 minutes
Long Recording — Record over 2 hours
Photo Journal — Add 5 photos to one walk
Early Bird — Start before 8am
Sunset Walker — Walk after 7pm
Rain or Shine — Walk in poor conditions, later if weather exists
Accurate Route — High clean-point percentage
Complete Session — Stop and save properly
Reliable Rambler
8. Elevation
First Climb — 50 m ascent
100 m Ascent
250 m Ascent
500 m Total Ascent
1,000 m Total Ascent
Hill Seeker
Ridge Rambler
Summit Spirit
Up and Over
Mountain Goat
9. Following Routes
Follow First Route
Complete Follow Session
Stayed On Route
Followed 3 Routes
Followed 10 Routes
Returned to Route
Rewalked Own Route
Followed a Public Route
Completed Route Without Alert
Route Follower

This connects well with the planned replay/follow feature, where saved walks become routes and the app can detect off-route events.

10. Community-Light / Sharing
Shared First Walk
Shared First Route
Exported a Walk
Invited a Friend
Route Viewed by Someone
Route Saved by Someone
Helpful Tagger
Confirmed a POI
Confirmed a Route Tag
Local Contributor

Keep this sharing-focused, not chat-focused. Conversations can happen offsite.

Suggested Schema Additions
users: {
  tokenIdentifier,
  name,
  email,
  avatarStorageId?,
  preferences?: object,
  subscription?: object,
  stats?: object,
  createdAt,
  updatedAt,
}

New tables:

userGoals
userBadges
badgeDefinitions
userProgressEvents

Keep badge definitions data-driven so new badges can be added without app updates.

Implementation Phases
Phase 1 — Custom Dropdown

Replace Clerk menu visually, but keep Clerk auth/sign-out underneath.

Phase 2 — Profile & Preferences

Avatar, units, weight, display settings.

Phase 3 — Subscription Placeholder

Show Beta plan now. Build the UI in a way that can later connect to billing.

Phase 4 — Goals

Allow users to create goals and view progress.

Phase 5 — Badges

Add badge definitions, unlock logic, badge gallery, and recent unlock notifications.

Phase 6 — Sharing/Friends Later

Add shareable routes and friend discovery only when there is enough content to justify it.

Overall recommendation: make the user menu feel like the user’s walking dashboard, not just an account dropdown.