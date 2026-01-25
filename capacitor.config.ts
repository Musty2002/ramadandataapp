import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ramadandata.app',
  appName: 'Ramadan Data',
  webDir: 'dist',
  server: {
    // For production: comment out 'url' to load from local dist folder
    // For development hot-reload: uncomment the url line below
    // url: 'https://f2d268fb-d29f-46e2-885d-9cb4b456af13.lovableproject.com?forceHideBadge=true',
    cleartext: true,
    androidScheme: 'https'
  },
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
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    // Ensure app handles all navigation internally
    initialFocus: true,
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    allowsLinkPreview: false,
  },
};

export default config;