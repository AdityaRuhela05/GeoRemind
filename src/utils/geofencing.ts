import BackgroundFetch from 'react-native-background-fetch';
import Geolocation from '@react-native-community/geolocation';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { supabase } from '../lib/supabase';
import { DeviceEventEmitter } from 'react-native';

// 🎯 Haversine formula — calculates distance between two GPS points in metres
// Works on a sphere (Earth) so it's accurate for real-world distances
function getDistanceInMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth's radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Send a local push notification
async function sendNotification(title: string) {
  // Create a notification channel (required on Android)
  const channelId = await notifee.createChannel({
    id: 'georemind',
    name: 'GeoRemind Alerts',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

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

// Check all reminders against current location
async function checkGeofences() {
  // Get current GPS position
  return new Promise<void>((resolve) => {
    Geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Fetch all active reminders for logged in user
        const { data: reminders, error } = await supabase
          .from('reminders')
          .select('*')
          .eq('is_active', true);

        if (error || !reminders) {
          resolve();
          return;
        }

        // Check each reminder
        for (const reminder of reminders) {
          const distance = getDistanceInMetres(
            latitude, longitude,
            reminder.latitude, reminder.longitude
          );

          console.log(`Distance to "${reminder.title}": ${distance.toFixed(0)}m (radius: ${reminder.radius}m)`);

          // 🎯 If inside the geofence radius → trigger!
          if (distance <= reminder.radius) {
            // Send notification
            await sendNotification(reminder.title);

            // Delete reminder — it has served its purpose
            await supabase
              .from('reminders')
              .delete()
              .eq('id', reminder.id);
              // Tell the UI to refresh
              DeviceEventEmitter.emit('GEOFENCE_TRIGGERED');    

            console.log(`Triggered and deleted: "${reminder.title}"`);
          }
        }

        resolve();
      },
      (error) => {
        console.log('Geofence location error:', error);
        resolve();
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// Initialize background fetch — call this once when app starts
export function initGeofencing() {
  BackgroundFetch.configure(
    {
      minimumFetchInterval: 15, // check every 15 minutes (minimum allowed)
      stopOnTerminate: false,   // keep running after app is closed
      startOnBoot: true,        // restart after phone reboot
      enableHeadless: true,     // run even when app is fully closed
    },
    async (taskId) => {
      console.log('[BackgroundFetch] task:', taskId);
      await checkGeofences();
      BackgroundFetch.finish(taskId); // MUST call this or OS kills the task
    },
    (taskId) => {
      console.log('[BackgroundFetch] timeout:', taskId);
      BackgroundFetch.finish(taskId);
    }
  );
}

// Call this to manually trigger a check (useful for testing)
export { checkGeofences };