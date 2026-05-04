"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SEMESTER_PRESETS,
  getDefaultSemesterPreset,
  type SemesterPreset,
} from "@/lib/everytime/constants";
import {
  DAYS_OF_WEEK,
  type ParsedClass,
} from "@/lib/everytime/types";
import { EverytimeUploadStep } from "@/components/calendar/EverytimeUploadStep";
import {
  EverytimePreviewStep,
  type PreviewItem,
} from "@/components/calendar/EverytimePreviewStep";

type Step = "upload" | "analyzing" | "preview" | "saving";

const MAX_BYTES = 5 * 1024 * 1024;
const TIME_RE = /^\d{2}:\d{2}$/;

function flagOf(c: ParsedClass): PreviewItem["flag"] {
  if (!c.title.trim()) return "missing_title";
  if (!DAYS_OF_WEEK.includes(c.dayOfWeek)) return "invalid_day";
  if (!TIME_RE.test(c.startTime) || !TIME_RE.test(c.endTime)) return "invalid_time";
  if (c.startTime >= c.endTime) return "end_before_start";
  return null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  hasExistingEverytime: boolean;
  existingCount: number;
};

export function EverytimeImportSheet({ open, onClose, hasExistingEverytime, existingCount }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [presetId, setPresetId] = useState<SemesterPreset["id"] | "custom">(
    getDefaultSemesterPreset(new Date()).id
  );
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 부모가 open 토글마다 conditional-mount 하므로 매번 fresh state로 시작.
  // unmount 시점에만 in-flight fetch abort.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function resolveSemesterRange(): { start: string; end: string } | null {
    if (presetId === "custom") {
      if (!customStart || !customEnd) return null;
      return { start: customStart, end: customEnd };
    }
    const p = SEMESTER_PRESETS.find((x) => x.id === presetId)!;
    return { start: p.start, end: p.end };
  }

  async function handleFileSelected(file: File) {
    setError(null);

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("jpg/png 이미지만 지원해요");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("5MB 이하 이미지만 지원해요");
      return;
    }

    setStep("analyzing");
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/everytime/parse", {
        method: "POST",
        body: fd,
        signal: ac.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "시간표를 인식할 수 없었어요");
        setStep("upload");
        return;
      }

      const { data } = (await res.json()) as { data: { classes: ParsedClass[] } };
      const previewItems: PreviewItem[] = data.classes.map((c) => {
        const flag = flagOf(c);
        return { ...c, checked: flag === null, flag };
      });
      setItems(previewItems);
      setStep("preview");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStep("upload");
        return;
      }
      setError("네트워크 오류가 발생했어요");
      setStep("upload");
    }
  }

  function updateItem(index: number, patch: Partial<ParsedClass>) {
    setItems((prev) => {
      const next = [...prev];
      const merged = { ...next[index], ...patch };
      const newFlag = flagOf(merged);
      next[index] = { ...merged, flag: newFlag, checked: merged.checked && newFlag === null };
      return next;
    });
  }

  function toggleItem(index: number) {
    setItems((prev) => {
      const next = [...prev];
      const it = next[index];
      if (it.flag !== null) return prev;
      next[index] = { ...it, checked: !it.checked };
      return next;
    });
  }

  async function handleImport() {
    setError(null);
    const range = resolveSemesterRange();
    if (!range) {
      setError("학기 날짜를 선택해 주세요");
      return;
    }
    if (range.start > range.end) {
      setError("학기 종료일이 시작일보다 빨라요");
      return;
    }

    const selected = items
      .filter((it) => it.checked && it.flag === null)
      .map<ParsedClass>(({ title, dayOfWeek, startTime, endTime, location }) => ({
        title: title.trim(),
        dayOfWeek,
        startTime,
        endTime,
        location: location?.trim() || null,
      }));

    if (selected.length === 0) {
      setError("추가할 수업이 없어요");
      return;
    }

    setStep("saving");
    try {
      const res = await fetch("/api/everytime/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classes: selected,
          semesterStart: range.start,
          semesterEnd: range.end,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "저장에 실패했어요");
        setStep("preview");
        return;
      }

      const { data } = (await res.json()) as {
        data: { insertedCount: number; classCount: number };
      };
      onClose();
      router.refresh();
      // 디자인 시스템에 토스트 도입 전까지 alert로 임시 처리
      alert(`${data.classCount}개 수업이 학기 동안 추가됐어요`);
    } catch {
      setError("네트워크 오류가 발생했어요");
      setStep("preview");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[90dvh] overflow-y-auto p-0"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-gray-100 dark:border-gray-700">
          <SheetTitle className="text-base font-semibold text-gray-800 dark:text-gray-100">
            에브리타임 시간표 가져오기
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-4">
          {step === "upload" && (
            <EverytimeUploadStep
              presetId={presetId}
              onPresetChange={setPresetId}
              customStart={customStart}
              customEnd={customEnd}
              onCustomStartChange={setCustomStart}
              onCustomEndChange={setCustomEnd}
              onFileSelected={(f) => void handleFileSelected(f)}
              error={error}
            />
          )}

          {step === "analyzing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              <p className="text-sm text-gray-700 dark:text-gray-200">시간표 읽는 중…</p>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="text-xs text-gray-400 underline min-h-11 px-2"
              >
                취소
              </button>
            </div>
          )}

          {step === "preview" && (
            <EverytimePreviewStep
              items={items}
              hasExistingEverytime={hasExistingEverytime}
              existingCount={existingCount}
              error={error}
              onUpdate={updateItem}
              onToggle={toggleItem}
              onImport={handleImport}
              onCancel={onClose}
            />
          )}

          {step === "saving" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              <p className="text-sm text-gray-700 dark:text-gray-200">저장 중…</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
