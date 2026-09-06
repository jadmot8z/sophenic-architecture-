# SOPHENIC 11 — Code Engine, Native Voice et OAuth Connectors

Agent de développement autonome :

Utilisateur → SOPHENIC Brain → Model Router → Native Code Engine → Agents outils.

## Installation Windows

1. Installer Node.js LTS, Git, Python et Docker Desktop.
2. Ouvrir ce dossier dans VS Code.
3. Exécuter :

```powershell
npm install
npm run typecheck
npm run test:sophenic
npm run build
```

## Lancement

```powershell
./RUN-SOPHENIC-VSCODE.ps1
```

Hermes est optionnel et ne contrôle jamais le pipeline Code Engine.

## Sophenic Native Voice

Le bouton microphone du chat ouvre une conversation plein écran. Le micro reste actif, la transcription et la voix sont streamées en full duplex, et l’utilisateur peut interrompre SOPHENIC naturellement. Le contexte rejoint le même chat et la même mémoire que les messages texte.

Le moteur est local-first : faster-whisper, VAD adaptatif, TTS neural expressif, 42 profils de langue/accent, émotion contextuelle et relance naturelle après silence. Démarrer le moteur GPU avec :

```powershell
.\START-SOPHENIC-VOICE.ps1
```

Voir `VOICE-ARCHITECTURE.md` et `voice_engine/README.md`. Aucun service Web Speech, Windows Speech ou API vocale externe n’est utilisé comme fallback silencieux.

## Plugins OAuth

`oauth-broker/` est un service confidentiel à déployer par l’éditeur SOPHENIC. Les utilisateurs ne configurent aucune clé : ils cliquent sur **Connecter** et autorisent l’application sur le site officiel.

Voir `OAUTH-PLUGIN-HUB-EDITEUR.md` pour l’unique provisionnement serveur requis. Sans ce provisionnement réel des applications chez les fournisseurs, les boutons restent présents mais renvoient une indisponibilité propre — aucune fausse connexion n’est simulée.

Les plugins autorisés sont ensuite utilisables par l’IA via une liste blanche d’actions définie dans `electron/runtime/plugin-connectors.ts`.

## Correctif connecteurs multi-utilisateur

Voir `SOPHENIC-23-CORRECTIONS.md` pour le broker OAuth public, la persistance inter-version et les connecteurs PostgreSQL/MySQL/MongoDB.
