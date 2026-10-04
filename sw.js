self.APPS_PWA_CONFIG={
  cacheName:'curious-path-shared-v1',
  cachePrefix:'curious-path-',
  defaultStrategy:'network-first',
  precache:['./','./index.html','./styles.css','./manifest.webmanifest','./garden.css','./src/app.js','./src/engine.js','./src/content.js','./src/maths-data.js','./src/words-data.js','./src/word-engine.js','./src/word-lab.js','./src/voice-spelling.js','./src/attempts.js','./src/quiz.js','./src/reports.js','./src/explanations.js','./src/garden.js','./src/garden-model.js','./src/garden-picture.js','./src/local-data.js','./src/data-store.js','./src/profiles.js','./src/profile-panel.js','./src/sync-model.js','./src/firebase-config.js','./src/cloud-sync.js','./src/sync-transport.js']
};
importScripts('https://nirav2000.github.io/Apps/pwa/v1/service-worker.js');
