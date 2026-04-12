import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Circle, Region } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function AddReminderScreen() {
  const navigation = useNavigation();

  // 🎯 useRoute lets us read parameters passed from the previous screen
  const route = useRoute<any>();
  const existingReminder = route.params?.reminder;

  // If editing, pre-fill with existing data. If adding, start empty.
  const isEditMode = !!existingReminder;

  const mapRef = useRef<MapView>(null);

  const [title, setTitle] = useState(existingReminder?.title ?? '');
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    existingReminder
      ? { latitude: existingReminder.latitude, longitude: existingReminder.longitude }
      : null
  );
  const [radius, setRadius] = useState(existingReminder?.radius ?? 20);
  const [saving, setSaving] = useState(false);
  const [locationLoading, setLocationLoading] = useState(!isEditMode);
  const [initialRegion, setInitialRegion] = useState<Region>({
    latitude: existingReminder?.latitude ?? 20.5937,
    longitude: existingReminder?.longitude ?? 78.9629,
    latitudeDelta: existingReminder ? 0.01 : 15,
    longitudeDelta: existingReminder ? 0.01 : 15,
  });

  useEffect(() => {
    if (isEditMode) {
      // In edit mode, zoom straight to the existing pin location
      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: existingReminder.latitude,
          longitude: existingReminder.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 500);
      }, 300);
    } else {
        // Force hide loader after 3 seconds no matter what
        const locationTimeout = setTimeout(() => {
        setLocationLoading(false);
        }, 5000);
      // In add mode, get user's current location
      Geolocation.requestAuthorization();
      Geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(locationTimeout);
          const { latitude, longitude } = position.coords;
          const region = {
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          setInitialRegion(region);
          setLocationLoading(false);
          mapRef.current?.animateToRegion(region, 1000);
        },
        (error) => {
          clearTimeout(locationTimeout);
          console.log('Location error:', error);
          setLocationLoading(false);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    }
  }, []);

  function handleMapPress(e: any) {
    setSelectedLocation(e.nativeEvent.coordinate);
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a name for this reminder.');
      return;
    }
    if (!selectedLocation) {
      Alert.alert('Missing location', 'Please tap on the map to pick a location.');
      return;
    }

    setSaving(true);

    if (isEditMode) {
      // UPDATE existing row
      const { error } = await supabase
        .from('reminders')
        .update({
          title: title.trim(),
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          radius: radius,
        })
        .eq('id', existingReminder.id);

      setSaving(false);
      if (error) Alert.alert('Error', error.message);
      else navigation.goBack();

    } else {
      // INSERT new row
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('reminders').insert({
        user_id: user?.id,
        title: title.trim(),
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        radius: radius,
        is_active: true,
      });

      setSaving(false);
      if (error) Alert.alert('Error', error.message);
      else navigation.goBack();
    }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit Reminder' : 'New Reminder'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Title Input */}
      <View style={styles.section}>
        <Text style={styles.label}>Reminder Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Laundry shop, Grocery store"
          placeholderTextColor="#aaa"
          value={title}
          onChangeText={setTitle}
        />
      </View>

      {/* Map */}
      <View style={styles.section}>
        <Text style={styles.label}>Pick Location</Text>
        <Text style={styles.sublabel}>Tap anywhere on the map to drop a pin</Text>

        {locationLoading && (
          <View style={styles.mapLoader}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.mapLoaderText}>Getting your location...</Text>
          </View>
        )}

        <MapView
          ref={mapRef}
          style={styles.map}
          onPress={handleMapPress}
          initialRegion={initialRegion}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {selectedLocation && <Marker coordinate={selectedLocation} />}
          {selectedLocation && (
            <Circle
              center={selectedLocation}
              radius={radius}
              fillColor="rgba(76, 175, 80, 0.2)"
              strokeColor="rgba(76, 175, 80, 0.8)"
              strokeWidth={2}
            />
          )}
        </MapView>

        {selectedLocation ? (
          <Text style={styles.coordText}>
            📍 {selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}
          </Text>
        ) : (
          <Text style={styles.coordText}>No location selected yet</Text>
        )}
      </View>

      {/* Radius Selector */}
      <View style={styles.section}>
        <Text style={styles.label}>Geofence Radius</Text>
        <View style={styles.radiusRow}>
          {[10, 20, 30, 40].map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusButton, radius === r && styles.radiusButtonActive]}
              onPress={() => setRadius(r)}
            >
              <Text style={[styles.radiusText, radius === r && styles.radiusTextActive]}>
                {r}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving...' : isEditMode ? '✏️ Update Reminder' : '💾 Save Reminder'}
        </Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backButton: { fontSize: 16, color: '#4CAF50', fontWeight: '600', width: 60 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
  sublabel: { fontSize: 12, color: '#888', marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: '#dde3f0',
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#1a1a2e',
  },
  map: { width: '100%', height: 280, borderRadius: 12, overflow: 'hidden' },
  mapLoader: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    marginBottom: 8,
  },
  mapLoaderText: { marginTop: 10, color: '#4CAF50', fontSize: 14 },
  coordText: { fontSize: 12, color: '#888', marginTop: 6, textAlign: 'center' },
  radiusRow: { flexDirection: 'row', gap: 10 },
  radiusButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#dde3f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  radiusButtonActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  radiusText: { fontSize: 14, fontWeight: '600', color: '#555' },
  radiusTextActive: { color: '#fff' },
  saveButton: {
    backgroundColor: '#4CAF50',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    marginBottom: 40,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});