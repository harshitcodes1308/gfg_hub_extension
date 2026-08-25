import { defineConfig } from 'vitest/config';

// Unit tests run in jsdom so the GFG extraction layer can be tested against
// saved HTML fixtures without a real browser or any network (PRD Rule 1).
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
