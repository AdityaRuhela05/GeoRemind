// Use @expo/metro-config so the Expo Gradle bundler (createBundleReleaseJsAndAssets)
// produces a serialized bundle in the format Expo CLI expects.
// This is required for release APK builds. For plain RN projects this would
// be @react-native/metro-config, but Expo's Gradle plugin requires Expo's serializer.
const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const root = __dirname;

const expoConfig = getDefaultConfig(root);

const extraConfig = {
  resolver: {
    // Force Metro to resolve these from the top-level node_modules.
    // expo/node_modules/ contains stub/broken nested copies of these packages
    // (e.g. expo-constants with no build/ dir) that prevent proper resolution.
    extraNodeModules: {
      'expo-constants': path.resolve(root, 'node_modules/expo-constants'),
      'expo-asset': path.resolve(root, 'node_modules/expo-asset'),
      'expo-file-system': path.resolve(root, 'node_modules/expo-file-system'),
      'expo-font': path.resolve(root, 'node_modules/expo-font'),
    },
  },
};

module.exports = mergeConfig(expoConfig, extraConfig);
