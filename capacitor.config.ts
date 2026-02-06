import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bastyon.app',
  appName: 'Bastyon',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  }
};

export default config;
