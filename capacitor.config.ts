import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ramadandata.app',
  appName: 'Ramadan Data',
  webDir: 'dist',
  // PRODUCTION MODE: Load from bundled local assets (no server URL)
  // This ensures fast startup and offline capability
  // 
  // FOR DEVELOPMENT: Uncomment the server block below for hot-reload:
  // server: {
  //   url: 'https://f2d268fb-d29f-46e2-885d-9cb4b456af13.lovableproject.com?forceHideBadge=true',
  //   cleartext: true,
  //   androidScheme: 'https'
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#1e3a5f',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1e3a5f',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#1e3a5f',
      sound: 'default',
    },
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: false,
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false, // Disable for production
    initialFocus: true,
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    allowsLinkPreview: false,
  },
};

export default config;