# SOPHENIC 10.3.0 — Experience, Voice & Workspace

## Plugins
- UX simplifiée type « connecteur » : icône, nom, état, Connecter/Déconnecter.
- Aucun formulaire de clé API n'est exposé dans le Plugin Hub.
- Les secrets déjà enregistrés restent dans le coffre Electron/safeStorage et ne sont pas renvoyés au renderer.
- GitHub conserve le Device Flow officiel ; Vercel conserve le token personnel chiffré ; les autres services ouvrent leur parcours officiel ou utilisent une configuration runtime sécurisée.

## Fournisseurs IA
- Suppression de l'écran public « Fournisseurs IA ».
- Les clés existantes ne sont pas supprimées : le runtime continue d'utiliser le coffre local existant.

## Historique
- Session actuelle + groupes Chat / Code / Image dans la barre latérale.
- 3 conversations récentes par groupe, puis développement vertical avec la flèche.
- Page Historique avec recherche plein texte et séparation Chat / Code / Image.
- Titre automatique à partir de la première demande utilisateur.

## Planification
- Tâches datées et horaires, ponctuelles ou quotidiennes.
- Suppression d'une tâche quotidienne = arrêt de la récurrence.
- Exécution par SOPHENIC lorsque l'application Desktop est active.
- Notification native + toast SOPHENIC lorsque la tâche du jour est terminée ou échoue.

## Bibliothèque
- 20 images maximum + 20 fichiers maximum.
- Message explicite lorsque la capacité est atteinte ; suppression possible pour libérer de la place.

## Voice / Voix
- Nouveau service séparé `voice-service/`, remplaçable via l'abstraction `VoiceProvider`.
- VoxCPM2 auto-hébergé pour le TTS et faster-whisper pour le STT.
- 30 langues officielles VoxCPM2 + mode Automatique.
- Streaming WebSocket, buffering audio, identité vocale de référence/voice-design, Human Speech Engine conservateur.
- Barge-in : l'audio SOPHENIC est interrompu lorsque la parole utilisateur est détectée pendant la lecture, puis la nouvelle phrase est transcrite.
- Paramètres : activation, langue, voix, vitesse, expressivité, volume, Natural Conversation, autoplay, interruption.
- Docker/NVIDIA CUDA, mode mock sans GPU, health check, auth service, limites de concurrence et suppression des fichiers audio temporaires.
- Fallback texte : l'indisponibilité du voice-service ne bloque jamais le chat texte.

## Sécurité
- `SOPHENIC_VOICE_SERVICE_KEY` reste dans le process principal/backend, jamais dans le renderer.
- Le serveur GPU n'est pas destiné à être exposé publiquement sans reverse proxy/VPN/authentification.
