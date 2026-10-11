/** Browser persistence: autosave to localStorage, file import/export. */
import { parseDesign, serializeDesign } from '../core/model/serialize.ts';
import type { Design } from '../core/model/types.ts';
import type { EditorController } from './editor.ts';

const STORAGE_KEY = 'pleatsmith.design.v1';

export function loadSavedDesign(): Design | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    const res = parseDesign(text);
    return res.ok ? res.design : null;
  } catch {
    return null;
  }
}

/** Save the design shortly after each change. Returns an unsubscribe function. */
export function attachAutosave(editor: EditorController, delayMs = 400): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = editor.subscribe((state, prev) => {
    if (state.design === prev.design) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, serializeDesign(state.design));
      } catch {
        // Storage can be full or disabled; autosave is best effort.
      }
    }, delayMs);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickTextFile(accept = '.json,application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export const fileNameFor = (design: Design): string =>
  `${design.name.trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'design'}.pleat.json`;
