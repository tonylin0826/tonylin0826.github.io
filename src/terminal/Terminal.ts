import { COMMANDS, GREETING, PROMPT, RESUME_URL, runCommand } from './commands';
import { handleKey } from './lineEditor';

const ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>';

type XtermModules = [typeof import('@xterm/xterm'), typeof import('@xterm/addon-fit'), typeof import('@xterm/addon-web-links')];

let modulesPromise: Promise<XtermModules> | null = null;
/** xterm is only fetched on first open (or hover/focus prefetch), never in the entry chunk. */
function loadXterm(): Promise<XtermModules> {
  modulesPromise ??= Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
    import('@xterm/addon-web-links'),
    import('@xterm/xterm/css/xterm.css'),
  ]).then(([x, f, w]) => [x, f, w] as XtermModules);
  modulesPromise.catch(() => (modulesPromise = null));
  return modulesPromise;
}

const STYLE = `
.term-toggle{position:fixed;z-index:40;right:.75rem;bottom:.75rem;width:2.75rem;height:2.75rem;display:grid;place-items:center;border:0;border-radius:50%;background:#111318;color:#fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35)}
.term-toggle:focus-visible,.term-panel:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px var(--focus,#0b57d0)}
.term-panel{position:fixed;z-index:40;right:.75rem;bottom:4.25rem;width:min(640px,calc(100vw - 2rem));height:min(380px,60vh);box-sizing:border-box;padding:.5rem;background:#0d1117;border:1px solid #30363d;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.45);overflow:hidden;transition:opacity .15s}
.term-panel[hidden]{display:none}
.term-screen{width:100%;height:100%}
@media (prefers-reduced-motion:reduce){.term-panel{transition:none}}
`;

export function mountTerminal(root: HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const panelId = 'terminal-panel';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'term-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', panelId);
  toggle.setAttribute('aria-label', 'Open terminal');
  toggle.innerHTML = ICON;

  const panel = document.createElement('div');
  panel.id = panelId;
  panel.className = 'term-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Interactive terminal');
  panel.hidden = true;

  const note = document.createElement('p');
  note.className = 'visually-hidden';
  note.append(
    `Interactive terminal. Available commands: ${COMMANDS.map((c) => `${c.name} (${c.description})`).join(', ')}. `,
  );
  const resume = document.createElement('a');
  resume.href = RESUME_URL;
  resume.target = '_blank';
  resume.rel = 'noopener';
  resume.textContent = 'Open resume (opens in new tab)';
  note.append(resume);

  const screen = document.createElement('div');
  screen.className = 'term-screen';
  panel.append(note, screen);
  root.append(panel, toggle);

  type Term = InstanceType<XtermModules[0]['Terminal']>;
  type Fit = InstanceType<XtermModules[1]['FitAddon']>;
  let term: Term | null = null;
  let fit: Fit | null = null;
  let opening = false;
  let buffer = '';

  const writeLines = (lines: string[]) => lines.forEach((l) => term!.write(l + '\r\n'));
  const prompt = () => term!.write('\r\n' + PROMPT);
  /** Mirrors the original process(): nothing for an empty buffer, else newline, output, clear. */
  const processLine = (input: string) => {
    if (input === '') return;
    term!.write('\r\n');
    const res = runCommand(input);
    if (res.action?.type === 'open') window.open(res.action.url, '_blank', 'noopener');
    // The original used writeln for lists and write (no newline) for "not found".
    const first = res.lines[0];
    if (res.lines.length === 1 && first !== undefined && first.startsWith('command not found')) term!.write(first);
    else writeLines(res.lines);
  };

  const doFit = () => {
    if (!panel.hidden) fit?.fit();
  };

  async function ensureTerm(): Promise<void> {
    if (term) return;
    const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await loadXterm();
    if (term) return;
    const t = new Terminal({
      screenReaderMode: true,
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      theme: { background: '#0d1117', foreground: '#e6edf3', cursor: '#e6edf3' },
    });
    const f = new FitAddon();
    t.loadAddon(new WebLinksAddon());
    t.loadAddon(f);
    t.open(screen);
    term = t;
    fit = f;
    f.fit();
    t.onKey(({ key, domEvent }) => {
      const named = ['Enter', 'Backspace', 'Tab', 'ArrowUp', 'ArrowDown'];
      const k = named.includes(domEvent.key) ? domEvent.key : key;
      const cursorX = t.buffer.active.cursorX; // 0-based column; "$ " occupies columns 0-1
      const r = handleKey(
        { buffer },
        { key: k, ctrl: domEvent.ctrlKey, alt: domEvent.altKey, meta: domEvent.metaKey },
        cursorX,
      );
      buffer = r.buffer;
      r.writes.forEach((w) => t.write(w));
      if (r.submit !== undefined) {
        processLine(r.submit);
        prompt();
      }
    });
    // Init, as in the original: greeting, auto-run `help`, prompt.
    t.write(GREETING);
    buffer = 'help';
    processLine(buffer);
    buffer = '';
    prompt();
  }

  async function open(): Promise<void> {
    if (opening || !panel.hidden) return;
    opening = true;
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close terminal');
    try {
      await ensureTerm();
      doFit();
      term?.focus();
    } catch (err) {
      console.error('Terminal failed to load', err);
      close(false);
    } finally {
      opening = false;
    }
  }

  function close(returnFocus: boolean): void {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open terminal');
    if (returnFocus) toggle.focus();
  }

  toggle.addEventListener('click', () => (panel.hidden ? void open() : close(true)));
  const prefetch = () => void loadXterm().catch(() => undefined);
  toggle.addEventListener('pointerenter', prefetch, { once: true });
  toggle.addEventListener('focus', prefetch, { once: true });
  // Capture phase: xterm stops propagation of keydown events it handles.
  panel.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    },
    true,
  );
  window.addEventListener('resize', doFit);
}
