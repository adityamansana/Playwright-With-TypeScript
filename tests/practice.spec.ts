// tests/practice.spec.ts

import { test as base, expect } from '@playwright/test';

type MyFixtures = {
  greeting: string;
  timestamp: string;
};

const test = base.extend<MyFixtures>({

  greeting: async ({}, use) => {
    console.log('SETUP: greeting fixture');
    await use('Hello from fixture!');
    console.log('TEARDOWN: greeting fixture');
  },

  timestamp: async ({ greeting }, use) => {
    console.log('SETUP: timestamp depends on greeting');
    const ts = `${greeting} at ${new Date().toISOString()}`;
    await use(ts);
    console.log('TEARDOWN: timestamp fixture');
  },
});

test('understand fixtures', async ({ greeting, timestamp }) => {
  console.log('TEST: greeting =', greeting);
  console.log('TEST: timestamp =', timestamp);
  expect(greeting).toBe('Hello from fixture!');
});