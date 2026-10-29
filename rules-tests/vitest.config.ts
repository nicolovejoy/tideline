import { defineConfig } from 'vitest/config'

// Every rules file resets the one emulator project (`clearFirestore`) in its
// beforeEach, so run one file at a time.
export default defineConfig({
  test: {
    fileParallelism: false,
  },
})
