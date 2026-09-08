import type { ParsedClass } from "@/lib/everytime/types";

type ParseResult =
  | { ok: true; classes: ParsedClass[] }
  | { ok: false; error: string; aborted?: boolean };

export async function parseTimetableImage(
  file: File,
  signal: AbortSignal,
): Promise<ParseResult> {
  const fd = new FormData();
  fd.append("image", file);

  try {
    const res = await fetch("/api/everytime/parse", { method: "POST", body: fd, signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? "시간표를 인식할 수 없었어요" };
    }
    const { data } = (await res.json()) as { data: { classes: ParsedClass[] } };
    return { ok: true, classes: data.classes };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "", aborted: true };
    }
    return { ok: false, error: "네트워크 오류가 발생했어요" };
  }
}

type ImportResult =
  | { ok: true; classCount: number; insertedCount: number }
  | { ok: false; error: string };

export async function importEverytimeClasses(
  classes: ParsedClass[],
  semesterStart: string,
  semesterEnd: string,
): Promise<ImportResult> {
  try {
    const res = await fetch("/api/everytime/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classes, semesterStart, semesterEnd }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? "저장에 실패했어요" };
    }
    const { data } = (await res.json()) as {
      data: { insertedCount: number; classCount: number };
    };
    return { ok: true, classCount: data.classCount, insertedCount: data.insertedCount };
  } catch {
    return { ok: false, error: "네트워크 오류가 발생했어요" };
  }
}
