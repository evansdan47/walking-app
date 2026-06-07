# Rambleio Walk Tagging System

## Purpose

The tagging system provides a structured way to describe both planned routes and completed walks.

The goals are:

* Help walkers quickly understand what a route is like.
* Improve route discovery through filtering and search.
* Capture local knowledge from real walkers.
* Build a living database of route characteristics and conditions.
* Create a meaningful way for users to contribute to the platform.

Tags may be attached to:

* Planned routes
* Recorded walks
* Follow sessions

The system should support both objective route characteristics and subjective community feedback.

---

# Design Principles

## Controlled Vocabulary

Users cannot create arbitrary tags.

All tags are selected from a predefined taxonomy maintained by Rambleio.

This prevents:

* Duplicate meanings
* Spelling variations
* Fragmented filtering

Example:

Good:

* Coastal

Bad:

* Coast
* Seaside
* By the sea
* Ocean walk

---

## Community Driven

Walkers contribute information by tagging completed walks.

These contributions are aggregated to build confidence scores for routes.

Example:

Route Characteristics

* Dog Friendly (confirmed by 42 walkers)
* Great Views (confirmed by 67 walkers)
* Parking Available (confirmed by 31 walkers)

Individual walk tags do not directly modify route tags.

Instead they contribute evidence toward route-level characteristics.

---

## Objective vs Subjective Tags

### Objective Tags

These describe facts about a route.

Examples:

* Coastal
* Woodland
* Circular
* Mountain
* Parking
* Toilets

Objective tags may be:

* Automatically generated
* Added by route creators
* Confirmed by walkers

---

### Subjective Tags

These describe opinions or experiences.

Examples:

* Great Views
* Peaceful
* Family Friendly
* Dog Friendly

These should be derived primarily from community consensus.

---

## Seasonal and Time-Sensitive Tags

Some characteristics vary throughout the year.

Examples:

* Muddy
* Overgrown
* Bluebells
* Autumn Colours
* Flood Risk

These tags should record:

* Date reported
* Season
* Number of confirmations

This allows the route description to adapt over time.

Example:

Muddy Conditions

* Frequently reported during Winter
* Last reported 2 weeks ago

Bluebells

* Frequently reported during April and May

The system should favour recent reports over older reports when displaying seasonal information.

---

# Tag Categories

## Landscape

Describes the surrounding environment.

Examples:

* Coastal
* Beach
* Woodland
* Forest
* River
* Canal
* Lake
* Reservoir
* Moorland
* Heathland
* Wetland
* Countryside
* Valley
* Mountain
* Urban
* Village
* Parkland

---

## Terrain

Describes physical terrain and effort.

Examples:

* Flat
* Gentle Rolling
* Hilly
* Steep
* Mountainous
* Rocky
* Sandy
* Boggy
* Muddy
* Uneven
* Scrambling

---

## Path Type

Examples:

* Footpath
* Bridleway
* Gravel Track
* Farm Track
* Dirt Trail
* Paved
* Boardwalk
* Beach Walking
* No Defined Path

---

## Route Style

Examples:

* Circular
* Out and Back
* Point to Point
* Figure of Eight
* Linear

---

## Difficulty

Examples:

* Easy
* Moderate
* Hard
* Challenging
* Expert

Many difficulty indicators may be automatically calculated from route statistics.

---

## Facilities

Examples:

* Parking
* Free Parking
* Paid Parking
* Toilets
* Café
* Pub
* Visitor Centre
* Shop
* Water Refill
* Picnic Area
* Public Transport

---

## Features

Examples:

* Great Views
* Waterfall
* Historic Site
* Castle
* Lighthouse
* Bridge
* Nature Reserve
* Wildlife
* Photography Spot
* Wild Swimming

---

## Accessibility

Examples:

* Wheelchair Friendly
* Pushchair Friendly
* Child Friendly
* Accessible Gates
* Step Free

---

## Dog Friendly

Examples:

* Dog Friendly
* Dogs On Lead
* Off Lead Suitable
* Livestock Present
* Water Available

---

## Seasonal

Examples:

* Bluebells
* Autumn Colours
* Winter Friendly
* Spring Flowers

---

## Hazards

Examples:

* Exposed Cliffs
* Steep Drops
* River Crossing
* Flood Risk
* Road Sections
* Scrambling Required
* Tidal Route

---

# Community Confirmation System

When a walker completes a route, they may contribute additional information.

Examples:

* Great Views
* Dog Friendly
* Parking Available

Each contribution increases the confidence score of the corresponding route characteristic.

Example:

Great Views

* Confirmed by 67 walkers

Parking

* Confirmed by 31 walkers

Dog Friendly

* Confirmed by 42 walkers

This creates a living route knowledge system rather than a static route description.

---

# Automatic Tag Detection

Where possible, Rambleio should automatically suggest tags.

Examples:

Automatically detected:

* Circular
* Point to Point
* Coastal
* Flat
* Hilly
* Mountainous
* Difficulty
* Distance bands
* Elevation bands

Users then confirm, remove or add additional tags.

The goal is to minimise manual effort.

---

# Experimental Tagging Interfaces

The final tagging UI will be selected after testing.

Two approaches will be trialled.

---

## Experiment A — Category Tag Browser

This approach exposes the tagging system directly.

Users browse categories and select tags using chips.

Example:

Landscape

[ Coastal ]
[ Woodland ]
[ River ]
[ Moorland ]

Terrain

[ Flat ]
[ Hilly ]
[ Mountainous ]

Facilities

[ Parking ]
[ Toilets ]
[ Café ]

Features

[ Great Views ]
[ Waterfall ]
[ Historic Site ]

### Advantages

* Full control.
* Easy to understand.
* Supports large tag libraries.
* Good for power users.

### Risks

* Can feel like data entry.
* Higher cognitive load.
* Some users may skip tagging entirely.

---

## Experiment B — Smart Confirmation

This approach relies heavily on automatic tag detection.

After a walk completes, Rambleio presents its assumptions.

Example:

We've identified:

✓ Coastal

✓ Circular

✓ Hilly

Does this look correct?

[ Confirm ]

Anything else worth mentioning?

[ Great Views ]
[ Dog Friendly ]
[ Parking ]
[ Wildlife ]
[ Muddy ]

Users mostly confirm and optionally add a few extra observations.

### Advantages

* Extremely fast.
* Low friction.
* Likely higher completion rate.
* Encourages participation.

### Risks

* Less discoverable.
* Users may overlook available tags.
* More reliance on automatic detection quality.

---
Experiment C — Walk Questionnaire

Instead of presenting tags, present a short review questionnaire.

The user never sees the tagging system.

Their answers are mapped internally to tags.

Example Flow
Question 1
What best describes the landscape?

○ Coastal
○ Woodland
○ Countryside
○ Mountain
○ Urban
○ Mixed
Question 2
How challenging was the walk?

○ Very Easy
○ Easy
○ Moderate
○ Hard
○ Challenging
Question 3
How were the views?

○ Poor
○ Average
○ Good
○ Excellent

Maps to:

Good Views
Excellent Views
Question 4
Were there any facilities available?

☑ Parking
☑ Toilets
☑ Café
☐ Pub
☐ Visitor Centre
Question 5
How easy was the route to follow?

○ Very Easy
○ Easy
○ Moderate
○ Difficult
○ Very Difficult

Maps to:

Well Signposted
Easy Navigation
Navigation Required
Question 6
Which of these applied today?

☑ Muddy
☐ Flooded
☐ Overgrown
☐ Livestock Present
☐ Path Closure
Question 7
Would you recommend this walk to others?

○ Definitely
○ Probably
○ Maybe
○ Probably Not
○ No

This doesn't become a tag but provides useful route-quality metrics.

Advantages
Feels Natural

People are used to reviews and surveys.

They are not necessarily comfortable with tagging.

Better Data Quality

You can guide users to answer the questions that matter most.

You avoid:

Tag spam
Missing important tags
Inconsistent tagging
Easier Future Expansion

New questions can be added without changing the tagging system.

Example:

Did you see bluebells?

○ Yes
○ No

Internally maps to:

Bluebells
Risks
Longer Interaction

Questionnaires can feel more time consuming.

Users May Abandon Halfway

A 10-question survey is more intimidating than selecting a few chips.

Less Discoverability

Users don't see the richness of the underlying tag system.

Comparison
Metric	A: Tag Browser	B: Smart Confirmation	C: Questionnaire
User Effort	High	Very Low	Medium
Richness of Data	High	Medium	High
Completion Rate	Medium	High	Medium
Discoverability	High	Medium	Low
Casual Walker Friendly	Medium	High	High
Power User Friendly	High	Medium	Medium
Seasonal Reporting	Medium	Medium	Excellent