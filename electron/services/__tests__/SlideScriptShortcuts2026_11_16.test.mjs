// The notepad's script view (2026-11-16, src/components/notes/slideScript.ts):
// its Next slide / Previous slide shortcuts (KeybindManager 'notes:nextSlide',
// 'notes:prevSlide') take their keys from other apps only while the view is
// on, in the launcher and in a meeting alike. Runs the REAL compiled
// KeybindManager against a stub `electron` that records what globalShortcut
// holds. The Win32 chord table (the Windows stealth hook's copy of the same
// set) is built from the same gate, so it is asserted too: both platforms read
// one decision.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const require = createRequire(import.meta.url);

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'slide-script-shortcuts-'));
const registered = new Set();
const refused = new Set();
const fired = [];
const handlers = new Map();
const electronStub = {
    app: { getPath: () => userData, isReady: () => true, isPackaged: false, getVersion: () => '0.0.0', on() {}, whenReady: () => Promise.resolve() },
    globalShortcut: {
        register(acc, fn) { if (refused.has(acc)) return false; registered.add(acc); handlers.set(acc, fn); return true; },
        unregister(acc) { registered.delete(acc); handlers.delete(acc); },
        unregisterAll() { registered.clear(); handlers.clear(); },
        isRegistered(acc) { return registered.has(acc); },
    },
    Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {} },
    BrowserWindow: { getAllWindows: () => [] },
    ipcMain: { handle() {}, on() {}, removeHandler() {} },
};
const realLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === 'electron') return electronStub;
    return realLoad.call(this, request, ...rest);
};

let km;
let DEFAULT_KEYBINDS;
let SLIDE_SCRIPT_KEYBIND_IDS;
let acceleratorToWin32Chord;
before(() => {
    const mod = require(path.resolve(repoRoot, 'dist-electron/electron/services/KeybindManager.js'));
    ({ DEFAULT_KEYBINDS, SLIDE_SCRIPT_KEYBIND_IDS } = mod);
    ({ acceleratorToWin32Chord } = require(path.resolve(repoRoot, 'dist-electron/electron/services/winChord.js')));
    km = mod.KeybindManager.getInstance();
    km.onShortcutTriggered((id) => fired.push(id));
});

const NEXT = 'CommandOrControl+Alt+Down';
const PREV = 'CommandOrControl+Alt+Up';
const onHook = (id) => km.getGlobalChordTable().some((c) => c.id === id);

test('the two shortcuts exist, global, on keys no other default uses', () => {
    assert.deepEqual([...SLIDE_SCRIPT_KEYBIND_IDS], ['notes:nextSlide', 'notes:prevSlide']);
    const byId = new Map(DEFAULT_KEYBINDS.map((kb) => [kb.id, kb]));
    assert.equal(byId.get('notes:nextSlide').defaultAccelerator, NEXT);
    assert.equal(byId.get('notes:prevSlide').defaultAccelerator, PREV);
    assert.ok(byId.get('notes:nextSlide').isGlobal && byId.get('notes:prevSlide').isGlobal);
    const norm = (acc) => acc.toLowerCase().split('+').sort().join('+');
    for (const acc of [NEXT, PREV]) {
        const holders = DEFAULT_KEYBINDS.filter((kb) => norm(kb.defaultAccelerator) === norm(acc)).map((kb) => kb.id);
        assert.equal(holders.length, 1, `${acc} is bound once: ${holders.join(', ')}`);
    }
});

test('Windows: both defaults are inside the stealth hook\'s chord subset (Ctrl+Alt with an arrow)', () => {
    assert.deepEqual(acceleratorToWin32Chord(NEXT, 'notes:nextSlide'), { vk: 0x28, mods: 0b011, id: 'notes:nextSlide' });
    assert.deepEqual(acceleratorToWin32Chord(PREV, 'notes:prevSlide'), { vk: 0x26, mods: 0b011, id: 'notes:prevSlide' });
});

test('view off (the default): the keys are never taken, in the launcher or in a meeting, on either path', () => {
    assert.equal(km.isSlideScriptActive(), false);
    for (const mode of ['launcher', 'overlay']) {
        km.setMode(mode);
        km.refreshRegistrations();
        assert.ok(!registered.has(NEXT) && !registered.has(PREV), `${mode}: Cmd/Ctrl+Alt+Up/Down stay with the focused app`);
        assert.ok(!onHook('notes:nextSlide') && !onHook('notes:prevSlide'), `${mode}: not on the Windows hook either`);
    }
});

test('view on: registered in both modes and on the Windows chord table; a press reaches its action', () => {
    km.setSlideScriptActive(true);
    try {
        for (const mode of ['launcher', 'overlay']) {
            km.setMode(mode);
            assert.ok(registered.has(NEXT) && registered.has(PREV), `${mode}: registered`);
            assert.ok(onHook('notes:nextSlide') && onHook('notes:prevSlide'), `${mode}: on the Windows hook`);
        }
        fired.length = 0;
        handlers.get(NEXT)();
        handlers.get(PREV)();
        assert.deepEqual(fired, ['notes:nextSlide', 'notes:prevSlide']);
    } finally {
        km.setSlideScriptActive(false);
    }
    assert.ok(!registered.has(NEXT) && !registered.has(PREV), 'view off: released at once');
    assert.ok(!onHook('notes:nextSlide'), 'and off the Windows hook');
});

test('turning the view on leaves every other shortcut as it was', () => {
    km.setMode('overlay');
    const before = [...registered].sort();
    km.setSlideScriptActive(true);
    const during = [...registered].filter((acc) => acc !== NEXT && acc !== PREV).sort();
    km.setSlideScriptActive(false);
    assert.deepEqual(during, before);
    assert.deepEqual([...registered].sort(), before);
});

test('global shortcuts switched off: the slide keys are not registered either', () => {
    km.setGlobalShortcutsEnabled(false);
    try {
        km.setSlideScriptActive(true);
        assert.ok(!registered.has(NEXT) && !registered.has(PREV));
    } finally {
        km.setSlideScriptActive(false);
        km.setGlobalShortcutsEnabled(true);
    }
});

test('a key another app holds is reported as failed, so the view can say so', () => {
    refused.add(NEXT);
    try {
        km.setSlideScriptActive(true);
        const failed = km.getRegistrationFailures().map((f) => f.id);
        assert.ok(failed.includes('notes:nextSlide'), 'the refused key is on the failure list');
        assert.ok(!failed.includes('notes:prevSlide'), 'the other one registered');
        assert.ok(registered.has(PREV));
    } finally {
        refused.delete(NEXT);
        km.setSlideScriptActive(false);
    }
});

test('main routes the two actions to the notepad only, and closing the notepad leaves the view', () => {
    const main = fs.readFileSync(path.resolve(repoRoot, 'electron/main.ts'), 'utf8');
    assert.match(main, /actionId === 'notes:nextSlide' \|\| actionId === 'notes:prevSlide'[\s\S]{0,200}this\.notesWindowHelper\?\.getWindow\(\), 'global-shortcut'/);
    assert.match(main, /onClosedByUser\(\(\) => \{[\s\S]{0,600}setNotesSlideScript\(false\)\.wasOn[\s\S]{0,200}'notes-slide-script-off'/);
    const ipc = fs.readFileSync(path.resolve(repoRoot, 'electron/ipcHandlers.ts'), 'utf8');
    assert.match(ipc, /safeHandle\('notes-window:set-slide-script'/);
    const preload = fs.readFileSync(path.resolve(repoRoot, 'electron/preload.ts'), 'utf8');
    assert.match(preload, /ipcRenderer\.invoke\('notes-window:set-slide-script', on === true\)/);
    assert.match(preload, /ipcRenderer\.on\('notes-slide-script-off'/);
});
