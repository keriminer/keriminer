import type { ImageProvider } from "./index";
import type { AspectRatio } from "../types";

const SIZE: Record<AspectRatio, [number, number]> = {
  "4:5": [800, 1000],
  "9:16": [720, 1280],
  "1:1": [900, 900],
  "16:9": [1280, 720],
};

const PALETTES = [
  ["#E8D5C4", "#B5654A"],
  ["#D9E4DD", "#4E7D6B"],
  ["#E6DFF0", "#6C5B9E"],
  ["#F3E3C3", "#C08A2E"],
  ["#DCE6F0", "#3F6E9C"],
];

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max) {
      lines.push(line.trim());
      line = w;
    } else line += " " + w;
    if (lines.length === 5) break;
  }
  if (lines.length < 5 && line.trim()) lines.push(line.trim());
  return lines;
}

export const mockProvider: ImageProvider = {
  name: "mock",

  async generate({ prompt, aspectRatio }) {
    await new Promise((r) => setTimeout(r, 2500 + Math.random() * 2500));
    const [w, h] = SIZE[aspectRatio];
    const [bg, fg] = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    const scene = prompt.match(/(?:Scene|Brief): (.*)/)?.[1] ?? "Séance photo";
    const lines = wrap(scene, Math.round(w / 22));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${fg}" stop-opacity="0.55"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<circle cx="${w / 2}" cy="${h * 0.38}" r="${Math.min(w, h) * 0.13}" fill="${fg}" opacity="0.85"/>
<path d="M ${w / 2 - Math.min(w, h) * 0.26} ${h * 0.78} Q ${w / 2} ${h * 0.46} ${w / 2 + Math.min(w, h) * 0.26} ${h * 0.78} Z" fill="${fg}" opacity="0.85"/>
<text x="24" y="40" font-family="sans-serif" font-size="18" font-weight="700" fill="#1c1917" opacity="0.75">MODE DÉMO · ${aspectRatio}</text>
${lines.map((l, i) => `<text x="24" y="${h - 24 - (lines.length - 1 - i) * 24}" font-family="sans-serif" font-size="17" fill="#1c1917">${escapeXml(l)}</text>`).join("\n")}
</svg>`;
    return { mimeType: "image/svg+xml", data: Buffer.from(svg) };
  },

  async analyzeReference() {
    await new Promise((r) => setTimeout(r, 1200));
    return {
      brief:
        "Seated three-quarter portrait in a sunlit minimalist café, linen shirt in soft neutral tones, one elbow resting on a light oak table, head slightly tilted, warm window light from camera left, 50mm lens at f/1.8 with creamy background bokeh, soft warm color grade, relaxed and approachable mood.",
      energy: "warm",
      suggestedRatio: "4:5",
    };
  },
};
