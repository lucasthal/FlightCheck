import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flightcheck.app',
  appName: 'FlightCheck',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
