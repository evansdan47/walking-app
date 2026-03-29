**App Summary**

A mobile app for recording, reviewing, and following walking routes.

Users can track their walks using GPS, storing a path made up of timestamped location points. Walks can be reviewed later with key stats and optional photos placed along the route. Recorded walks can also be followed again, with simple alerts if the user strays off the original path.

The app is designed to work reliably in areas with poor signal by storing data locally and syncing when a connection is available.


# Walking App MVP – Technical Overview

## 1. Recording a Walk

The mobile app records a walk as a sequence of timestamped location points, stored locally on the device.

### Core behaviour

* User starts a walk recording session.
* App subscribes to background location updates.
* Location data is captured while:

  * app is open
  * app is in background
  * device is locked
* Recording stops if the user manually stops it or force-closes the app.

### Data captured per point

* timestamp
* latitude / longitude
* optional altitude
* optional speed
* accuracy

### Storage

* All data is written **locally first** (e.g. SQLite or file storage).
* Walk remains fully usable offline.
* Walk is marked for sync when complete.

### Photos

* Photos taken inside the app during recording are:

  * saved locally
  * timestamped
  * linked to the walk
  * assigned a location (current or nearest track point)

### Derived data (post-processing)

Calculated after recording ends:

* total distance
* total duration
* moving time vs stopped time
* average pace/speed
* elevation gain/loss (if data available)

### Sync

* When connectivity is available:

  * walk data and photos are uploaded
  * walk becomes available on the web and for sharing

---

## 2. Reviewing a Walk

The user can view completed walks on mobile or web.

### Map rendering

* The recorded route is reconstructed by connecting stored location points.
* Map is only required at this stage (not during recording).

### Displayed information

* route path on map
* total distance
* total time
* pace/speed
* elevation (if available)

### Photos

* Photos are displayed along the route:

  * positioned using timestamp/location
  * selectable from the map or timeline

### Data source

* If synced: data is loaded from backend
* If not synced: data is loaded from local storage

---

## 3. Following a Walk

The user can follow a previously recorded route.

### Route source

* A route is derived from a recorded walk (polyline of points).

### Tracking

* App tracks current user location during the session.
* Location updates are compared to the route.

### Deviation detection

* Compute distance from current location to nearest point on route.
* If distance exceeds threshold for a short duration:

  * trigger alert (vibration or sound)

### Guidance (minimal MVP)

* No turn-by-turn navigation
* Basic feedback only:

  * “on route” / “off route”
  * optional distance back to route

### Offline support

* Route data is available locally.
* Location tracking works without network.
* Map rendering optional (can be added when available).

---

# Summary

* **Recording** is offline-first and location-driven.
* **Reviewing** reconstructs the walk from stored points and displays it on a map.
* **Following** compares live location against a stored route and alerts on deviation.

No external services are required during recording or following. Sync and map rendering are only needed for review and sharing.
