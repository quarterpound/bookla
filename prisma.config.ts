import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Only load dotenv when DATABASE_URL isn't already in the environment (i.e. local dev).
// In CI / on the bastion, DATABASE_URL is exported before invoking prisma,
// so we skip the dotenv dependency entirely.
if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config()
}

export default defineConfig({
  schema: path.join(__dirname, './prisma/schema'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})
