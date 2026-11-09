/**
 * Terminal commands, ported verbatim from the 2017/Angular site's terminal.
 * Pure and framework-agnostic: no DOM, no xterm.
 *
 * Copy is intentionally kept exactly as in the original, typos included
 * ("more the 10 million dollars", "Support command:", trailing space after
 * "government ", the `links` "Github:" line pointing at the site). See the
 * Open questions section of CLAUDE.md.
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
export const RESUME_URL =
  'https://app.enhancv.com/share/96f104d4?utm_medium=growth&utm_campaign=share-resume&utm_source=dynamic';

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

export const PROFILE_LINES: string[] = [
  "Hi, I'm Tony. I've been a full-stack engineer for more than 4 years.",
  '',
  "During my time in Ardomus Networks, a subsidiary of Zyxel, I'm responsible for leading a 6-person team to develop IoT applications. One project worth mentioning is the HES(Head-end System), a national project we develop as a part of Taiwan's AMI(Advanced Metering Infrastructure) for Taiwan-Power to manage over 70k of their meters and FAN modules. I and my team put a lot of effort into making this system distributed and highly available. This project brings Ardomus more the 10 million dollars of income.",
  '',
  'Last year, I built a team of 8 and won 2nd place in AWS Hack for Good hackathon. I was responsible to manage the schedule, design the software architecture and present our project on the final pitch. Last but not least, our winning project is open source and can be found on GitHub.',
];

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
