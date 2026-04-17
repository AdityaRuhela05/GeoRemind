import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import notifee, { AndroidImportance, AuthorizationStatus } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, Platform, PermissionsAndroid } from 'react-native';
import { supabase } from '../lib/supabase';

const GEOFENCE_TASK = 'GEOFENCE_LOCATION_TASK';
const LOCATION_INTERVAL_MS = 15000; // 15s for testing, change to 30000 in prod

// AsyncStorage keys — background task reads these instead of calling Supabase
const REMINDERS_CACHE_KEY = 'GeoRemind:reminders';
// IDs of reminders that have been triggered but not yet confirmed deleted from Supabase.
// This prevents re-triggering if the cache gets re-synced before the delete commits.
const TRIGGERED_IDS_KEY = 'GeoRemind:triggeredIds';

export type Reminder = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  radius: number;
  is_active: boolean;
};

// ---------------------------------------------------------------------------
// Haversine distance formula
// ---------------------------------------------------------------------------
function getDistanceInMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------
async function ensureChannel(): Promise<string> {
  return notifee.createChannel({
    id: 'georemind',
    name: 'GeoRemind Alerts',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

async function ensureMonitoringChannel(): Promise<string> {
  return notifee.createChannel({
    id: 'georemind-monitoring',
    name: 'GeoRemind Status',
    importance: AndroidImportance.LOW, // silent persistent notification
  });
}

async function showTriggerNotification(title: string) {
  const channelId = await ensureChannel();
  await notifee.displayNotification({
    title: '📍 GeoRemind',
    body: `You're near: ${title}`,
    android: {
      channelId,
      importance: AndroidImportance.HIGH,
      sound: 'default',
      pressAction: { id: 'default' },
    },
  });
}

// Shows/updates a persistent silent notification so the user can see GeoRemind
// is actively monitoring. Uses a fixed notificationId so it updates in-place.
export async function showPersistentNotification() {
  const channelId = await ensureMonitoringChannel();
  await notifee.displayNotification({
    id: 'georemind-status', // fixed ID = updates in-place, won't stack
    title: '📍 GeoRemind is active',
    body: 'Monitoring your location reminders in the background.',
    android: {
      channelId,
      importance: AndroidImportance.LOW,
      ongoing: true,       // cannot be dismissed by user swipe
      asForegroundService: false,
      pressAction: { id: 'default' },
    },
  });
}

// ---------------------------------------------------------------------------
// Background task
// Reads reminders from AsyncStorage — avoids auth issues in background.
// Deletes triggered reminders from Supabase immediately to prevent re-fires.
// ---------------------------------------------------------------------------
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
  if (error) {
    console.log('[GeoRemind] Task error:', error.message);
    return;
  }
  if (!data?.locations?.[0]) return;

  const { latitude, longitude } = data.locations[0].coords;
  console.log(`[GeoRemind] Location update: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);

  try {
    // Read reminders from local cache — no network, no auth
    const raw = await AsyncStorage.getItem(REMINDERS_CACHE_KEY);
    const reminders: Reminder[] = raw ? JSON.parse(raw) : [];

    if (reminders.length === 0) {
      console.log('[GeoRemind] No cached reminders — skipping check');
      return;
    }

    // Read the set of already-triggered IDs (guard against re-fires during deletion)
    const triggeredRaw = await AsyncStorage.getItem(TRIGGERED_IDS_KEY);
    const alreadyTriggered: string[] = triggeredRaw ? JSON.parse(triggeredRaw) : [];

    const newlyTriggered: string[] = [];

    for (const reminder of reminders) {
      // Skip if already triggered but not yet removed from Supabase
      if (alreadyTriggered.includes(reminder.id)) {
        console.log(`[GeoRemind] Skipping already-triggered: "${reminder.title}"`);
        continue;
      }

      const distance = getDistanceInMetres(
        latitude, longitude,
        reminder.latitude, reminder.longitude
      );
      console.log(`[GeoRemind] "${reminder.title}": ${distance.toFixed(0)}m (radius: ${reminder.radius}m)`);

      if (distance <= reminder.radius) {
        await showTriggerNotification(reminder.title);
        newlyTriggered.push(reminder.id);
        console.log(`[GeoRemind] Triggered: "${reminder.title}"`);
      }
    }

    if (newlyTriggered.length === 0) return;

    // 1. Remove triggered reminders from local cache immediately so they don't re-fire
    const remaining = reminders.filter(r => !newlyTriggered.includes(r.id));
    await AsyncStorage.setItem(REMINDERS_CACHE_KEY, JSON.stringify(remaining));

    // 2. Mark them as triggered so if cache is refreshed before Supabase delete, they won't re-fire
    await AsyncStorage.setItem(
      TRIGGERED_IDS_KEY,
      JSON.stringify([...alreadyTriggered, ...newlyTriggered])
    );

    // 3. Delete from Supabase immediately (supabase-js works in background JS context)
    for (const id of newlyTriggered) {
      const { error: delError } = await supabase.from('reminders').delete().eq('id', id);
      if (delError) {
        console.log(`[GeoRemind] Supabase delete failed for ${id}:`, delError.message);
      } else {
        console.log(`[GeoRemind] Deleted from Supabase: ${id}`);
        // Clear from triggered guard now that it's fully deleted
        const updatedTriggered: string[] = (JSON.parse(
          (await AsyncStorage.getItem(TRIGGERED_IDS_KEY)) ?? '[]'
        )).filter((tid: string) => tid !== id);
        await AsyncStorage.setItem(TRIGGERED_IDS_KEY, JSON.stringify(updatedTriggered));
      }
    }

    // 4. Notify the foreground app to remove these from UI (pass IDs so it can do a local removal)
    try {
      DeviceEventEmitter.emit('GEOFENCE_TRIGGERED', { triggeredIds: newlyTriggered });
    } catch (_) {}

  } catch (e: any) {
    console.log('[GeoRemind] Background task exception:', e?.message);
  }
});

// ---------------------------------------------------------------------------
// Persist current reminders to AsyncStorage so background task can read them.
// Skips any reminders that are currently in the triggered-guard set.
// Call this whenever the reminder list changes.
// ---------------------------------------------------------------------------
export async function syncRemindersCache(reminders: Reminder[]) {
  // Filter out any reminders that are mid-deletion to avoid re-adding them
  const triggeredRaw = await AsyncStorage.getItem(TRIGGERED_IDS_KEY);
  const alreadyTriggered: string[] = triggeredRaw ? JSON.parse(triggeredRaw) : [];
  const safe = reminders.filter(r => !alreadyTriggered.includes(r.id));
  await AsyncStorage.setItem(REMINDERS_CACHE_KEY, JSON.stringify(safe));
  console.log('[GeoRemind] Cache updated —', safe.length, 'reminders');
}

// ---------------------------------------------------------------------------
// initGeofencing — call once after login
// ---------------------------------------------------------------------------
export async function initGeofencing() {
  // 1. Notification permission
  // notifee.requestPermission() handles Android 13+ (POST_NOTIFICATIONS) automatically.
  // On Android 12 and below it's a no-op (notifications were always allowed).
  const notifeeSettings = await notifee.requestPermission();
  if (notifeeSettings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
    console.log('[GeoRemind] ⚠️ Notification permission denied');
    // Don't crash — continue without notifications on older/restricted devices
  }

  // 2. On Android 13 (API 33) notifee doesn't always trigger the OS dialog.
  //    Explicitly request POST_NOTIFICATIONS via PermissionsAndroid for API 33+.
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    try {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS as any
      );
    } catch (_) {
      // Ignore — permission may already be granted or not available
    }
  }

  // 3. Foreground location permission
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') {
    console.log('[GeoRemind] Foreground location denied');
    return;
  }

  // 4. Background location permission
  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') {
    console.log('[GeoRemind] ⚠️ Background location denied — reminders will only trigger while app is open');
    // Continue anyway; foreground-only location still works
  }

  // 5. Fetch reminders and cache them for the background task
  const { data, error } = await supabase
    .from('reminders')
    .select('id, title, latitude, longitude, radius, is_active')
    .eq('is_active', true);

  if (error) {
    console.log('[GeoRemind] Failed to fetch reminders:', error.message);
  } else {
    await syncRemindersCache(data ?? []);
  }

  // 6. Start background location polling (skip if already running)
  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (isRegistered) {
    console.log('[GeoRemind] Task already running — ensuring persistent notification is shown');
    await showPersistentNotification();
    return;
  }

  try {
    await Location.startLocationUpdatesAsync(GEOFENCE_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: LOCATION_INTERVAL_MS,
      distanceInterval: 0,
      foregroundService: {
        notificationTitle: '📍 GeoRemind is active',
        notificationBody: 'Monitoring your location reminders...',
        notificationColor: '#4CAF50',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
  } catch (startError: any) {
    // On some Android 13 devices the foregroundService option may fail if the
    // FOREGROUND_SERVICE_LOCATION permission wasn't granted. Fall back to
    // starting without it (foreground-only monitoring).
    console.log('[GeoRemind] Primary location start failed, trying fallback:', startError?.message);
    try {
      await Location.startLocationUpdatesAsync(GEOFENCE_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: LOCATION_INTERVAL_MS,
        distanceInterval: 0,
        pausesUpdatesAutomatically: false,
      });
    } catch (fallbackError: any) {
      console.log('[GeoRemind] Fallback location start also failed:', fallbackError?.message);
      return;
    }
  }

  // Also show/update the persistent notification immediately after starting
  await showPersistentNotification();
  console.log('[GeoRemind] ✅ Geofencing started');
}

// ---------------------------------------------------------------------------
// Stop geofencing — call on logout
// ---------------------------------------------------------------------------
export async function stopGeofencing() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(GEOFENCE_TASK);
      console.log('[GeoRemind] Stopped');
    }
    await AsyncStorage.multiRemove([REMINDERS_CACHE_KEY, TRIGGERED_IDS_KEY]);
  } catch (e: any) {
    console.log('[GeoRemind] stopGeofencing error:', e?.message);
  }
}