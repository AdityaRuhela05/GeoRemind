import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { supabase } from '../lib/supabase';

// App.tsx will pass the session object down to HomeScreen
type HomeScreenProps = {
  userEmail: string;
};

export default function HomeScreen({ userEmail }: HomeScreenProps) {

  // Extract just the name part before the @ symbol
  // e.g. "aditya@gmail.com" → "aditya"
  const displayName = userEmail.split('@')[0];

  async function handleLogout() {
    await supabase.auth.signOut();
    // No navigation needed — App.tsx is always watching the session
    // When session becomes null, it automatically shows LoginScreen
  }

  return (
    <View style={styles.container}>

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.welcomeSmall}>Welcome back,</Text>
          <Text style={styles.welcomeName}>{displayName} 👋</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* ── Empty State (centre of screen) ── */}
      <View style={styles.emptyState}>
        <Text style={styles.pinEmoji}>📍</Text>
        <Text style={styles.emptyTitle}>No reminders yet</Text>
        <Text style={styles.emptySubtitle}>
          Tap below to add your first reminder
        </Text>
      </View>

      {/* ── Add Reminder Button ── */}
      <TouchableOpacity style={styles.addButton} onPress={() => {}}>
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

  // Top bar: space-between pushes Welcome left, Logout right
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
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

  // Empty state sits in the middle of remaining space
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

  // Pinned to bottom by the flex layout above
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});