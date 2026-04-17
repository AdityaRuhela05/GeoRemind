import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, PermissionsAndroid, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from './src/lib/supabase';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import AddReminderScreen from './src/screens/AddReminderScreen';
import { initGeofencing } from './src/utils/geofencing';

type RootStackParamList = {
  Login: undefined;
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      // Only start geofencing once we know the user is logged in.
      // Calling it before a session exists (or before Android is ready)
      // can cause crashes on Android 13 and below.
      if (session) {
        initGeofencing().catch(e => console.error('initGeofencing failed:', e));
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        // Re-init geofencing on sign-in
        initGeofencing().catch(e => console.error('initGeofencing failed on auth change:', e));
      }
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const HomeScreenWrapper = () => (
    <HomeScreen userEmail={session?.user?.email ?? ''} />
  );

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Home" component={HomeScreenWrapper} />
            <Stack.Screen name="AddReminder" component={AddReminderScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}