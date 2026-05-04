import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth";
import { parseTimetableImage, GeminiParseError } from "@/lib/gemini/client";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);
const MAX_CLASSES = 30;

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return NextResponse.json({ error: "5MB 이하 이미지만 지원해요" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "이미지가 없어요" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "jpg/png 이미지만 지원해요" }, { status: 415 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "5MB 이하 이미지만 지원해요" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const classes = await parseTimetableImage(buffer, file.type);

    if (classes.length > MAX_CLASSES) {
      return NextResponse.json(
        { error: "시간표가 아닌 이미지로 보여요" },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: { classes } });
  } catch (err) {
    if (err instanceof GeminiParseError) {
      return NextResponse.json(
        { error: "시간표를 인식할 수 없었어요. 더 선명한 사진으로 다시 시도해주세요" },
        { status: 422 }
      );
    }
    console.error("[/api/everytime/parse] Gemini call failed:", err);
    return NextResponse.json(
      { error: "OCR 서버에 일시적인 문제가 있어요" },
      { status: 502 }
    );
  }
}
