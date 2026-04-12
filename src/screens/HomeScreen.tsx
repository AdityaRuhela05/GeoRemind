import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type HomeScreenProps = {
  userEmail: string;
};

type RootStackParamList = {
  Home: undefined;
  AddReminder: {
    reminder?: {
      id: string;
      title: string;
      latitude: number;
      longitude: number;
      radius: number;
    };
  } | undefined;
};

// 🎯 This is a TypeScript type — it describes exactly what shape
// each reminder object from Supabase will have
type Reminder = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  radius: number;
  is_active: boolean;
  created_at: string;
};

export default function HomeScreen({ userEmail }: HomeScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const displayName = userEmail.split('@')[0];

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  // 🎯 useFocusEffect runs every time this screen comes into focus
  // This means when user saves a reminder and comes back, list auto-refreshes
  // useCallback is required by useFocusEffect to avoid infinite loops
  useFocusEffect(
    useCallback(() => {
      fetchReminders();
    }, [])
  );

  useEffect(() => {
  const subscription = DeviceEventEmitter.addListener(
    'GEOFENCE_TRIGGERED',
    () => {
      fetchReminders();
    }
  );
  return () => subscription.remove();
}, []);

  async function fetchReminders() {
    setLoading(true);

    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('created_at', { ascending: false }); // newest first

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setReminders(data ?? []);
    }

    setLoading(false);
  }

  async function handleDelete(id: string) {
    // Ask user to confirm before deleting
    Alert.alert(
      'Delete Reminder',
      'Are you sure you want to delete this reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('reminders')
              .delete()
              .eq('id', id); // delete WHERE id = this reminder's id

            if (error) {
              Alert.alert('Error', error.message);
            } else {
              // Remove from local state immediately — no need to refetch
              setReminders(prev => prev.filter(r => r.id !== id));
            }
          },
        },
      ]
    );
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // This renders each reminder card in the list
  function renderReminder({ item }: { item: Reminder }) {
  return (
    <View style={styles.reminderCard}>
      <View style={styles.reminderLeft}>
        <Text style={styles.reminderEmoji}>📍</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.reminderTitle}>{item.title}</Text>
          <Text style={styles.reminderMeta}>
            Radius: {item.radius} m
          </Text>
        </View>
      </View>

      {/* Edit and Delete buttons */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('AddReminder', { reminder: item })}
        >
          <Text style={styles.editText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
        >
          <Text style={styles.deleteText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

  return (
    <View style={styles.container}>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.welcomeSmall}>Welcome back,</Text>
          <Text style={styles.welcomeName}>{displayName} 👋</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Reminders count */}
      {reminders.length > 0 && (
        <Text style={styles.countText}>
          {reminders.length} active reminder{reminders.length > 1 ? 's' : ''}
        </Text>
      )}

      {/* List or Empty State */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : reminders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.pinEmoji}>📍</Text>
          <Text style={styles.emptyTitle}>No reminders yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap below to add your first reminder
          </Text>
        </View>
      ) : (
        // 🎯 FlatList is React Native's performant list component
        // It only renders items currently visible on screen
        // Much better than mapping over an array for long lists
        <FlatList
          data={reminders}
          keyExtractor={(item) => item.id}
          renderItem={renderReminder}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
      
      {/* Add Reminder Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddReminder')}
      >
        <Text style={styles.addButtonText}>+ Add Reminder</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
    padding: 24,
    paddingTop: 56,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeSmall: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  welcomeName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  logoutButton: {
    backgroundColor: '#ffe5e5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  logoutText: {
    color: '#e53935',
    fontWeight: '600',
    fontSize: 13,
  },
  countText: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinEmoji: {
    fontSize: 52,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  listContainer: {
    paddingBottom: 16,
  },
  reminderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  reminderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reminderEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  reminderMeta: {
    fontSize: 12,
    color: '#888',
  },
  deleteButton: {
    padding: 8,
  },
  deleteText: {
    fontSize: 20,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    elevation: 3,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButton: {
    padding: 8,
  },
  editText: {
    fontSize: 20,
  },
});