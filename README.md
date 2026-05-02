# GeoRemind 📍

> A location-based reminder app for Android. Pin a spot on the map, set a radius — get notified the moment you walk into that zone.

**Platform:** Android  
**Stack:** React Native (TypeScript) + Supabase + Expo Location + Notifee  
**Status:** ✅ Fully Working — Background triggering, persistent foreground service, one-shot reminders

---

## The Problem

Ever walked past a shop and forgot to pick something up? Or arrived home and forgot to text someone? GeoRemind solves exactly that — pin any location, write a reminder, and forget about it. Your phone notifies you automatically when you physically arrive there.

---

## Features

| Feature | Details |
|---|---|
| 📍 Pin any location | Tap anywhere on the interactive Google Maps view |
| 🔔 Auto notification | Triggers when you physically enter the geofence radius |
| 🗑️ One-shot reminders | Auto-deleted from Supabase after triggering — no clutter |
| ✏️ Edit anytime | Modify title, location, or radius before it triggers |
| 🔐 Secure per-user data | Supabase RLS ensures users only see their own reminders |
| 📱 True background support | Works even when the app is fully closed (foreground service) |
| 🔄 Real-time UI refresh | `DeviceEventEmitter` updates the list instantly on trigger |
| 💾 Offline-safe cache | `AsyncStorage` lets the background task work without network auth |

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Mobile Framework | React Native (TypeScript) | 0.76.9 |
| UI Runtime | Expo (modules only, not managed workflow) | ~52.0.0 |
| Database + Auth | Supabase (PostgreSQL + JWT) | ^2.39.0 |
| Maps | Google Maps SDK via `react-native-maps` | ^1.14.0 |
| Push Notifications | Notifee (local) | ^8.0.0 |
| Background Location | `expo-location` + `expo-task-manager` | ~17.0.1 / ~12.0.3 |
| Local Cache | `@react-native-async-storage/async-storage` | ^1.23.1 |
| Navigation | React Navigation Native Stack | ^6.x |
| Push (FCM) | Firebase Messaging via `@react-native-firebase` | ^18.9.0 |

---

## Architecture

```
User opens app
      ↓
Supabase Auth (JWT session — persisted across restarts)
      ↓
App.tsx — calls initGeofencing() after session is confirmed
      ↓
Permissions requested: Foreground + Background Location, POST_NOTIFICATIONS
      ↓
Reminders fetched from Supabase → cached in AsyncStorage
      ↓
expo-location starts a Foreground Service (location polling every 15s)
      ↓
Background task (GEOFENCE_LOCATION_TASK) wakes on each location update
      ↓
Reads reminders from AsyncStorage (no network/auth needed in background)
      ↓
Haversine formula checks distance to each reminder
      ↓
Inside radius?
  → Notifee notification shown
  → Reminder removed from AsyncStorage immediately (no re-fire)
  → Marked in TRIGGERED_IDS_KEY guard
  → Deleted from Supabase (supabase-js works in background JS)
  → DeviceEventEmitter fires → HomeScreen removes it from UI instantly
```

---

## How Geofencing Works

The app uses the **Haversine formula** to calculate the straight-line GPS distance between the device's current coordinates and each saved reminder's pinned location. When the distance drops below the configured radius, the reminder triggers.

```typescript
function getDistanceInMetres(lat1, lon1, lat2, lon2): number {
  const R = 6371000; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

### Why AsyncStorage Instead of Direct Supabase Calls in the Background?

Android kills the app's authenticated context when it wakes a background task. Calling Supabase directly in the background task would fail silently (no valid auth session). The solution:

1. **On foreground:** fetch reminders from Supabase → write to `AsyncStorage`
2. **In background:** read from `AsyncStorage` only — fast, offline, no auth needed
3. **On trigger:** delete from Supabase immediately (Supabase JS client still works for simple network requests even in background)

### Double-Trigger Prevention

A second key (`GeoRemind:triggeredIds`) acts as a guard set. When a reminder is triggered:
- Its ID is added to the guard immediately
- The background task skips any reminder whose ID is in the guard
- Once Supabase deletion succeeds, the ID is cleared from the guard

This prevents a race condition where a cache refresh before Supabase deletion would re-add the reminder and re-trigger it.

---

## Database Schema

**Table: `reminders`**

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key (auto-generated) |
| `user_id` | `uuid` | References `auth.users` |
| `title` | `text` | Reminder label e.g. "Pick up groceries" |
| `latitude` | `float8` | GPS latitude of pinned location |
| `longitude` | `float8` | GPS longitude of pinned location |
| `radius` | `int4` | Geofence radius in metres (10–500m) |
| `is_active` | `bool` | `true` until triggered |
| `created_at` | `timestamptz` | Auto-set on insert |

**Row Level Security (RLS):** All four operations (SELECT, INSERT, UPDATE, DELETE) are locked by RLS policies using `auth.uid() = user_id`. Users can only ever access their own data.

---

## Project Structure

```
GeoRemind/
├── index.js                     ← App entry point — imports geofencing FIRST
│                                  (TaskManager.defineTask must run before any component)
├── App.tsx                      ← Navigation + Supabase session + calls initGeofencing()
├── app.json                     ← App name config
├── babel.config.js              ← Babel + expo preset
├── metro.config.js              ← Metro bundler config
├── patches/
│   └── react-native-screens+3.29.0.patch  ← Auto-applied fix for nullable StateWrapper
├── src/
│   ├── lib/
│   │   └── supabase.ts          ← Supabase client (URL + anon key)
│   ├── screens/
│   │   ├── LoginScreen.tsx      ← Email/password login + signup UI
│   │   ├── HomeScreen.tsx       ← Reminder list, delete, logout, real-time refresh
│   │   └── AddReminderScreen.tsx ← Map pin UI + add/edit reminder form
│   └── utils/
│       └── geofencing.ts        ← All geofencing logic:
│                                   - TaskManager task definition
│                                   - Haversine distance check
│                                   - initGeofencing() / stopGeofencing()
│                                   - syncRemindersCache()
│                                   - Notifee notification helpers
└── android/
    ├── build.gradle             ← minSdkVersion=24, compileSdk=35, targetSdk=34
    └── app/
        └── build.gradle         ← App config, signing, Firebase plugin
```

---

## Android Permissions Required

Declared in `AndroidManifest.xml`:

| Permission | Why |
|---|---|
| `ACCESS_FINE_LOCATION` | GPS precision for geofencing |
| `ACCESS_COARSE_LOCATION` | Fallback location |
| `ACCESS_BACKGROUND_LOCATION` | Location access when app is not in foreground |
| `FOREGROUND_SERVICE` | Required to run a persistent background service |
| `FOREGROUND_SERVICE_LOCATION` | Android 14+ — explicitly typed foreground service |
| `POST_NOTIFICATIONS` | Android 13+ — required to show any notification |
| `RECEIVE_BOOT_COMPLETED` | Re-register tasks after device reboot |

---

## Setup Instructions

### Prerequisites

- Node.js ≥ 18
- Java JDK 17 (**not** 21 — React Native 0.76 is incompatible with JDK 21)
- Android Studio with Android SDK (API 35)
- A [Supabase](https://supabase.com) project
- A [Google Maps API key](https://console.cloud.google.com) with **Maps SDK for Android** enabled
- A Firebase project (for FCM push — `google-services.json`)

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/AdityaRuhela05/GeoRemind.git
cd GeoRemind

# 2. Install dependencies (patch-package runs automatically via postinstall)
npm install

# 3. Add credentials (see below)

# 4. Run on a connected Android device or emulator
npx react-native run-android
```

### Credentials Setup

**Supabase** — edit `src/lib/supabase.ts`:
```typescript
const supabaseUrl = 'YOUR_SUPABASE_PROJECT_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
```

**Google Maps API key** — add to `android/gradle.properties`:
```properties
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

The key is injected into `AndroidManifest.xml` via `manifestPlaceholders` — no hardcoding.

**Firebase** — drop your `google-services.json` into `android/app/`.

### Release Signing

Add to `android/gradle.properties`:
```properties
MYAPP_UPLOAD_STORE_FILE=my-release-key.keystore
MYAPP_UPLOAD_STORE_PASSWORD=your_store_password
MYAPP_UPLOAD_KEY_ALIAS=your_key_alias
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```

Build a release APK:
```bash
cd android && ./gradlew assembleRelease
```

 ---

<!--## Known Fixes Applied

### `react-native-screens` patch (auto-applied)

`react-native-screens@3.29.0` fails to compile with React Native 0.76 because of a non-nullable `StateWrapper` type mismatch with Kotlin. A patch in `patches/react-native-screens+3.29.0.patch` fixes this and is applied automatically via the `postinstall` script in `package.json`.

### Android 13 (API 33) Notification Permission

`notifee.requestPermission()` doesn't always trigger the OS dialog on API 33. The `initGeofencing()` function explicitly calls `PermissionsAndroid.request(POST_NOTIFICATIONS)` for Android 13+ as a fallback.

### Android 13 Foreground Service Crash

On some Android 13 devices, `Location.startLocationUpdatesAsync()` crashes if `FOREGROUND_SERVICE_LOCATION` permission hasn't been granted. `initGeofencing()` uses a try/catch with a graceful fallback — it retries without the `foregroundService` option so monitoring continues in foreground-only mode.

### `minSdkVersion` Set to 24

Raised from the default 23 to 24 (Android 7.0) to ensure compatibility with `expo-location`'s background location requirements and Notifee's notification channel APIs.

### Background Task Must Register at Entry Point

`expo-task-manager` requires that `TaskManager.defineTask()` runs before any React component mounts. This is why `src/utils/geofencing.ts` is imported at the **top** of `index.js` — the OS wakes `index.js` directly when triggering background tasks, and the task definition must already be registered by then.

--- -->

## Roadmap

- **Phase 1** ✅ — Core geofencing, auth, background triggering, one-shot reminders
- **Phase 2** 🔜 — Repeat reminders, time + location combo triggers, battery usage display
- **Phase 3** — Play Store release, production APK, CI/CD pipeline

---

<!-- ## What I Learned

- React Native project setup from scratch with TypeScript
- Supabase authentication, JWT session persistence across app restarts
- PostgreSQL Row Level Security for per-user data isolation
- Implementing the Haversine formula for GPS distance calculation
- Android background task scheduling with `expo-task-manager` and why tasks must be registered at the entry point
- Why Supabase auth doesn't work in background tasks — and how to solve it with `AsyncStorage` caching
- Double-trigger prevention with a guard set in `AsyncStorage`
- Notifee foreground service notifications and notification channels
- Android permissions model for API 33+ (POST_NOTIFICATIONS, FOREGROUND_SERVICE_LOCATION)
- Android version compatibility debugging (minSdkVersion, compileSdkVersion, foreground service crashes)
- `patch-package` for fixing third-party library bugs without forking
- Native Android build system — Gradle, NDK, Kotlin, signing configs

--- -->

## License

MIT