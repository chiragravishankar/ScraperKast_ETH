import path from 'path';
import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: `file:${path.join(__dirname, 'prisma', 'dev.db')}`,
  },
  migrations: {
    path: path.join(__dirname, 'prisma', 'migrations'),
  },
});
