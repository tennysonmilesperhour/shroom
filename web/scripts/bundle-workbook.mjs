// Package the canonical Python importer for the Vercel function. Never maintain a second parser.
import { cpSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../../backend', import.meta.url));
const target = fileURLToPath(new URL('../api/_vendor/backend', import.meta.url));
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true, filter: (path) => !path.includes('__pycache__') && (statSync(path).isDirectory() || path.endsWith('.py')) });
