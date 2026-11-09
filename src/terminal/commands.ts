/**
 * Terminal commands. Pure and framework-agnostic: no DOM, no xterm.
 *
 * `profile` copy was replaced on 2026-11-08 with Tony's new text (see
 * CURRENT_EMPLOYER_CLAUSE below). `portfolio`, `links` and `help` keep the
 * original 2017/Angular copy verbatim, quirks included (trailing space after
 * "government ", `links` "Github:" pointing at the site, which Tony confirmed
 * means "my website"). `resume` opens the PDF at /resume.pdf.
 */

export interface CommandResult {
  lines: string[];
  action?: { type: 'open'; url: string };
}

export interface Command {
  name: string;
  description: string;
  run(args: string[]): CommandResult;
}

export const GREETING = "Hello, my name is Tony. Type 'help' to see more";
export const PROMPT = '$ ';
/** Same-origin PDF (public/resume.pdf). Placeholder until Tony supplies the real file. */
export const RESUME_URL = '/resume.pdf';

/** Descriptions as shown in the help listing. */
export const DESCRIPTIONS = {
  profile: 'show profile',
  portfolio: 'show portfolio',
  links: 'show links',
  resume: 'open resume',
  help: 'show usage',
} as const;

/** Help lines, kept literal (the original mixes one and two tabs for alignment). */
export const HELP_LINES: string[] = [
  'Support command:',
  ' - profile\tshow profile',
  ' - portfolio\tshow portfolio',
  ' - links\tshow links',
  ' - resume\topen resume',
  ' - help\t\tshow usage',
];

/**
 * TODO(Tony): current-employer clause. Tony starts at Google on 2026-11-09 and
 * may change this. Edit this one constant; PROFILE_LINES is built from it.
 */
export const CURRENT_EMPLOYER_CLAUSE = "I'm currently a senior software engineer at Smartsheet";

/** Terminal width the profile copy is wrapped to (bottom-right xterm). */
export const PROFILE_WRAP_WIDTH = 70;

/** Greedy word wrap; pure. */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export const PROFILE_PARAGRAPHS: string[] = [
  `I've been a software engineer for about nine years, and ${CURRENT_EMPLOYER_CLAUSE}. My experience spans full-stack development, backend services, and earlier in my career, embedded IoT systems and native Android applications.`,
  'At Smartsheet, I led the technical design and implementation of an AI formula generation feature used by around 42,000 weekly active users. I also designed a secure developer tunneling proof of concept using mTLS and Kubernetes that reduced development and testing iteration time by roughly 90%.',
  'Earlier, I led a team of six engineers building a backend system supporting the management and communication of over 70,000 smart meters. I worked directly with Taiwan Power stakeholders to clarify requirements and translate them into concrete engineering work. I also led development of ViaTalkBT, a native Android app that turned a phone into a wireless input device for voice typing and trackpad control.',
];

export const PROFILE_LINES: string[] = PROFILE_PARAGRAPHS.flatMap((p, i) => [
  ...(i > 0 ? [''] : []),
  ...wrapText(p, PROFILE_WRAP_WIDTH),
]);

export const PORTFOLIO_LINES: string[] = [
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
];

export const LINKS_LINES: string[] = [
  'Click the url to open link',
  'Github:\t\thttps://tonylin0826.github.io',
  'NPM:\t\thttps://www.npmjs.com/package/yeelight.io',
  'Linkedin:\thttps://www.linkedin.com/in/tonylintw/',
];

/** Registry in the original Tab-completion order. */
export const COMMANDS: readonly Command[] = [
  { name: 'help', description: DESCRIPTIONS.help, run: () => ({ lines: HELP_LINES }) },
  { name: 'profile', description: DESCRIPTIONS.profile, run: () => ({ lines: PROFILE_LINES }) },
  {
    name: 'resume',
    description: DESCRIPTIONS.resume,
    run: () => ({ lines: [], action: { type: 'open', url: RESUME_URL } }),
  },
  { name: 'portfolio', description: DESCRIPTIONS.portfolio, run: () => ({ lines: PORTFOLIO_LINES }) },
  { name: 'links', description: DESCRIPTIONS.links, run: () => ({ lines: LINKS_LINES }) },
];

export function notFound(input: string): string {
  return `command not found: '${input}'`;
}

/**
 * Run a command line.
 *
 * Deviation from the original: the old terminal matched the raw buffer exactly
 * (so "help " was "not found"). Here we trim, split on whitespace and match the
 * first token, so surrounding whitespace and extra args are tolerated. The
 * not-found message echoes the trimmed input. Empty input yields no lines.
 */
export function runCommand(input: string): CommandResult {
  const [name, ...args] = input.trim().split(/\s+/);
  if (!name) return { lines: [] };
  const cmd = COMMANDS.find((c) => c.name === name);
  return cmd ? cmd.run(args) : { lines: [notFound(input.trim())] };
}

/** Tab completion (original semantics): first command in registry order that starts with a non-empty prefix. */
export function complete(prefix: string): string | null {
  if (prefix === '') return null;
  return COMMANDS.find((c) => c.name.startsWith(prefix))?.name ?? null;
}
