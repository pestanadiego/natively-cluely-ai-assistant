import React from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { NotesEditor } from './NotesEditor';
import { slideCounter, type ScriptSlide } from './slideScript';

/**
 * The notepad's script view (2026-11-16, slideScript.ts): the notes read one
 * slide's part at a time, in type large enough to glance at while presenting.
 *
 *  - NotesScriptBar sits above the page and never scrolls: "Slide 3 of 12",
 *    previous and next, and an X back to the notes. The two arrows show the
 *    global shortcuts as bound now, or say that the keys are taken.
 *  - NotesScriptPage is the part itself: its title, then its text drawn by the
 *    notes' own editor, read-only, so lists, checkboxes and bold look as they
 *    do in the notes. Under it, the title of what comes next.
 *
 * Nothing here takes focus (the window is typed into through the keyboard
 * hook, and the slideshow keeps focus): the arrows are clicked, or the
 * shortcuts pressed from anywhere.
 */

const ink = (v: string): React.CSSProperties => ({ color: `var(${v})` });
const smallBtn = 'w-6 h-6 rounded-full flex items-center justify-center transition-colors np-wash disabled:opacity-35';

export interface NotesScriptKeys {
    /** The shortcut's keys as shown ("⌘", "⌥", "↓"); empty when it has none. */
    next: string[];
    prev: string[];
    /** The OS did not hand one of them over (or global shortcuts are off). */
    unavailable: boolean;
}

export const NotesScriptBar: React.FC<{
    index: number;
    count: number;
    keys: NotesScriptKeys | null;
    onStep: (delta: number) => void;
    onExit: () => void;
}> = ({ index, count, keys, onStep, onExit }) => {
    const label = (name: string, shown: string[] | undefined) => (shown && shown.length > 0 ? `${name} (${shown.join(' ')})` : name);
    const hint = !keys
        ? ''
        : keys.unavailable
            ? 'Shortcuts unavailable: set them in Settings › Keybinds'
            : keys.next.length > 0
                ? `${keys.next.join(' ')} next`
                : '';
    return (
        <div className="np-outline shrink-0 mx-7 mt-3 flex items-center gap-1 h-8 pl-3 pr-1 rounded-full" role="toolbar" aria-label="Script by slide">
            <span className="text-[12px] font-medium tabular-nums shrink-0" style={ink('--np-ink')} aria-live="polite">
                {count > 0 ? slideCounter(index, count) : 'No slides yet'}
            </span>
            <span className="flex-1 min-w-0 truncate text-right text-[11px] px-1" style={ink('--np-ink-tertiary')}>{hint}</span>
            <button type="button" aria-label={label('Previous slide', keys?.prev)} title={label('Previous slide', keys?.prev)} disabled={index <= 0} onClick={() => onStep(-1)} className={smallBtn} style={ink('--np-ink-secondary')}>
                <ChevronUp className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            <button type="button" aria-label={label('Next slide', keys?.next)} title={label('Next slide', keys?.next)} disabled={index >= count - 1} onClick={() => onStep(1)} className={smallBtn} style={ink('--np-ink-secondary')}>
                <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            <button type="button" aria-label="Back to notes" title="Back to notes" onClick={onExit} className={smallBtn} style={ink('--np-ink-secondary')}>
                <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
        </div>
    );
};

const noop = () => {};

export const NotesScriptPage: React.FC<{
    slides: readonly ScriptSlide[];
    index: number;
}> = ({ slides, index }) => {
    const slide = slides[index];
    if (!slide) {
        return (
            <div className="np-script px-8 pt-[19px] pb-36">
                <p className="text-[15px] leading-[1.5]" style={ink('--np-ink-secondary')}>
                    Nothing to show yet. Go back to the notes and write your script, with a heading for each slide (type "# " at the start of a line).
                </p>
            </div>
        );
    }
    const next = slides[index + 1];
    return (
        <div className="np-script px-8 pt-[19px] pb-36" data-slide-index={index}>
            {slide.title && <h2 className="np-script-title" style={ink('--np-ink-strong')}>{slide.title}</h2>}
            {slide.body && (
                <NotesEditor
                    // One editor per slide: the part is set once, never edited here.
                    key={index}
                    value={slide.body}
                    onChange={noop}
                    editable={false}
                    hookTyping={false}
                />
            )}
            {slides.length === 1 && (
                <p className="mt-6 text-[12px] leading-4" style={ink('--np-ink-tertiary')}>
                    The whole script is one part. Start each slide's part with a heading (type "# " at the start of a line) to step through it.
                </p>
            )}
            {next && (
                <p className="np-script-next mt-6 text-[12px] leading-4 truncate" style={ink('--np-ink-tertiary')}>
                    {`Next: ${next.title || (next.body.split('\n').find((l) => l.trim()) ?? '').replace(/^[#\-*+\s\d.)\[\]x]+/i, '').slice(0, 80) || `slide ${index + 2}`}`}
                </p>
            )}
        </div>
    );
};
