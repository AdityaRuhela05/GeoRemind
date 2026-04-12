# GeoRemind 📍

A location-based reminder Android app built with React Native and Supabase. Set a reminder at any location on the map — when you physically enter that zone, your phone notifies you automatically.
 
**Platform:** Android  
**Status:** Phase 1 Complete

---

## The Problem

Ever walked past a shop and forgot to do something there? GeoRemind solves this — pin a location, set a radius, and get notified the moment you're nearby. No more forgetting your tasks.

---

## Features

- 📍 Pin any location on an interactive map
- 🔔 Automatic push notification when you enter the geofence radius
- 🗑️ Reminder auto-deletes after it triggers (no clutter)
- ✏️ Edit or delete reminders anytime
- 🔐 Secure auth — each user only sees their own reminders
- 📱 Works in background — even when app is closed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native (TypeScript) |
| Database + Auth | Supabase (PostgreSQL) |
| Maps | Google Maps SDK (react-native-maps) |
| Push Notifications | Notifee (local notifications) |
| Background Tasks | react-native-background-fetch |
| Navigation | React Navigation (Native Stack) |

---

## Architecture

```
User opens app
      ↓
Supabase Auth (JWT-based login/signup)
      ↓
HomeScreen — fetches reminders from Supabase
      ↓
Add Reminder — tap map to pin location + set radius
      ↓
Saved to Supabase (reminders table)
      ↓
Background task runs every 15 mins
      ↓
Haversine formula checks distance to each reminder
      ↓
Inside radius → Notifee notification + delete reminder
      ↓
DeviceEventEmitter → UI refreshes in real time
```

---

## How Geofencing Works

The app uses the **Haversine formula** to calculate the distance between the device's current GPS coordinates and each saved reminder's coordinates. When the distance drops below the set radius, the reminder triggers.

```typescript
function getDistanceInMetres(lat1, lon1, lat2, lon2): number {
  const R = 6371000; // Earth's radius in metres
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

Background checks run every **15 minutes** — the minimum interval allowed by Android/iOS to preserve battery life.

---

## Database Schema

**Table: `reminders`**

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key (auto-generated) |
| user_id | uuid | References auth.users |
| title | text | Reminder label e.g. "Laundry shop" |
| latitude | float8 | GPS latitude of pinned location |
| longitude | float8 | GPS longitude of pinned location |
| radius | int4 | Geofence radius in metres (10–40m) |
| is_active | bool | True until triggered |
| created_at | timestamptz | Creation timestamp |

**Row Level Security:** All four operations (SELECT, INSERT, UPDATE, DELETE) are protected by RLS policies that check `auth.uid() = user_id`. Users can only access their own data.

---

## Project Structure

```
GeoRemind/
├── src/
│   ├── lib/
│   │   └── supabase.ts          ← Supabase client
│   ├── screens/
│   │   ├── LoginScreen.tsx      ← Login/Signup UI
│   │   ├── HomeScreen.tsx       ← Reminders list
│   │   └── AddReminderScreen.tsx ← Add/Edit reminder with map
│   └── utils/
│       └── geofencing.ts        ← Haversine + background fetch logic
├── android/
│   └── app/
│       └── src/main/
│           └── AndroidManifest.xml
├── App.tsx                      ← Entry point + navigation
├── patches/                     ← patch-package fixes
└── README.md
```

---

## Setup Instructions

### Prerequisites

- Node.js v20+
- Java JDK 17 (not 21)
- Android Studio + Android SDK
- A Supabase project
- A Google Maps API key (Maps SDK for Android)

### Installation

```bash
# Clone the repo
git clone https://github.com/AdityaRuhela05/GeoRemind.git
cd GeoRemind

# Install dependencies (patch-package auto-applies fixes)
npm install

# Add your credentials
# 1. Edit src/lib/supabase.ts → add your Supabase URL and anon key
# 2. Edit android/app/src/main/AndroidManifest.xml → add your Google Maps API key

# Run on Android
npx react-native run-android
```

### Environment Variables

Create `src/lib/supabase.ts` with:
```typescript
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
```

Add to `AndroidManifest.xml`:
```xml
<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="YOUR_GOOGLE_MAPS_API_KEY"
/>
```

---

## Known Fixes Applied

This project uses `patch-package` to fix a bug in `react-native-screens@3.29.0` where a nullable `StateWrapper?` type caused compilation failure with React Native 0.76.

The patch is in `patches/react-native-screens+3.29.0.patch` and auto-applies on `npm install` via the `postinstall` script.

---

## Roadmap

- **Phase 1** ✅ — Core geofencing reminder app
- **Phase 2** — Repeat reminders, time + location combo triggers, battery optimisation
- **Phase 3** — Friend proximity reminders (notify when a friend is nearby)
- **Phase 4** — Play Store release, production APK

---

## What I Learned

- React Native project setup, navigation, and TypeScript
- Supabase authentication with JWT session persistence
- PostgreSQL Row Level Security for per-user data isolation
- The Haversine formula for GPS distance calculation
- Android background task scheduling and battery constraints
- patch-package for fixing third-party library bugs
- Native Android build system (Gradle, NDK, Kotlin compatibility)

---

## License

MIT