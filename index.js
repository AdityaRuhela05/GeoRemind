/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// ⚠️ IMPORTANT: Task definitions must be imported at the entry point.
// The OS executes index.js when waking the app in the background,
// so TaskManager.defineTask() must run before any component mounts.
import './src/utils/geofencing';

AppRegistry.registerComponent(appName, () => App);

