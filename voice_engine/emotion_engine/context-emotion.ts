export type VoiceEmotion = "happy" | "curious" | "serious" | "calm" | "excited" | "concerned" | "playful" | "thoughtful";

const supported = new Set<VoiceEmotion>(["happy", "curious", "serious", "calm", "excited", "concerned", "playful", "thoughtful"]);

export function normalizeEmotion(value: unknown): VoiceEmotion {
  const emotion = String(value || "calm") as VoiceEmotion;
  return supported.has(emotion) ? emotion : "calm";
}

export const emotionGlow: Record<VoiceEmotion, string> = {
  happy: "rgba(251, 191, 36, .45)",
  curious: "rgba(45, 212, 191, .42)",
  serious: "rgba(148, 163, 184, .35)",
  calm: "rgba(52, 211, 153, .34)",
  excited: "rgba(251, 146, 60, .48)",
  concerned: "rgba(96, 165, 250, .38)",
  playful: "rgba(244, 114, 182, .4)",
  thoughtful: "rgba(167, 139, 250, .4)",
};
