// The notepad's script view (2026-11-16): the notes split into one part per
// slide and stepped through. Pure logic, the same on macOS and Windows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLIDE_SHORTCUT_STEPS, slideCounter, splitScriptIntoSlides, stepSlide } from '../slideScript.ts';

test('each top-level heading starts a slide; its text is the part under it', () => {
    const slides = splitScriptIntoSlides('# Intro\n- Welcome everyone\n- Why we are here\n\n# Pricing\nThree plans.\n\n# Close\n');
    assert.deepEqual(slides, [
        { title: 'Intro', body: '- Welcome everyone\n- Why we are here' },
        { title: 'Pricing', body: 'Three plans.' },
        { title: 'Close', body: '' },
    ]);
});

test('deeper headings stay inside the slide they belong to', () => {
    const slides = splitScriptIntoSlides('# Slide 1\n## Hook\n- a\n## Bridge\n- b\n# Slide 2\n- c');
    assert.equal(slides.length, 2);
    assert.equal(slides[0].body, '## Hook\n- a\n## Bridge\n- b');
    assert.equal(slides[1].title, 'Slide 2');
});

test('notes with only "## " headings split at those', () => {
    const slides = splitScriptIntoSlides('## One\na\n## Two\nb\n### Detail\nc');
    assert.deepEqual(slides.map((s) => s.title), ['One', 'Two']);
    assert.equal(slides[1].body, 'b\n### Detail\nc');
});

test('text before the first heading is a part of its own, untitled', () => {
    const slides = splitScriptIntoSlides('Breathe. Smile.\n\n# Intro\nHello');
    assert.deepEqual(slides, [{ title: '', body: 'Breathe. Smile.' }, { title: 'Intro', body: 'Hello' }]);
});

test('a heading pasted as plain text (written back escaped) is still a heading, and so are its list marks', () => {
    const slides = splitScriptIntoSlides('\\# Slide 1\n\n\\- first point\n\n\\- second point\n\n\\# Slide 2\n\n1\\. only point');
    assert.deepEqual(slides, [
        { title: 'Slide 1', body: '- first point\n\n- second point' },
        { title: 'Slide 2', body: '1. only point' },
    ]);
});

test('with no heading, a line naming a slide by number starts one (English and Spanish)', () => {
    const slides = splitScriptIntoSlides('Slide 1: Welcome\n- hi\n\n**Slide 2 - Pricing**\n- plans\n\nDiapositiva 3\n- cierre');
    assert.deepEqual(slides, [
        { title: 'Slide 1: Welcome', body: '- hi' },
        { title: 'Slide 2 - Pricing', body: '- plans' },
        { title: 'Diapositiva 3', body: '- cierre' },
    ]);
});

test('a sentence that only mentions a slide is not a marker', () => {
    const slides = splitScriptIntoSlides('Slide 1\nAs the next slide shows, 3 plans.\nSee slide 2 for more.\nSlide 2\nDone');
    assert.deepEqual(slides.map((s) => s.title), ['Slide 1', 'Slide 2']);
    assert.equal(slides[0].body, 'As the next slide shows, 3 plans.\nSee slide 2 for more.');
});

test('headings win over markers: a "Slide 2" line under a heading is body text', () => {
    const slides = splitScriptIntoSlides('# Opening\nSlide 2 comes next\n# Second\nx');
    assert.deepEqual(slides.map((s) => s.title), ['Opening', 'Second']);
    assert.equal(slides[0].body, 'Slide 2 comes next');
});

test('with neither, a horizontal rule separates the parts and never makes an empty one', () => {
    const slides = splitScriptIntoSlides('first\n\n---\n\nsecond\n\n---\n---\n\nthird\n\n---\n');
    assert.deepEqual(slides, [
        { title: '', body: 'first' },
        { title: '', body: 'second' },
        { title: '', body: 'third' },
    ]);
});

test('nothing to split on is one part; empty notes are none; Windows line endings read the same', () => {
    assert.deepEqual(splitScriptIntoSlides('just a line\nand another'), [{ title: '', body: 'just a line\nand another' }]);
    assert.deepEqual(splitScriptIntoSlides(''), []);
    assert.deepEqual(splitScriptIntoSlides('  \n\n'), []);
    assert.deepEqual(splitScriptIntoSlides(undefined), []);
    assert.deepEqual(splitScriptIntoSlides('# A\r\none\r\n# B\r\ntwo'), [{ title: 'A', body: 'one' }, { title: 'B', body: 'two' }]);
});

test('a title is plain words: no emphasis, no closing hashes, no trailing colon', () => {
    const slides = splitScriptIntoSlides('# **Pricing**:\nx\n# Roadmap ##\ny');
    assert.deepEqual(slides.map((s) => s.title), ['Pricing', 'Roadmap']);
});

test('stepping stops at both ends and survives a shorter script', () => {
    assert.equal(stepSlide(0, 1, 3), 1);
    assert.equal(stepSlide(2, 1, 3), 2);
    assert.equal(stepSlide(0, -1, 3), 0);
    assert.equal(stepSlide(7, 0, 3), 2, 'the script got shorter under the view');
    assert.equal(stepSlide(1, 1, 0), 0);
    assert.equal(stepSlide(Number.NaN, 1, 3), 1);
});

test('the counter reads as a person counts', () => {
    assert.equal(slideCounter(0, 12), 'Slide 1 of 12');
    assert.equal(slideCounter(40, 12), 'Slide 12 of 12');
    assert.equal(slideCounter(0, 0), '');
});

test('the shortcut actions map to one step each way', () => {
    assert.deepEqual({ ...SLIDE_SHORTCUT_STEPS }, { nextSlide: 1, prevSlide: -1 });
});
