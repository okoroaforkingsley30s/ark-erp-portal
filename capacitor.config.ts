import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arktechnologiesgroup.arkone',
  appName: 'ARK ONE Portal',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
