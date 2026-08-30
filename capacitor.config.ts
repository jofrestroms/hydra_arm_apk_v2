import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hydra.movil',
  appName: 'Hydra Monitor',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      '*.onrender.com'
    ]
  },
  android: {
    allowMixedContent: false
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile'
  }
};

export default config;
