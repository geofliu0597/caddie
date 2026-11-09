import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Small (i) dot for a title row; tapping opens a short explainer. Tap
 * anywhere outside to dismiss. The dot right-aligns to its row, and the
 * dialog opens under it, extending left — so place the dot at the right edge
 * of its row to keep the dialog on-screen.
 */
export function InfoTip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="More info"
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-turf-500 text-[11px] font-semibold text-turf-300 active:bg-turf-600"
      >
        i
      </button>
      {open && (
        <>
          {/* tap anywhere outside to dismiss */}
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-10 w-56 rounded-xl border border-turf-600 bg-turf-700 p-3 text-xs leading-relaxed text-turf-200 shadow-xl">
            {children}
          </div>
        </>
      )}
    </div>
  );
}
