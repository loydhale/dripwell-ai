import { pathToFileURL } from 'node:url';
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import nextEnvironment from '@next/env';
import { Prisma, PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { z } from 'zod';

const PASSWORD_ENV = 'DRIPWELL_PLATFORM_ADMIN_PASSWORD';
const { loadEnvConfig } = nextEnvironment;
const HELP = `Create a platform administrator through a trusted database operator.

pnpm --filter @dripwell/web admin:bootstrap --email selected@example.com --first-name Selected --last-name Operator

The password is read twice without terminal echo. For automation, inject the
dedicated DRIPWELL_PLATFORM_ADMIN_PASSWORD secret environment variable instead.
Passwords are never accepted as command-line arguments. DATABASE_URL and a valid
AUTH_ENCRYPTION_KEY must be configured. Existing clinic users cannot be promoted.
Enable two-factor authentication at /account before opening /platform.
`;

export class BootstrapError extends Error {}

export function parseBootstrapOptions(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) return { help: true };
  const allowed = new Set(['--email', '--first-name', '--last-name']);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!allowed.has(flag) || typeof value !== 'string' || !value || value.startsWith('--') || values[flag]) {
      throw new BootstrapError('Use only --email, --first-name, and --last-name, with explicit values. Password arguments are not accepted.');
    }
    values[flag] = value;
  }
  const parsed = z.object({
    email: z.email().max(254),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
  }).safeParse({ email: values['--email']?.trim().toLowerCase(), firstName: values['--first-name'], lastName: values['--last-name'] });
  if (!parsed.success) throw new BootstrapError('Select a valid --email and provide --first-name and --last-name.');
  return { help: false, ...parsed.data };
}

export function validateBootstrapPassword(password) {
  if (typeof password !== 'string' || password.length < 16 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new BootstrapError('Choose a password of at least 16 characters and at most 72 UTF-8 bytes.');
  }
}

export function assertPlatformIdentity(user) {
  if (!user) return;
  if (user.role !== 'SYSTEM_ADMIN' || user.tenantId !== null) {
    throw new BootstrapError('This email belongs to an existing non-platform account. Select a separate administrator email. No account was changed.');
  }
  if (!user.isActive) throw new BootstrapError('This platform account is inactive. No account was changed. Reactivation requires a separate operator action.');
}

async function maskedQuestion(prompt) {
  let hideOutput = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!hideOutput) process.stderr.write(chunk, encoding);
      callback();
    },
  });
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  const cancellation = new AbortController();
  const interrupt = () => cancellation.abort();
  terminal.once('SIGINT', interrupt);
  try {
    const answer = terminal.question(prompt, { signal: cancellation.signal });
    hideOutput = true;
    return await answer;
  } finally {
    terminal.removeListener('SIGINT', interrupt);
    terminal.close();
    output.end();
    process.stderr.write('\n');
  }
}

async function passwordInput() {
  const injected = process.env[PASSWORD_ENV];
  delete process.env[PASSWORD_ENV];
  if (injected !== undefined) {
    validateBootstrapPassword(injected);
    return injected;
  }
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new BootstrapError('Use an interactive terminal for masked password entry or inject DRIPWELL_PLATFORM_ADMIN_PASSWORD through your secret manager.');
  }
  const password = await maskedQuestion('Administrator password: ');
  validateBootstrapPassword(password);
  const repeated = await maskedQuestion('Confirm administrator password: ');
  if (password !== repeated) throw new BootstrapError('Passwords did not match. No account was created.');
  return password;
}

export async function runBootstrap(args = process.argv.slice(2)) {
  const options = parseBootstrapOptions(args);
  if (options.help) { process.stdout.write(HELP); return; }
  loadEnvConfig(process.cwd(), false, {
    info() {},
    error() { throw new BootstrapError('Environment configuration could not be loaded. Verify the local bindings without printing their values.'); },
  });
  if (!process.env.DATABASE_URL || !/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL)) {
    throw new BootstrapError('Configure the intended DATABASE_URL before running the restricted bootstrap command.');
  }
  if (!process.env.AUTH_ENCRYPTION_KEY || Buffer.from(process.env.AUTH_ENCRYPTION_KEY, 'base64url').length !== 32) {
    throw new BootstrapError('Configure an independent 32-byte AUTH_ENCRYPTION_KEY encoded as base64url before creating a platform account.');
  }
  const database = new PrismaClient({ log: [] });
  try {
    const existing = await database.user.findUnique({ where: { email: options.email } });
    assertPlatformIdentity(existing);
    if (existing) {
      process.stdout.write('The platform account already exists. Its credentials, permissions, and two-factor settings were left unchanged.\n');
      return;
    }
    const passwordHash = await hash(await passwordInput(), 12);
    await database.$transaction(async transaction => {
      const current = await transaction.user.findUnique({ where: { email: options.email } });
      assertPlatformIdentity(current);
      if (current) throw new BootstrapError('The platform account was created concurrently. No existing account was changed.');
      const user = await transaction.user.create({ data: { email: options.email, firstName: options.firstName, lastName: options.lastName, passwordHash,
        role: 'SYSTEM_ADMIN', tenantId: null, isActive: true, canApproveClinical: false, mfaEnabled: false } });
      await transaction.auditLog.create({ data: { action: 'SETTINGS_CHANGED', entityType: 'PLATFORM_ADMIN_BOOTSTRAP', entityId: user.id,
        details: { source: 'restricted-operator-cli', role: 'SYSTEM_ADMIN', mfaRequired: true } } });
    });
    process.stdout.write('Platform account created. Sign in, open /account, and enable two-factor authentication before using /platform.\n');
  } finally {
    delete process.env[PASSWORD_ENV];
    await database.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBootstrap().catch(error => {
    const message = error instanceof BootstrapError ? error.message : error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
      ? 'An account with that email already exists. No existing account was changed.'
      : error?.name === 'AbortError' ? 'Password entry cancelled. No account was created.'
        : 'Platform account bootstrap failed. Verify database connectivity and applied migrations. No credentials were printed.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
