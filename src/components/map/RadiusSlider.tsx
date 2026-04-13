"use client";

type RadiusSliderProps = {
  value: number; // 미터
  onChange: (v: number) => void;
};

const STEPS = [500, 1000, 2000, 3000, 5000];

export function RadiusSlider({ value, onChange }: RadiusSliderProps) {
  const label = value >= 1000 ? `${value / 1000}km` : `${value}m`;
  return (
    <div className="px-5 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">탐색 반경</span>
        <span className="text-sm font-semibold text-violet-600">{label}</span>
      </div>
      <input
        type="range"
        min={0}
        max={STEPS.length - 1}
        value={STEPS.indexOf(value)}
        onChange={(e) => onChange(STEPS[Number(e.target.value)])}
        className="w-full accent-violet-600"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>500m</span>
        <span>5km</span>
      </div>
    </div>
  );
}
