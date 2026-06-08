Expanded Goal Categories

I would expand the taxonomy to around 15 categories.

Physical Activity
1. Distance Goals
Walk 5 km
Walk 100 km this month
Walk 500 miles lifetime
2. Step Goals

Very important because many walkers already think in steps.

Examples:

10,000 steps today
50,000 steps this week
1 million steps lifetime

The user's weight and stride length settings could improve calculations later.

3. Duration Goals
Walk 30 minutes daily
Walk 20 hours this month
4. Elevation Goals

Simple elevation accumulation.

Examples:

Climb 500 m
Climb 1000 m this month
Climb 10,000 m this year
5. Pace Goals

Performance-oriented.

Examples:

Complete a walk under 12 min/km
Maintain 5 km/h average pace
Complete 5 walks faster than your average pace

This is probably a more advanced category.

Achievement Goals
6. Walk Count
Complete 3 walks this week
Complete 100 walks lifetime
7. Streak Goals
Walk 7 days consecutively
Walk every weekend for 3 months
8. Route Following

Tied directly to the replay system.

Follow 5 routes
Complete a route without deviation
Exploration Goals
9. New Places
Visit 10 new locations
Walk in 5 counties
Walk in 3 national parks
10. Route Planning
Create your first route
Publish 10 routes
Adventure Goals

This is where it gets really interesting.

11. Virtual Distance Challenges

User walks a real distance while progressing along a virtual route.

Examples:

Lands End → John O'Groats (~1407 km)
South West Coast Path
Hadrian's Wall
Camino de Santiago
Appalachian Trail

The app could show progress on a themed map.

Lands End → John O'Groats

352 km / 1407 km

25% complete

This is incredibly motivating.

12. Climb Challenges

Accumulate elevation equal to famous climbs.

Examples:

Challenge	Elevation
Eiffel Tower	330 m
Empire State Building	381 m
Snowdon	1085 m
Ben Nevis	1345 m
Kilimanjaro	5895 m
Everest	8849 m
K2	8611 m

Progress example:

Climb Everest

4,225 m / 8,849 m

This works brilliantly because most users will never physically climb Everest, but they can accumulate the ascent over many walks.

13. Landmark Challenges

Distance equivalents.

Examples:

Circumnavigate Cornwall
Walk the length of Wales
Walk around Lake District National Park
Coast to Coast Challenge
Health Goals
14. Calories / Energy

Only if weight is supplied.

Examples:

Burn 2,000 kcal this month
Burn 10,000 kcal this quarter

I'd keep this secondary because calorie estimates are always approximate.

15. Active Lifestyle Goals

These aren't about distance.

Examples:

Spend 10 hours outdoors
Walk during daylight for 20 days
Take a lunchtime walk 3 times per week
Goal Difficulty Structure

Every category can exist at 4 levels.

Level	Example Distance
Bronze	10 km
Silver	50 km
Gold	100 km
Platinum	500 km

This allows almost unlimited progression.

What I Think Will Be Most Popular

If I were ranking them:

Step Goals
Distance Goals
Streak Goals
Virtual Journey Challenges
Famous Climb Challenges
Walk Count Goals
Elevation Goals
Route Following Goals

The surprise winner may actually be Virtual Journey Challenges.

People understand:

"I've walked 247 km"

but they become emotionally invested in:

"I'm 247 km along my journey from Lands End to John O'Groats."

One More Category: Community Challenges

Not social networking, just shared objectives.

Examples:

Cornwall Walking Challenge 2027
Walk 50 km during National Walking Month
Summer Explorer Challenge

Everyone works toward the same target, but communication stays outside the platform.

That fits your desire to avoid turning Rambleio into another social network while still creating a sense of participation.

If we design the system correctly, virtually all of these goals can be represented by a single generic model:

{
  category: "elevation",
  metric: "elevationGain",
  target: 8849,
  unit: "metres",
  period: "lifetime",
  challenge: "Everest"
}

which means adding new challenges later becomes mostly a data-entry exercise rather than a development project.