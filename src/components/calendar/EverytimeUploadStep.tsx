"use client";
import {
  SEMESTER_PRESETS,
  type SemesterPreset,
} from "@/lib/everytime/constants";

type Props = {
  presetId: SemesterPreset["id"] | "custom";
  onPresetChange: (id: SemesterPreset["id"] | "custom") => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  onFileSelected: (file: File) => void;
  error: string | null;
};

export function EverytimeUploadStep({
  presetId,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  onFileSelected,
  error,
}: Props) {
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          학기
        </label>
        <div className="flex flex-col gap-2">
          {SEMESTER_PRESETS.map((p) => (
            <label key={p.id} className="flex items-center min-h-11 gap-2 cursor-pointer">
              <input
                type="radio"
                name="preset"
                checked={presetId === p.id}
                onChange={() => onPresetChange(p.id)}
                className="h-5 w-5 accent-violet-600"
              />
              <span className="text-sm text-gray-800 dark:text-gray-100">
                {p.label}
                <span className="text-gray-400 ml-2">{p.start} ~ {p.end}</span>
              </span>
            </label>
          ))}
          <label className="flex items-center min-h-11 gap-2 cursor-pointer">
            <input
              type="radio"
              name="preset"
              checked={presetId === "custom"}
              onChange={() => onPresetChange("custom")}
              className="h-5 w-5 accent-violet-600"
            />
            <span className="text-sm text-gray-800 dark:text-gray-100">직접 선택</span>
          </label>
          {presetId === "custom" && (
            <div className="grid grid-cols-2 gap-2 pl-7">
              <input
                type="date"
                value={customStart}
                onChange={(e) => onCustomStartChange(e.target.value)}
                className="h-11 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => onCustomEndChange(e.target.value)}
                className="h-11 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="everytime-image"
          className="flex flex-col items-center justify-center min-h-32 px-4 py-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span className="text-sm text-gray-700 dark:text-gray-200">
            시간표 스크린샷 선택
          </span>
          <span className="text-xs text-gray-400 mt-1">jpg / png · 5MB 이하</span>
        </label>
        <input
          id="everytime-image"
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFileSelected(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </>
  );
}
