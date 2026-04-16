import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';

export async function requestLocationPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  // Step 1 — Request foreground location
  const foreground = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'GeoRemind needs your location',
      message: 'We use your location to trigger reminders when you arrive at a saved spot.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    }
  );

  if (foreground !== PermissionsAndroid.RESULTS.GRANTED) {
    Alert.alert(
      'Location required',
      'GeoRemind needs location access to work. Please enable it in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }

  // Step 2 — Check if background location is already granted
  if (Platform.Version >= 29) {
    const backgroundStatus = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
    );

    if (!backgroundStatus) {
      // On Android 12+ we can't show a popup for background location
      // We must send user directly to app settings
      Alert.alert(
        '⚠️ Important: Allow Background Location',
        'For GeoRemind to notify you when your phone is locked:\n\n1. Tap "Open Settings"\n2. Tap "Location"\n3. Select "Allow all the time"',
        [
          { text: 'Skip for now', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    }
  }

  return true;
}