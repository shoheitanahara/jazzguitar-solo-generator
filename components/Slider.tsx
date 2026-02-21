"use client";

import * as React from "react";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
};

export function Slider(props: Props) {
  const { label, value, min, max, step, onChange, format } = props;
  return (
    <label className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-zinc-900 dark:accent-zinc-100"
      />
    </label>
  );
}

