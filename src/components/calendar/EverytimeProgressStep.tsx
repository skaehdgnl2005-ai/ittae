type Props = {
  label: string;
  onCancel?: () => void;
};

export function EverytimeProgressStep({ label, onCancel }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      <p className="text-sm text-gray-700 dark:text-gray-200">{label}</p>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-400 underline min-h-11 px-2"
        >
          취소
        </button>
      )}
    </div>
  );
}
