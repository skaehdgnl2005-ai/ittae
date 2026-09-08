"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/Button";
import {
  SEMESTER_PRESETS,
  getDefaultSemesterPreset,
  type SemesterPreset,
} from "@/lib/everytime/constants";
import { type ParsedClass } from "@/lib/everytime/types";
import { EverytimeUploadStep } from "@/components/calendar/EverytimeUploadStep";
import {
  EverytimePreviewStep,
  type PreviewItem,
} from "@/components/calendar/EverytimePreviewStep";
import { EverytimeProgressStep } from "@/components/calendar/EverytimeProgressStep";
import {
  flagOf,
  MAX_BYTES,
  type Step,
} from "@/components/calendar/everytime-import-utils";
import {
  parseTimetableImage,
  importEverytimeClasses,
} from "@/components/calendar/everytime-import-api";

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

    const range = resolveSemesterRange();
    if (!range) {
      setError("학기 날짜를 먼저 선택해 주세요");
      return;
    }
    if (range.start > range.end) {
      setError("학기 종료일이 시작일보다 빨라요");
      return;
    }

    setStep("analyzing");
    const ac = new AbortController();
    abortRef.current = ac;

    const result = await parseTimetableImage(file, ac.signal);
    if (!result.ok) {
      if (!result.aborted) setError(result.error);
      setStep("upload");
      return;
    }
    setItems(
      result.classes.map((c) => {
        const flag = flagOf(c);
        return { ...c, checked: flag === null, flag };
      }),
    );
    setStep("preview");
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
    const result = await importEverytimeClasses(selected, range.start, range.end);
    if (!result.ok) {
      setError(result.error);
      setStep("preview");
      return;
    }
    onClose();
    router.refresh();
    // 디자인 시스템에 토스트 도입 전까지 alert로 임시 처리
    alert(`${result.classCount}개 수업이 학기 동안 추가됐어요`);
  }

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[90dvh] p-0 flex flex-col"
        showCloseButton={false}
      >
        <SheetHeader className="flex-none border-b border-gray-100 dark:border-gray-700">
          <SheetTitle className="text-base font-semibold text-gray-800 dark:text-gray-100">
            에브리타임 시간표 가져오기
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
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
            <EverytimeProgressStep
              label="시간표 읽는 중…"
              onCancel={() => abortRef.current?.abort()}
            />
          )}

          {step === "preview" && (
            <EverytimePreviewStep
              items={items}
              hasExistingEverytime={hasExistingEverytime}
              existingCount={existingCount}
              error={error}
              onUpdate={updateItem}
              onToggle={toggleItem}
            />
          )}

          {step === "saving" && <EverytimeProgressStep label="저장 중…" />}
        </div>

        {step === "preview" && (
          <div className="flex-none border-t border-gray-100 dark:border-gray-700 p-4 flex flex-col gap-2 bg-white dark:bg-gray-900">
            <Button variant="primary" onClick={handleImport} disabled={checkedCount === 0}>
              {checkedCount}개 추가
            </Button>
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
