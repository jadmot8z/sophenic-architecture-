# SOPHENIC 11.0.0 — Professional Voice + OAuth Connectors

- STT PCM16 quasi temps réel via WebSocket, faster-whisper, langue automatique, VAD/endpointing et transcription partielle.
- TTS VoxCPM2 streaming derrière `VoiceProviderRegistry`, Human Speech Engine et file WebAudio.
- Barge-in actif jusqu'à la fin audio réelle ; coupure réseau et lecture immédiates.
- Voix Windows/navigateur désactivée par défaut, disponible seulement par opt-in.
- Broker OAuth HTTPS côté éditeur ; aucun secret fournisseur dans Electron/React en production.
- `state`, PKCE, ticket poll haché/à usage unique, callback loopback validé et coffre `safeStorage`.
- Connecteurs réellement exécutables depuis le chat et le Code Engine.
- Mémoire sélective par utilisateur/préférence/projet, retrieval contextuel et historique autosauvegardé.
