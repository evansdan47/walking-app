reviewing is much more straightforward than recording.

From a product and technical point of view, the **reviewing layer** is where the raw captured walk becomes something useful and satisfying. Recording is about durability and correctness under messy real-world conditions; reviewing is about turning that data into a clean, understandable representation of the walk.

The core technical idea is simple: a completed walk is reconstructed from its stored points and events. You already have the breadcrumbs — timestamped coordinates, plus optional altitude, speed, and photos. Reviewing is the process of loading that stored data, rebuilding the route, calculating or displaying summary metrics, and presenting it in a way that feels coherent to the user.

The first important design choice is that **reviewing should operate on completed or snapshot data, not on a live recording stream**. That keeps it much simpler. A walk should be treated as a stable object once stopped, even if some background sync or summary calculation happens a little later. In practice, this means the user opens a saved walk and the app loads:

* the walk metadata
* the ordered track points
* any attached photo events
* any derived stats already computed

That separation is valuable because review screens should be fast and deterministic. They are not the place to be doing fragile real-time logic.

The second key insight is that **reviewing is really two layers**:

* a **data preparation layer**
* a **presentation layer**

The data preparation layer takes raw points and turns them into a usable route and usable summaries. The presentation layer shows that route on a map, displays the numbers, and lets the user browse photos and timing.

That distinction matters because raw GPS data is often ugly. If you render every single raw point with no cleanup, the route can look messy, especially at pauses, near walls, or in wooded areas. So before review, or the first time a walk is opened, you will usually want some light post-processing:

* sort points by timestamp
* remove obviously bad outliers
* ignore duplicate or near-duplicate stationary jitter
* optionally smooth very small oscillations
* generate a route polyline from the cleaned points

This does not need to be sophisticated in the MVP, but it matters a lot to perceived quality. A walk that looks tidy and believable will feel much more valuable to the user than one that appears to zig-zag around every gatepost.

A very important technical principle is that **you should preserve the raw points even if you generate a cleaned route for display**. The reviewed walk can use a cleaned polyline, but the original recorded data should remain intact. That gives you freedom later to improve your review logic or recalculate summaries without losing source data.

For reviewing, the route itself is usually best represented in two forms:

* the original list of track points
* a derived polyline for display

The point list is useful for timeline reconstruction, photo placement, and deeper analysis. The polyline is useful for drawing the route quickly on the map. This becomes especially helpful on the web, where you may not want to send thousands of raw points to the browser if a simpler route representation will do.

The third major area is **summary statistics**. Reviewing is where users expect the walk to “make sense” as a single activity. That means showing:

* total distance
* elapsed duration
* moving time
* stopped time
* average speed or pace
* ascent/descent if available

A crucial point here is that these metrics should not all be treated as equally reliable. Distance and elapsed time are usually straightforward. Moving time and stopped time depend on your filtering logic. Elevation gain can be noisy unless smoothed. So from an appraisal standpoint, the reviewing subsystem is partly a statistics engine, and you should be cautious not to overclaim precision where the underlying data is fuzzy.

Distance is normally computed by summing the segment lengths between consecutive accepted points. That is simple and effective, but the quality depends on point filtering. If you include jitter while stationary, distance gets inflated. So the review layer is where you recover accuracy by applying sensible cleanup.

Moving time is similar. If the user manually paused the walk, that is easy. But if they simply stood still without pausing, you may want to infer stopped time from clusters of points with minimal movement over a period. This is not hard, but it is a policy choice. You are deciding what “counts” as movement. Reviewing is the place that policy becomes visible.

Photos fit very naturally into the review experience if you think of them as **timestamped route events**. They should not just appear in a gallery detached from the walk. The better model is:

* each photo belongs to the walk
* each photo has a timestamp
* each photo is attached to a recorded location or nearest point on the route

That lets the review UI place photos along the map or within a timeline. Technically, this is quite clean because it reuses the walk’s time axis. Once you have that, you can support a very simple but effective review experience: tap a photo and jump to that point on the route, or tap a point on the route and see nearby photos.

One of the strongest product choices you have already made is that **maps are only needed for reviewing, not for recording**. That is a real simplification. It means your map rendering layer can be entirely downstream of walk storage. The app can record walks perfectly well without any map dependency, and then the review screen becomes the first place where a map SDK is required.

That makes the review subsystem easier to isolate:

* map loads only when opening a saved walk
* route overlay is drawn from stored data
* photos and markers are layered on top
* everything else is just presentation logic

This is a good MVP boundary.

From a UX standpoint, reviewing on mobile and reviewing on the website should probably use the same underlying data but not necessarily the same density of interface. On mobile, the review screen should be compact:

* route map
* stats summary
* photo strip or timeline
* maybe start/end markers

On the website, you can afford a richer view:

* larger map
* bigger elevation or route detail later
* easier browsing of photos and metadata

But technically both should come from the same core model: one walk, one route, one timeline of events.

Another useful technical distinction is **local review versus synced review**. Since your app is offline-first, the review layer should be able to render a walk directly from local storage before sync. That means the mobile review screen must not depend on the backend. If the walk has synced, great — load from server or merged cache. If not, the user should still be able to open the walk and see:

* their route
* their stats
* their photos

That is a very important MVP quality point. Reviewing should feel immediate, not like something that only becomes available later when the network returns.

For the website, the flow is slightly different. The website is naturally reviewing synced data, so you can assume the walk has already been uploaded. That means the backend review representation becomes important. I would not necessarily send every raw point to the web client if the walk is long. Instead, I would consider storing a review-friendly version alongside the raw track:

* simplified polyline
* summary stats
* photo metadata
* optional reduced point set if needed

That keeps the web experience fast and clean.

One subtle but important challenge in review is **route simplification versus fidelity**. If you have many points, drawing them all is sometimes unnecessary. A simplified line can render faster and still look identical at walking-map zoom levels. The risk is oversimplifying and making the route cut corners or lose shape. For MVP, you do not need anything clever — just be aware that long walks may eventually benefit from storing a display polyline separately from raw points.

Another important appraisal point is that **reviewing is where trust is built visually**. Users will tolerate some recording imperfections if the reviewed walk looks plausible, the numbers feel sensible, and the photos appear in the right place. They will lose trust quickly if:

* the route has obvious spikes or jumps
* distance feels clearly wrong
* photos appear detached from the walk
* pauses are misrepresented as movement

So the review subsystem is not merely a viewer. It is the layer that turns noisy sensor output into a believable personal record.

There is also a privacy angle, even in MVP. When reviewing a walk that may later be shared, you should think about whether the visible route reveals exact start/end points near a home or accommodation. You said not to bring in extra features, so I will keep this brief: even a bare-bones review model should keep in mind that the reviewed route may later become public, so the route data structure should make it possible to hide or trim segments later if needed. You do not need to solve it now, but you should not paint yourself into a corner.

If I were appraising the review subsystem overall, I would say it is technically low risk and high value. It is much easier than recording because it works on stored data rather than unstable live conditions. The main challenges are not platform restrictions but data quality, cleanup, and presentation decisions.

For MVP, I would define reviewing as this:
a completed walk can be opened on mobile or web, reconstructed from its saved points, rendered as a route on a map, displayed with a small set of key stats, and enriched with any photos linked by time and location.

That is enough to feel complete.

My practical recommendation would be:
store raw track points locally and on the backend, generate a cleaned display route, compute the basic stats once the walk is stopped, treat photos as timeline events, and make the review screen load from local data first and synced data second.

That gives you a review system that is simple, reliable, and strong enough for the MVP.