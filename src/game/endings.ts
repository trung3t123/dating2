import type { GameRunState } from "./types";

const ENDING_RULES: {
  match: (ids: string[]) => boolean;
  title: string;
  description: string;
  emoji: string;
}[] = [
  {
    match: (ids) => ids.includes("detour") && (ids.includes("jazz") || ids.includes("ramen")),
    title: "Jazz Night Soulmate Route",
    description: "Bạn chọn kết nối thật — không vội, không né. Date này có thể thành chuyện dài.",
    emoji: "✨",
  },
  {
    match: (ids) => ids.includes("arcade") && ids.includes("bbq"),
    title: "Chaotic Golden Retriever Couple",
    description: "Năng lượng cao, cười nhiều, không ai ngại là chính mình.",
    emoji: "🐕",
  },
  {
    match: (ids) => ids.includes("softmeal") && ids.includes("books") && ids.includes("midnight"),
    title: "Cozy Introvert Romance",
    description: "Yên tĩnh, an toàn, từ từ — kiểu tình yêu không ồn ào nhưng rất thật.",
    emoji: "☕",
  },
  {
    match: (ids) => ids.includes("home") || ids.includes("whatever"),
    title: "Emotionally Unavailable Route",
    description: "Có khoảng cách nhẹ — không xấu, chỉ là hai người chưa sẵn sàng mở hết.",
    emoji: "🌙",
  },
  {
    match: (ids) => ids.includes("pub") && ids.includes("classy"),
    title: "Friends-to-Lovers Route",
    description: "Trò chuyện sâu + phong cách chỉn — chemistry từ sự tôn trọng.",
    emoji: "📖",
  },
];

export function computeEnding(state: GameRunState) {
  const ids = state.choices.map((c) => c.choiceId);
  const rule = ENDING_RULES.find((r) => r.match(ids));
  if (rule) return rule;

  const vibes = state.choices.map((c) => c.label).join(" → ");
  return {
    title: "Your Date Energy",
    description: `Lộ trình của bạn: ${vibes}. Mỗi lựa chọn ghép lại thành một vibe riêng — không đúng sai, chỉ là bạn.`,
    emoji: "💫",
  };
}
