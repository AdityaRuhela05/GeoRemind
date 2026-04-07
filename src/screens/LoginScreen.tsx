import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Animation values
  const pinBounce = useState(new Animated.Value(0))[0];
  const rippleScale = useState(new Animated.Value(0))[0];
  const rippleOpacity = useState(new Animated.Value(0.4))[0];

  useEffect(() => {
    // Pin bounce animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pinBounce, {
          toValue: -18,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pinBounce, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1200),
      ])
    ).start();

    // Ripple animation
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(rippleScale, {
            toValue: 1,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(rippleOpacity, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(rippleScale, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(rippleOpacity, {
            toValue: 0.4,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(500),
      ])
    ).start();
  }, []);

  async function handleAuth() {
    setError('');
    if(!email || !password){
      setError('Please enter both email and password.');
      setLoading(false);
      return;
    }
    setLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setError('Check your email to confirm your account');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError('Invalid email or password. Please try again.');
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>

      {/* Animated map pin illustration */}
      <View style={styles.illustrationContainer}>
        {/* Ripple effect */}
        <Animated.View style={[
          styles.ripple,
          {
            transform: [{ scale: rippleScale }],
            opacity: rippleOpacity,
          }
        ]} />

        {/* Map pin */}
        <Animated.View style={[
          styles.pinContainer,
          { transform: [{ translateY: pinBounce }] }
        ]}>
          <View style={styles.pinHead}>
            <View style={styles.pinInner} />
          </View>
          <View style={styles.pinTail} />
        </Animated.View>
      </View>

      <Text style={styles.title}>GeoRemind</Text>
      <Text style={styles.subtitle}>
        {isSignUp ? 'Create an account' : 'Welcome back'}
      </Text>

      {/* Email input */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      {/* Password input */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Enter your password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      
        {error ? (
          <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

      <TouchableOpacity
        style={styles.button}
        onPress={handleAuth}
        disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Login'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
        <Text style={styles.switchText}>
          {isSignUp
            ? 'Already have an account? Login'
            : "Don't have an account? Sign Up"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f0f4ff',
  },
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    marginBottom: 16,
  },
  ripple: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    bottom: 10,
  },
  pinContainer: {
    alignItems: 'center',
    position: 'absolute',
  },
  pinHead: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  pinInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#4CAF50',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 28,
    color: '#666',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#dde3f0',
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#1a1a2e',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#dde3f0',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    padding: 13,
    fontSize: 15,
    color: '#1a1a2e',
  },
  eyeButton: {
    paddingHorizontal: 12,
  },
  eyeIcon: {
    fontSize: 18,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchText: {
    textAlign: 'center',
    color: '#4CAF50',
    fontSize: 14,
  },
  errorBox: {
  backgroundColor: '#ffe5e5',
  borderLeftWidth: 4,
  borderLeftColor: '#e53935',
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
  },
  errorText: {
  color: '#c62828',
  fontSize: 13,
  fontWeight: '600',
  },
});