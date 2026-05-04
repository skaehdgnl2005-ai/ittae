import { GoogleGenAI, Type } from "@google/genai";
import { EVERYTIME_TIMETABLE_PROMPT } from "@/lib/gemini/prompts/everytime";
import type { ParsedClass } from "@/lib/everytime/types";

let cached: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY env var not set");
  if (!cached) cached = new GoogleGenAI({ apiKey: key });
  return cached;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    classes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          dayOfWeek: {
            type: Type.STRING,
            enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
          },
          startTime: { type: Type.STRING, description: "HH:MM 24h, 항상 2자리" },
          endTime: { type: Type.STRING, description: "HH:MM 24h, 항상 2자리" },
          location: { type: Type.STRING, nullable: true },
        },
        required: ["title", "dayOfWeek", "startTime", "endTime"],
      },
    },
  },
  required: ["classes"],
};

type GeminiClassRaw = {
  title?: unknown;
  dayOfWeek?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  location?: unknown;
};

export class GeminiParseError extends Error {}

const TIME_RE = /^\d{2}:\d{2}$/;
const DOW = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

function isValidParsedClass(raw: GeminiClassRaw): raw is ParsedClass {
  return (
    typeof raw.title === "string" &&
    raw.title.trim().length > 0 &&
    typeof raw.dayOfWeek === "string" &&
    DOW.has(raw.dayOfWeek) &&
    typeof raw.startTime === "string" &&
    TIME_RE.test(raw.startTime) &&
    typeof raw.endTime === "string" &&
    TIME_RE.test(raw.endTime) &&
    raw.startTime < raw.endTime &&
    (raw.location === null || raw.location === undefined || typeof raw.location === "string")
  );
}

/**
 * 이미지 buffer를 Gemini 2.5 Flash로 보내 시간표 entry 배열로 파싱.
 * 응답이 schema에 안 맞거나 0개면 GeminiParseError throw.
 *
 * NOTE: 실제 Gemini 호출 검증(PoC)은 GEMINI_API_KEY 주입 후 Task 11에서 진행 예정.
 */
export async function parseTimetableImage(
  buffer: Buffer,
  mimeType: string
): Promise<ParsedClass[]> {
  const client = getClient();
  const base64 = buffer.toString("base64");

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: EVERYTIME_TIMETABLE_PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new GeminiParseError("Gemini empty response");

  let parsed: { classes?: GeminiClassRaw[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiParseError("Gemini returned non-JSON");
  }

  if (!Array.isArray(parsed.classes)) {
    throw new GeminiParseError("missing classes array");
  }

  const valid = parsed.classes.filter(isValidParsedClass);
  if (valid.length === 0) {
    throw new GeminiParseError("no valid classes detected");
  }

  return valid.map((c) => ({
    title: c.title.trim(),
    dayOfWeek: c.dayOfWeek,
    startTime: c.startTime,
    endTime: c.endTime,
    location: c.location?.toString().trim() || null,
  }));
}
