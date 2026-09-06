# SOPHENIC 10.3.1 — Compile Hotfix

- Corrige `electron/main.ts` : les tâches planifiées utilisent désormais un message `user` compatible avec `OpenRouterChatMessage`.
- Corrige la transcription vocale Electron : copie explicite des octets IPC dans un `ArrayBuffer` avant création du `Blob`, compatible TypeScript 5.9.
- Aucun changement des clés, plugins, mémoire, historique ou configuration utilisateur.
