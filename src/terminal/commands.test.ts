import { describe, expect, it } from 'vitest';
import {
  COMMANDS,
  CURRENT_EMPLOYER_CLAUSE,
  GREETING,
  HELP_LINES,
  PROFILE_LINES,
  PROFILE_WRAP_WIDTH,
  PROMPT,
  RESUME_URL,
  complete,
  notFound,
  runCommand,
  wrapText,
} from './commands';
import { handleKey } from './lineEditor';

describe('constants', () => {
  it('matches the original greeting and prompt', () => {
    expect(GREETING).toBe("Hello, my name is Tony. Type 'help' to see more");
    expect(PROMPT).toBe('$ ');
  });
  it('keeps registry in original order', () => {
    expect(COMMANDS.map((c) => c.name)).toEqual(['help', 'profile', 'resume', 'portfolio', 'links']);
  });
});

describe('commands (verbatim copy)', () => {
  it('help', () => {
    expect(runCommand('help').lines).toEqual([
      'Support command:',
      ' - profile\tshow profile',
      ' - portfolio\tshow portfolio',
      ' - links\tshow links',
      ' - resume\topen resume',
      ' - help\t\tshow usage',
    ]);
    expect(HELP_LINES).toHaveLength(6);
  });

  it('profile', () => {
    const { lines } = runCommand('profile');
    expect(lines).toBe(PROFILE_LINES);
    expect(lines.every((l) => l.length <= PROFILE_WRAP_WIDTH)).toBe(true);
    const paragraphs = lines
      .join('\n')
      .split('\n\n')
      .map((p) => p.replace(/\n/g, ' '));
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0]).toContain(`about nine years, and ${CURRENT_EMPLOYER_CLAUSE}. My experience spans`);
    expect(paragraphs[1]).toContain('around 42,000 weekly active users');
    expect(paragraphs[1]).toContain('roughly 90%.');
    expect(paragraphs[2]).toContain('over 70,000 smart meters');
    expect(paragraphs[2]?.endsWith('voice typing and trackpad control.')).toBe(true);
    expect(lines.join(' ')).not.toMatch(/Ardomus|AWS|Andreas|RCS/);
  });

  it('CURRENT_EMPLOYER_CLAUSE feeds the profile', () => {
    expect(CURRENT_EMPLOYER_CLAUSE).toBe("I'm currently a senior software engineer at Smartsheet");
    expect(PROFILE_LINES.join(' ')).toContain('senior software engineer at Smartsheet');
  });

  it('wrapText wraps greedily', () => {
    expect(wrapText('aa bb cc', 5)).toEqual(['aa bb', 'cc']);
    expect(wrapText('', 5)).toEqual([]);
  });

  it('portfolio', () => {
    expect(runCommand('portfolio').lines).toEqual([
      '',
      'Yeelight.io - https://www.npmjs.com/package/yeelight.io',
      '• yeelight.io is a simple library for you to control',
      '  YeeLight LED bulb through LAN',
      '• 600+ download on NPM',
      '• Used by 2 other open-source projects',
      '',
      'Hikoo - https://hikoo-team.github.io/hikoo',
      '• Hikoo platform is management platform for the government ',
      '  to better track and protect the hikers',
      '',
      'Modbus Master Tool - https://github.com/tonylin0826/ModbusMasterTool',
      '• A Modbus TCP Master Tool made using Qt',
      '',
      'http.io.c - https://github.com/tonylin0826/yeelight.io.c',
      '• A C HTTP REST framework',
    ]);
  });

  it('links', () => {
    expect(runCommand('links').lines).toEqual([
      'Click the url to open link',
      'Github:\t\thttps://tonylin0826.github.io',
      'NPM:\t\thttps://www.npmjs.com/package/yeelight.io',
      'Linkedin:\thttps://www.linkedin.com/in/tonylintw/',
    ]);
  });

  it('resume opens the PDF and prints nothing', () => {
    expect(runCommand('resume')).toEqual({ lines: [], action: { type: 'open', url: RESUME_URL } });
    expect(RESUME_URL).toBe('/resume.pdf');
  });

  it('not found', () => {
    expect(notFound('foo')).toBe("command not found: 'foo'");
    expect(runCommand('foo').lines).toEqual(["command not found: 'foo'"]);
  });

  it('tolerates surrounding whitespace and extra args (documented deviation)', () => {
    expect(runCommand('  help  ')).toEqual(runCommand('help'));
    expect(runCommand('links extra')).toEqual(runCommand('links'));
    expect(runCommand('   ').lines).toEqual([]);
    expect(runCommand('').lines).toEqual([]);
  });
});

describe('complete', () => {
  it('follows the original order', () => {
    expect(complete('p')).toBe('profile');
    expect(complete('po')).toBe('portfolio');
    expect(complete('r')).toBe('resume');
    expect(complete('h')).toBe('help');
    expect(complete('l')).toBe('links');
    expect(complete('')).toBeNull();
    expect(complete('x')).toBeNull();
    expect(complete('helpx')).toBeNull();
  });
});

describe('lineEditor', () => {
  const k = (key: string, extra = {}) => ({ key, ...extra });

  it('echoes and buffers printable keys', () => {
    expect(handleKey({ buffer: 'he' }, k('l'), 4)).toEqual({ buffer: 'hel', writes: ['l'] });
  });
  it('ignores modified keys', () => {
    for (const m of ['ctrl', 'alt', 'meta']) {
      expect(handleKey({ buffer: 'a' }, k('c', { [m]: true }), 3)).toEqual({ buffer: 'a', writes: [] });
    }
  });
  it('ignores arrows', () => {
    expect(handleKey({ buffer: 'a' }, k('ArrowUp'), 3)).toEqual({ buffer: 'a', writes: [] });
    expect(handleKey({ buffer: 'a' }, k('ArrowDown'), 3)).toEqual({ buffer: 'a', writes: [] });
  });
  it('backspace only when cursor x > 2', () => {
    expect(handleKey({ buffer: 'ab' }, k('Backspace'), 4)).toEqual({ buffer: 'a', writes: ['\b \b'] });
    expect(handleKey({ buffer: '' }, k('Backspace'), 2)).toEqual({ buffer: '', writes: [] });
  });
  it('tab completes the remainder', () => {
    expect(handleKey({ buffer: 'p' }, k('Tab'), 3)).toEqual({ buffer: 'profile', writes: ['rofile'] });
    expect(handleKey({ buffer: 'po' }, k('Tab'), 4)).toEqual({ buffer: 'portfolio', writes: ['rtfolio'] });
    expect(handleKey({ buffer: '' }, k('Tab'), 2)).toEqual({ buffer: '', writes: [] });
    expect(handleKey({ buffer: 'x' }, k('Tab'), 3)).toEqual({ buffer: 'x', writes: [] });
  });
  it('enter submits and clears the buffer', () => {
    expect(handleKey({ buffer: 'help' }, k('Enter'), 6)).toEqual({ buffer: '', writes: [], submit: 'help' });
    expect(handleKey({ buffer: '' }, k('Enter'), 2)).toEqual({ buffer: '', writes: [], submit: '' });
  });
});
