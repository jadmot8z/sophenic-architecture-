# SOPHENIC Native Realtime Voice — architecture 2.0

## Audit de l’ancien système (avant remplacement)

L’audit du dépôt a identifié l’intégralité du chemin vocal précédent :

- `src/lib/voice-client.ts` : enregistrement par tour, Web Speech/Windows Speech, barge-in séparé et file WAV WebAudio ;
- `src/components/agent/local-agent-workspace.tsx` : bouton « Parler » one-shot, état vocal et segmentation TTS mêlés au chat ;
- `src/components/agent/workspace-pages.tsx` : réglages et test de voix ;
- `electron/preload.ts`, `electron/main.ts`, `src/types/electron.d.ts` : IPC STT/TTS, deux WebSockets distincts et fallbacks Windows PowerShell ;
- `electron/runtime/workspace-data.ts` : préférences vocales persistantes ;
- `voice-service/` : FastAPI, faster-whisper, VoxCPM2, VAD RMS et streams STT/TTS séparés ;
- `START-SOPHENIC-VOICE.ps1`, `.env.example`, Docker, tests et documentation.

Les actions Windows de volume (`electron/runtime/actions/windows-audio.ts`) ne font **pas** partie du moteur de conversation vocale et ont été préservées. Elles restent une capacité PC indépendante.

L’ancien client, les fallbacks Web/Windows Speech, les anciens IPC et `voice-service/` ont été retirés. OAuth, authentification, chat, modèles, plugins, mémoire, Code Engine, historique et navigation ne sont pas modifiés.

## Plan technique réalisé

1. Isoler tous les domaines sous `voice_engine/`.
2. Remplacer les deux connexions par une session WebSocket full duplex persistante.
3. Garder le micro ouvert pendant toute la session et transmettre du PCM16 binaire à faible latence.
4. Détecter localement le début de parole pour couper l’audio immédiatement, puis confirmer côté serveur avec un VAD adaptatif.
5. Conserver le pipeline de chat et sa mémoire : une transcription finale entre dans exactement le même `sendChat` qu’un message texte.
6. Segmenter le flux LLM à des frontières naturelles et planifier le PCM TTS sans trous avec WebAudio.
7. Ajouter émotion contextuelle, relance de silence non mécanique, UI plein écran, langues/accents et tests ciblés.
8. Garder les clés et les modèles hors du renderer ; ne jamais journaliser audio ou transcription.

## Modules

```text
voice_engine/
├── speech_to_text/          # faster-whisper chaud + transport renderer
├── text_to_speech/          # provider neural, segmentation et lecteur PCM
├── audio_stream/            # micro AudioWorklet, PCM, VAD adaptatif
├── emotion_engine/          # 8 humeurs et politique de réactions contextuelles
├── interruption_handler/    # annulation serveur + coordinateur de barge-in
├── silence_detector/        # minuterie naturelle 18,5–22,5 s et relances localisées
├── voice_ui/                # interface conversation plein écran
├── service/                 # FastAPI /v2/realtime
├── tests/
├── Dockerfile
└── docker-compose.yml
```

## Chemin temps réel

```text
Microphone unique (echo cancellation)
  → AudioWorklet PCM16 binaire
  → IPC Electron privilégié
  → WS /v2/realtime persistant
  → VAD adaptatif + pré-roll + endpointing prudent
  → faster-whisper (partiel/final, langue auto)
  → pipeline Chat/Sophenic Brain existant + historique/mémoire existants
  → segmentation de phrases pendant le streaming LLM
  → Emotion Engine + profil de langue/accent
  → provider neural local en streaming
  → PCM16 sur le même WebSocket
  → planification WebAudio continue
```

## Full duplex et interruption

Le microphone et le flux d’entrée restent actifs pendant que SOPHENIC réfléchit et parle. Le VAD renderer réagit en environ 105 ms (170 ms pendant la lecture pour réduire les faux positifs d’écho). Lors d’une reprise de parole :

1. le gain WebAudio descend en 28 ms et les sources planifiées sont vidées ;
2. `cancel_output` annule la génération TTS locale ;
3. la réponse LLM en cours est interrompue si nécessaire ;
4. le serveur conserve le pré-roll et transcrit l’intervention comme un nouveau tour ;
5. le nouveau message rejoint le même historique, donc le contexte de l’interruption est préservé.

Le serveur possède une seconde sécurité : son VAD annule toute sortie active dès qu’il confirme un début de parole.

## Silence naturel

En phase d’écoute seulement, `NaturalSilenceDetector` choisit un délai entre 18,5 et 22,5 secondes. Il sélectionne une formulation localisée sans répétition mécanique. Les rappels suivants sont plus espacés. Toute parole, transcription, réflexion ou sortie audio suspend/réinitialise la minuterie.

## Personnalité et émotions

`ConversationEmotionEngine` expose : happy, curious, serious, calm, excited, concerned, playful et thoughtful. Le style module rythme, énergie, chaleur, respiration et intonation. Un filler/réaction n’est autorisé que si au moins deux indices contextuels concordent et seulement après un cooldown ; il n’est jamais inséré aléatoirement.

## Langues

Le registre unique contient 42 langues. Whisper assure la détection/transcription multilingue ; chaque langue possède un locale et une instruction d’accent/prononciation transmise au provider TTS. L’option Automatique conserve la langue détectée au fil de la conversation.

## Confidentialité

- Les modèles sont auto-hébergés et les flux ne dépendent d’aucune API voix externe.
- Le renderer ne connaît jamais `SOPHENIC_VOICE_SERVICE_KEY`.
- Le service est publié sur `127.0.0.1` par défaut.
- Les logs contiennent latence, langue et tailles, jamais le texte, l’audio ou un secret.
- HTTP distant est refusé par Electron ; un moteur distant doit être protégé par HTTPS et un réseau privé.

## Démarrage

```powershell
.\START-SOPHENIC-VOICE.ps1
```

Développement sans modèle GPU : définir `SOPHENIC_VOICE_MOCK_MODE=true` dans `voice_engine/.env`.
