#!/usr/bin/env node
import path from 'path';

import { makeCli } from './index.js';

// For now, discover the configs by reading the filesystem, at a path that's
// overrideable by an env var. This is simpler than taking a CLI option that
// we'd have to set with every command invocation.
const configPath = process.env.MIGRATOR_CONFIG_PATH ?? './configs/index.js';

makeCli(await import(path.resolve(process.cwd(), configPath)));
