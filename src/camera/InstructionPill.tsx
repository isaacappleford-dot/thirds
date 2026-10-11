import { Icon } from '../components/Icon';
import type { Instruction } from '../guidance/advisor';

const ACTION_LABEL: Record<NonNullable<Instruction['action']>, string> = {
  'zoom-in': 'Zoom',
  'zoom-out': '1×',
  'ev-down': 'Fix',
  'ev-up': 'Fix',
  'tap-subject': 'Fix',
};

/** The single live instruction. Announced politely to screen readers. */
export function InstructionPill({ instruction, onAction }: { instruction: Instruction | null; onAction: (i: Instruction) => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {instruction?.text ?? ''}
      </div>
      {instruction && (
        <div
          key={instruction.id}
          className={`pointer-events-auto flex min-h-[40px] max-w-full items-center gap-2 rounded-full py-1.5 pl-3 text-[14px] font-medium shadow-lg backdrop-blur-md motion-safe:animate-[fadein_200ms_ease-out] ${
            instruction.id === 'locked' ? 'bg-lock/90 text-ink' : 'bg-black/55 text-white'
          } ${instruction.action ? 'pr-1.5' : 'pr-4'}`}
          aria-hidden="true"
        >
          {instruction.arrow !== undefined && instruction.id === 'move' && (
            <span style={{ transform: `rotate(${instruction.arrow}deg)` }} className="inline-flex transition-transform duration-300">
              <Icon name="arrow" size={18} strokeWidth={2.4} />
            </span>
          )}
          {instruction.id === 'locked' && <Icon name="check" size={18} strokeWidth={2.4} />}
          <span className="truncate">{instruction.text}</span>
          {instruction.action && (
            <button
              type="button"
              onClick={() => onAction(instruction)}
              className="ml-1 min-h-[32px] rounded-full bg-white px-3 text-[13px] font-semibold text-ink"
              aria-label={`${ACTION_LABEL[instruction.action]}: ${instruction.text}`}
            >
              {ACTION_LABEL[instruction.action]}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
