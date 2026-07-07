type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const PREFIX = '[BeamSolver]';

const enabled: Record<LogLevel, boolean> = {
  debug: true,
  info: true,
  warn: true,
  error: true,
};

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

function fmt(...args: unknown[]): string {
  return args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
}

export const logger = {
  debug(...args: unknown[]) {
    if (!enabled.debug) return;
    console.debug(`${PREFIX} [${ts()}] [DEBUG]`, ...args);
  },
  info(...args: unknown[]) {
    if (!enabled.info) return;
    console.info(`${PREFIX} [${ts()}] [INFO]`, ...args);
  },
  warn(...args: unknown[]) {
    if (!enabled.warn) return;
    console.warn(`${PREFIX} [${ts()}] [WARN]`, ...args);
  },
  error(...args: unknown[]) {
    if (!enabled.error) return;
    console.error(`${PREFIX} [${ts()}] [ERROR]`, ...args);
  },
  group(label: string) {
    console.group(`${PREFIX} [${ts()}] ${label}`);
  },
  groupEnd() {
    console.groupEnd();
  },
};

let renderCount = 0;
export function debugRender(component: string, props?: Record<string, unknown>) {
  renderCount++;
  const changed = props ? Object.entries(props)
    .filter(([, v]) => typeof v !== 'function')
    .map(([k]) => k)
    .join(', ') : '';
  logger.debug(`[RENDER #${renderCount}] ${component}${changed ? ` (props: ${changed})` : ''}`);
}

export function debugAction(action: string, detail?: unknown) {
  logger.info(`[ACTION] ${action}${detail !== undefined ? ` — ${fmt(detail)}` : ''}`);
}

export function debugState(label: string, state: Record<string, unknown>) {
  logger.group(`State snapshot: ${label}`);
  for (const [k, v] of Object.entries(state)) {
    const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
    logger.debug(`  ${k} = ${val}`);
  }
  logger.groupEnd();
}
