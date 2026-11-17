/**
 * The notepad's script view (2026-11-16): the notes read one slide at a time.
 *
 * Someone presenting pastes their script into the notepad, one part per slide,
 * and steps through it with the Next slide / Previous slide shortcuts
 * (KeybindManager 'notes:nextSlide', 'notes:prevSlide') or the view's own
 * arrows. Nothing here asks a model: the text shown is the text written.
 *
 * Where one slide's part ends and the next begins, by the first rule the notes
 * satisfy:
 *
 *   1. headings   the shallowest heading level in the notes ("# ", or "## "
 *                 when there is no "# "). Deeper headings stay inside a part.
 *   2. markers    with no heading at all, a line that names a slide by number
 *                 ("Slide 3", "Slide 3: Pricing", "Diapositiva 3").
 *   3. rules      with neither, a horizontal rule ("---").
 *
 * Text pasted as plain text keeps its "#" as a character, and the editor
 * writes that back escaped ("\# Slide 1"); it is read as the heading it was
 * typed as, and the same for list marks in the body, so a pasted script looks
 * like the script.
 *
 * Pure: no DOM, no platform branches (SlideScript2026_11_16.test.mjs).
 */

export interface ScriptSlide {
    /** The heading or marker line, as plain words; '' for text before the first one. */
    title: string;
    /** The part's own text, markdown. */
    body: string;
}

// An ATX heading, or one pasted as plain text and escaped by the editor.
const HEADING_RE = /^\\?(#{1,3})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
// "Slide 3", "Slide 3: Pricing", "**Slide 3 - Pricing**", "Diapositiva 3".
const MARKER_RE = /^(?:slide|diapositiva|l[aá]mina|folie|diapo)\s*(?:#|n[.ºo°]\s*)?\d+\b/i;
const RULE_RE = /^(?:-{3,}|\*{3,}|_{3,})$/;

/** A line without the emphasis marks and escapes around it. */
function plainLine(line: string): string {
    return line
        .trim()
        .replace(/^\\?[-*+][ \t]+/, '')
        .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')
        .replace(/^(\*\*|__|\*|_)(.*)\1$/, '$2')
        .trim();
}

/** A title as plain words: no emphasis marks, no trailing colon. */
function plainTitle(text: string): string {
    const noColon = (s: string) => s.replace(/[ \t]*:$/, '').trim();
    return noColon(plainLine(noColon(text.trim())));
}

/**
 * The body as the editor draws it: list marks and headings pasted as plain
 * text (written back escaped) are the marks they were typed as.
 */
function readableBody(lines: string[]): string {
    return lines
        .map((line) => line
            .replace(/^(\s*)\\([-*+#])(?=[ \t]|#)/, '$1$2')
            .replace(/^(\s*\d{1,3})\\([.)])(?=[ \t])/, '$1$2'))
        .join('\n')
        .replace(/^\n+|\s+$/g, '');
}

type Boundary = { line: number; title: string };

function boundaries(lines: string[]): Boundary[] {
    let top = 4;
    for (const line of lines) {
        const m = HEADING_RE.exec(line.trim());
        if (m) top = Math.min(top, m[1].length);
    }
    if (top < 4) {
        const marks: Boundary[] = [];
        lines.forEach((line, i) => {
            const m = HEADING_RE.exec(line.trim());
            if (m && m[1].length === top) marks.push({ line: i, title: plainTitle(m[2]) });
        });
        return marks;
    }
    const markers: Boundary[] = [];
    lines.forEach((line, i) => {
        const plain = plainLine(line);
        if (MARKER_RE.test(plain)) markers.push({ line: i, title: plainTitle(plain) });
    });
    if (markers.length > 0) return markers;
    const rules: Boundary[] = [];
    lines.forEach((line, i) => {
        if (RULE_RE.test(line.trim())) rules.push({ line: i, title: '' });
    });
    return rules;
}

/**
 * The notes as slides, in order. Text before the first heading is a part of
 * its own (untitled) when it says anything. Notes with nothing to split on
 * are one part; empty notes are none.
 */
export function splitScriptIntoSlides(markdown: string): ScriptSlide[] {
    const text = typeof markdown === 'string' ? markdown.replace(/\r\n?/g, '\n') : '';
    if (!text.trim()) return [];
    const lines = text.split('\n');
    const marks = boundaries(lines);
    if (marks.length === 0) return [{ title: '', body: readableBody(lines) }];

    const slides: ScriptSlide[] = [];
    const lead = readableBody(lines.slice(0, marks[0].line));
    if (lead) slides.push({ title: '', body: lead });
    marks.forEach((mark, i) => {
        const end = i + 1 < marks.length ? marks[i + 1].line : lines.length;
        const body = readableBody(lines.slice(mark.line + 1, end));
        // A rule only separates: two in a row, or one at the end, make no empty part.
        if (!mark.title && !body) return;
        slides.push({ title: mark.title, body });
    });
    return slides;
}

/** The slide a step lands on: one forward or back, stopping at either end. */
export function stepSlide(index: number, delta: number, count: number): number {
    if (!Number.isFinite(count) || count <= 0) return 0;
    const from = Number.isFinite(index) ? Math.trunc(index) : 0;
    const by = Number.isFinite(delta) ? Math.trunc(delta) : 0;
    return Math.min(count - 1, Math.max(0, from + by));
}

/** "Slide 3 of 12". */
export function slideCounter(index: number, count: number): string {
    if (count <= 0) return '';
    return `Slide ${stepSlide(index, 0, count) + 1} of ${count}`;
}

/** The actions the script view takes from a global shortcut (main: 'global-shortcut'). */
export const SLIDE_SHORTCUT_STEPS: Readonly<Record<string, number>> = { nextSlide: 1, prevSlide: -1 };
