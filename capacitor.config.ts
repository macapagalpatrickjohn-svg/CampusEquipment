import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'edu.campus.equipment',
  appName: 'Campus Equipment',
  webDir: 'dist/campus/browser',
  android: { adjustMarginsForEdgeToEdge: 'auto' },
};

export default config;