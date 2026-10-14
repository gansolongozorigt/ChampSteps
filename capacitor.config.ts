import type { CapacitorConfig } from '@capacitor/cli';

// Native shell (iOS / Android) around the same Vite build (dist/). Web assets are bundled
// — nothing is loaded from a remote URL. Settings mirror docs/BRAND.md (white, green).
const config: CapacitorConfig = {
  appId: 'mn.champstep.app',
  appName: 'ChampStep',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scheme: 'ChampStep',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#FFFFFF',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE',
      splashImmersive: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FFFFFF',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    FirebaseAuthentication: {
      // Native sign-in; the credential is handed to the Firebase JS SDK (src/lib/nativeAuth.ts).
      skipNativeAuth: false,
      providers: ['google.com', 'apple.com'],
    },
    FirebaseMessaging: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
