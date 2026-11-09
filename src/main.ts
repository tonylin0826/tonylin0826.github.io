import './style.css';
import { loadFramesSource } from './frames/source';

/** Entry point. The page is complete static HTML; everything here is progressive enhancement. */
async function init(): Promise<void> {
  try {
    // Fetch the manifest and the (code-split) engine in parallel; neither blocks first paint.
    const [source, { createEngine }] = await Promise.all([loadFramesSource(), import('./scroll/engine')]);
    createEngine({ source });
    if (source.isPlaceholder) {
      const badge = document.createElement('p');
      badge.className = 'badge';
      badge.textContent = 'Placeholder frames';
      document.body.appendChild(badge);
    }
  } catch (err) {
    // No frames / engine failure: fall back to the plain static layout.
    console.error('Scroll experience unavailable; showing static layout.', err);
    document.documentElement.classList.remove('scroll-mode');
  }
}

/** Mount the terminal toggle after first paint; xterm itself loads only on first open. */
function mountTerminalWhenIdle(): void {
  const root = document.getElementById('terminal-root');
  if (!root) return;
  const mount = () => {
    void import('./terminal/Terminal').then((m) => m.mountTerminal(root)).catch((err) => console.error('Terminal unavailable.', err));
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(mount, { timeout: 2000 });
  else setTimeout(mount, 200);
}

void init();
mountTerminalWhenIdle();
