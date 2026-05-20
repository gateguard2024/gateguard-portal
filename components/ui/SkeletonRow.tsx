"use client";

import React from "react";

const WIDTHS = ["w-1/3", "w-1/4", "w-1/2", "w-1/5"];

interface SkeletonRowProps {
  cols?: number;
  rows?: number;
}

function SkeletonRow({ cols = 4, rows = 5 }: SkeletonRowProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-4 py-3 border-b border-border px-4"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div
              key={colIdx}
              className={`bg-muted animate-pulse rounded h-4 ${WIDTHS[colIdx % WIDTHS.length]}`}
            />
          ))}
        </div>
      ))}
    </>
  );
}

export { SkeletonRow };
export default SkeletonRow;
