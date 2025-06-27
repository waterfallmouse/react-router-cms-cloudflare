// Test setup file for Bun Test
// This file runs before all tests

import { beforeAll, afterAll, afterEach } from "bun:test"
import { mock } from "bun:test"

// Setup test environment
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'file:./test.db'

// Mock Cloudflare Workers environment
const mockCloudflareEnv = {
  DB: {
    // Mock D1 database
    prepare: mock(),
    batch: mock(),
    exec: mock(),
  },
  R2_BUCKET: {
    // Mock R2 bucket
    get: mock(),
    put: mock(),
    delete: mock(),
    list: mock(),
  },
}

// Make Cloudflare bindings available globally for tests
globalThis.env = mockCloudflareEnv

// Clean up after tests
afterEach(() => {
  // Clear all mocks after each test
  for (const mockFn of Object.values(mockCloudflareEnv.DB)) {
    if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
      mockFn.mockClear()
    }
  }
  for (const mockFn of Object.values(mockCloudflareEnv.R2_BUCKET)) {
    if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
      mockFn.mockClear()
    }
  }
})

beforeAll(async () => {
  // Setup test database if needed
})

afterAll(async () => {
  // Cleanup test database if needed
})