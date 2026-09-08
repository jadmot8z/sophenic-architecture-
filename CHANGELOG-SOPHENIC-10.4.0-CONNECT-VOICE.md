# SOPHENIC 10.4.0 — Connect + Voice

- Plugin Hub utilisateur simplifié : icône, état, Connecter/Déconnecter, aucun formulaire de secret.
- OAuth navigateur réel ajouté pour Vercel, Supabase, Cloudflare, Google/Firebase/Gmail/Drive/Calendar, Notion, Stripe, Shopify et WordPress.com lorsque l'app éditeur est provisionnée.
- GitHub conserve le Device Flow officiel sans Client Secret.
- Jetons OAuth stockés dans `Electron safeStorage` et injectés uniquement dans le runtime agent.
- Configuration OAuth éditeur externalisée hors renderer.
- Voice hybride : VoxCPM2/faster-whisper si le service GPU répond ; sinon TTS Chromium puis TTS Windows natif.
- STT : faster-whisper si disponible ; sinon Web Speech puis reconnaissance Windows `System.Speech`.
- Bouton micro du chat active automatiquement le mode vocal et envoie la transcription au LLM.
- Réponse vocale automatique après une conversation démarrée au micro.
- Correction du barge-in pour tous les états de lecture (`voix locale` et `VoxCPM2`).
- Aucune panne du voice-service ne bloque le chat texte.
