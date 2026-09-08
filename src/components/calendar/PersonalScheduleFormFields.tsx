import { cn } from "@/lib/utils";

type Props = {
  title: string;
  onTitleChange: (v: string) => void;
  date: string;
  onDateChange: (v: string) => void;
  isAllDay: boolean;
  onAllDayChange: (v: boolean) => void;
  startTime: string;
  onStartTimeChange: (v: string) => void;
  endTime: string;
  onEndTimeChange: (v: string) => void;
  memo: string;
  onMemoChange: (v: string) => void;
  error: string | null;
};

const inputClass =
  "w-full h-11 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-violet-500";
const labelClass =
  "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

export function PersonalScheduleFormFields({
  title,
  onTitleChange,
  date,
  onDateChange,
  isAllDay,
  onAllDayChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  memo,
  onMemoChange,
  error,
}: Props) {
  return (
    <>
      <div>
        <label className={labelClass}>제목</label>
        <input
          type="text"
          maxLength={80}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="예: 치과 예약"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>날짜</label>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className={inputClass}
        />
      </div>

      <label className="flex items-center justify-between min-h-11 px-1">
        <span className="text-sm text-gray-700 dark:text-gray-200">종일</span>
        <input
          type="checkbox"
          checked={isAllDay}
          onChange={(e) => onAllDayChange(e.target.checked)}
          className="h-5 w-5 accent-violet-600"
        />
      </label>

      <div className={cn("grid grid-cols-2 gap-3", isAllDay && "opacity-40 pointer-events-none")}>
        <div>
          <label className={labelClass}>시작</label>
          <input
            type="time"
            step={1800}
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>종료</label>
          <input
            type="time"
            step={1800}
            value={endTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>메모 (선택)</label>
        <textarea
          maxLength={200}
          value={memo}
          onChange={(e) => onMemoChange(e.target.value)}
          rows={3}
          placeholder="장소, 준비물 등"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-violet-500 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </>
  );
}
