/** смайлики для панели чата по разделам: строка через пробел, чтобы список читался глазами */
const words = (text: string) => text.split(/\s+/).filter(Boolean);

export interface EmojiGroup { id: string, title: string, icon: string, items: string[] }

export const EMOJI_GROUPS: EmojiGroup[] = [
  { id: "smileys", title: "Смайлики", icon: "😀", items: words("😀 😃 😄 😁 😆 😅 😂 🤣 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖") },
  { id: "people", title: "Люди", icon: "👍", items: words("👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🧠 👀 👁️ 👅 👄 👶 🧒 👦 👧 🧑 👨 👩 🧔 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🤦 🤷 💂 🕵️ 👮 👷 🤴 👸 🦸 🦹 🧙 🧛 🧟 🧞 🏃 💃 🕺") },
  { id: "hearts", title: "Сердца", icon: "❤️", items: words("❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💋 💯 💢 💥 💫 💦 💨 🕳️ 💬 💭 💤 ✨ ⭐ 🌟 🔥 ⚡ 🎉 🎊 🎈 🎁 🏆 🥇 🥈 🥉 ✅ ❌ ❓ ❗ ⚠️ 🚫") },
  { id: "animals", title: "Животные и еда", icon: "🐱", items: words("🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦆 🦉 🐺 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐢 🐍 🐙 🐠 🐬 🐳 🦈 🐘 🦒 🐊 🌹 🌸 🌻 🌲 🍀 🍎 🍌 🍉 🍇 🍓 🍒 🍑 🍍 🥝 🍅 🥑 🍔 🍟 🍕 🌭 🌮 🍿 🍩 🍪 🎂 🍰 🍫 🍬 ☕ 🍺 🍷 🍸") },
  { id: "objects", title: "Предметы", icon: "🎮", items: words("⚽ 🏀 🏈 ⚾ 🎾 🏐 🎱 🏓 🎯 🎮 🕹️ 🎲 ♟️ 🎭 🎨 🎬 🎤 🎧 🎸 🎹 🥁 📱 💻 ⌨️ 🖥️ 📷 📺 💡 🔦 📚 📖 ✏️ 📝 📌 🔑 🔒 🔓 🔨 🔧 ⚙️ 🔫 💣 🔪 🗡️ ⚔️ 🛡️ 💊 💉 🩸 🧬 🔬 💰 💎 🚗 ✈️ 🚀 ⏰ ⌛ 🌍 🌙 ☀️ ⛅ ☔ ❄️ 🌈") }
];

/** недавно использованные: хранятся в браузере, до 24 штук */
const RECENT_KEY = "bafia.emoji.recent";
export function loadRecentEmoji(): string[] {
  try { return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown[]).filter((item): item is string => typeof item == "string").slice(0, 24); } catch { return []; }
}
export function rememberEmoji(emoji: string): string[] {
  const next = [emoji, ...loadRecentEmoji().filter(item => item != emoji)].slice(0, 24);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* без хранилища просто не запоминаем */ }
  return next;
}

/** убирает последний символ (смайлик целиком) перед курсором: `caret` - позиция; возвращает новый текст и позицию */
export function backspaceAt(text: string, caret: number): { text: string, caret: number } {
  if(caret <= 0) return { text, caret: 0 };
  const before = text.slice(0, caret);
  const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(before)];
  const last = segments.at(-1)?.segment.length ?? 1;
  return { text: before.slice(0, before.length - last) + text.slice(caret), caret: before.length - last };
}
