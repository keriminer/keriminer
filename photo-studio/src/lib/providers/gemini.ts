import { GoogleGenAI } from "@google/genai";
import type { ImageProvider, ReferenceAnalysis } from "./index";
import { ProviderError } from "./index";
import { REFERENCE_ANALYSIS_INSTRUCTIONS } from "../prompt";

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

const imageModel = () => process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
const textModel = () => process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

export const geminiProvider: ImageProvider = {
  name: "gemini",

  async generate({ prompt, references, aspectRatio }) {
    const res = await ai()
      .models.generateContent({
        model: imageModel(),
        contents: [
          {
            role: "user",
            parts: [
              ...references.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.base64 } })),
              { text: `The images above are identity references of the same person.\n\n${prompt}` },
            ],
          },
        ],
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
      })
      .catch((err: unknown) => {
        throw new ProviderError(err instanceof Error ? err.message : "Erreur Gemini", "provider_error");
      });

    if (res.promptFeedback?.blockReason) {
      throw new ProviderError(`Bloqué : ${res.promptFeedback.blockReason}`, "generation_blocked");
    }
    const candidate = res.candidates?.[0];
    const part = candidate?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) {
      const reason = candidate?.finishReason ?? "aucune image renvoyée";
      const blocked = /SAFETY|PROHIBITED|BLOCK|IMAGE_OTHER/i.test(String(reason));
      throw new ProviderError(`Génération impossible (${reason})`, blocked ? "generation_blocked" : "provider_error");
    }
    return { mimeType: part.inlineData.mimeType ?? "image/png", data: Buffer.from(part.inlineData.data, "base64") };
  },

  async analyzeReference(image) {
    const res = await ai()
      .models.generateContent({
        model: textModel(),
        contents: [
          {
            role: "user",
            parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: REFERENCE_ANALYSIS_INSTRUCTIONS }],
          },
        ],
        config: { responseMimeType: "application/json", temperature: 0.4 },
      })
      .catch((err: unknown) => {
        throw new ProviderError(err instanceof Error ? err.message : "Erreur Gemini", "provider_error");
      });
    try {
      const parsed = JSON.parse(res.text ?? "{}") as Partial<ReferenceAnalysis>;
      if (!parsed.brief) throw new Error("brief vide");
      return {
        brief: parsed.brief,
        energy: parsed.energy === "polished" ? "polished" : "warm",
        suggestedRatio: ["4:5", "9:16", "1:1", "16:9"].includes(parsed.suggestedRatio ?? "") ? parsed.suggestedRatio! : "4:5",
      };
    } catch {
      throw new ProviderError("Analyse de la photo illisible, réessayez.", "provider_error");
    }
  },
};
