// src/lib/__tests__/setup.ts
// Test setup - loads environment variables

import { config } from 'dotenv';
import path from 'path';

// Load .env.local for tests
config({ path: path.resolve(process.cwd(), '.env.local') });
