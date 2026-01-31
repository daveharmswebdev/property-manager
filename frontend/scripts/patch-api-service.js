#!/usr/bin/env node
/**
 * Post-processes the NSwag-generated api.service.ts to import API_BASE_URL
 * from a separate file instead of defining it inline.
 *
 * This enables tree-shaking: app.config.ts can import just the token without
 * pulling in the entire 256KB API client.
 */

const fs = require('fs');
const path = require('path');

const apiServicePath = path.join(__dirname, '../src/app/core/api/api.service.ts');

let content = fs.readFileSync(apiServicePath, 'utf8');

// Replace the inline token definition with an import and re-export
const oldLine = "export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');";
const newLine = "import { API_BASE_URL } from './api-base-url.token';\nexport { API_BASE_URL };";

if (content.includes(oldLine)) {
  content = content.replace(oldLine, newLine);

  // Also remove InjectionToken from the Angular import since it's no longer needed here
  content = content.replace(
    /import \{ Injectable, Inject, Optional, InjectionToken \} from '@angular\/core';/,
    "import { Injectable, Inject, Optional } from '@angular/core';"
  );

  fs.writeFileSync(apiServicePath, content);
  console.log('✓ Patched api.service.ts to import API_BASE_URL from external file');
} else if (content.includes(newLine)) {
  console.log('✓ api.service.ts already patched');
} else {
  console.error('✗ Could not find API_BASE_URL definition to patch');
  process.exit(1);
}
