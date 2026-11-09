import { complete } from './commands';

export interface KeyInput {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
}

export interface EditorState {
  buffer: string;
}

export interface EditorResult {
  buffer: string;
  /** Raw strings to write to the terminal, in order. */
  writes: string[];
  /** Set on Enter: the submitted buffer (possibly empty). The caller runs it, then prompts. */
  submit?: string;
}

/**
 * Line editing, mirroring the original terminal.
 * `cursorX` is the terminal's current cursor column; Backspace is ignored at x <= 2
 * (the width of the "$ " prompt).
 */
export function handleKey(state: EditorState, input: KeyInput, cursorX: number): EditorResult {
  const { buffer } = state;
  const { key } = input;
  if (key === 'ArrowUp' || key === 'ArrowDown') return { buffer, writes: [] };
  if (key === 'Tab') {
    const full = complete(buffer);
    if (full === null) return { buffer, writes: [] };
    return { buffer: full, writes: [full.slice(buffer.length)] };
  }
  if (key === 'Enter') return { buffer: '', writes: [], submit: buffer };
  if (key === 'Backspace') {
    if (cursorX > 2) return { buffer: buffer.slice(0, -1), writes: ['\b \b'] };
    return { buffer, writes: [] };
  }
  if (!input.alt && !input.ctrl && !input.meta) return { buffer: buffer + key, writes: [key] };
  return { buffer, writes: [] };
}
