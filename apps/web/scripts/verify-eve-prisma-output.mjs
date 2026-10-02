import { open, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const engineName = 'libquery_engine-rhel-openssl-3.0.x.so.node';
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function functionRoots(directory) {
  const roots = new Set();
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.name.endsWith('.func')) {
        const config = JSON.parse(await readFile(join(child, '.vc-config.json'), 'utf8'));
        if (config.runtime?.startsWith('nodejs')) roots.add(await realpath(child));
      } else if (entry.isDirectory()) {
        await visit(child);
      }
    }
  }
  await visit(directory);
  if (!roots.size) throw new Error('Eve build has no Node.js function bundles to verify.');
  return [...roots];
}

function assertBundled(root, path) {
  const inside = relative(root, path);
  if (inside.startsWith('..') || isAbsolute(inside))
    throw new Error('Eve Prisma dependency resolves outside its deployed function bundle.');
}

export async function verifyEvePrismaOutput(outputDirectory, vercel = Boolean(process.env.VERCEL)) {
  // Eve can select the Vercel preset after loading local environment files.
  // Verify the resulting layout even when the parent shell is not on Vercel.
  const functions = vercel || (await readdir(outputDirectory)).includes('functions');
  const roots = functions
    ? await functionRoots(join(outputDirectory, 'functions'))
    : [await realpath(join(outputDirectory, 'server'))];
  const verified = [];
  for (const root of roots) {
    // Resolve from the finished bundle, never the source monorepo's node_modules.
    const requireFromBundle = createRequire(join(root, 'package.json'));
    const client = await realpath(requireFromBundle.resolve('@prisma/client'));
    assertBundled(root, client);
    const generated = await realpath(createRequire(client).resolve('.prisma/client/default'));
    assertBundled(root, generated);
    const engine = await realpath(join(dirname(generated), engineName));
    assertBundled(root, engine);
    const metadata = await stat(engine);
    const file = await open(engine, 'r');
    const header = Buffer.alloc(20);
    try {
      await file.read(header, 0, header.length, 0);
    } finally {
      await file.close();
    }
    if (!metadata.isFile() || metadata.size < 1024 * 1024 ||
        header.subarray(0, 4).toString('hex') !== '7f454c46' ||
        header[4] !== 2 || header[5] !== 1 || header.readUInt16LE(18) !== 62)
      throw new Error('Eve Prisma RHEL engine is not a valid Linux x64 native library.');
    verified.push({ bundle: relative(outputDirectory, root), engine: relative(root, engine), bytes: metadata.size });
  }
  return verified;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const vercel = Boolean(process.env.VERCEL);
  const outputDirectory = vercel
    ? resolve(appRoot, process.env.EVE_INTERNAL_BUILD_OUTPUT_DIRECTORY || '.vercel/output')
    : join(appRoot, '.output');
  try {
    const bundles = await verifyEvePrismaOutput(outputDirectory, vercel);
    console.log(`Verified Prisma RHEL engine in ${bundles.length} Eve runtime bundles.`);
  } catch (error) {
    console.error(`Eve Prisma packaging verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
