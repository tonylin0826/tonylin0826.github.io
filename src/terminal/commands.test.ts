import { describe, expect, it } from 'vitest';
import {
  COMMANDS,
  GREETING,
  HELP_LINES,
  PROMPT,
  RESUME_URL,
  complete,
  notFound,
  runCommand,
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
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe("Hi, I'm Tony. I've been a full-stack engineer for more than 4 years.");
    expect(lines[1]).toBe('');
    expect(lines[2]).toContain('leading a 6-person team to develop IoT applications');
    expect(lines[2]?.endsWith('This project brings Ardomus more the 10 million dollars of income.')).toBe(true);
    expect(lines[3]).toBe('');
    expect(lines[4]?.startsWith('Last year, I built a team of 8 and won 2nd place in AWS Hack for Good hackathon.')).toBe(true);
    expect(lines[4]?.endsWith('our winning project is open source and can be found on GitHub.')).toBe(true);
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

  it('resume opens the Enhancv URL and prints nothing', () => {
    expect(runCommand('resume')).toEqual({ lines: [], action: { type: 'open', url: RESUME_URL } });
    expect(RESUME_URL).toBe(
      'https://app.enhancv.com/share/96f104d4?utm_medium=growth&utm_campaign=share-resume&utm_source=dynamic',
    );
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
