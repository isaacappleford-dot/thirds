import { describe, expect, it } from 'vitest';
import { formatBytes } from './storage';

describe('formatBytes', () => {
  it('formats human sizes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5.5 * 1024 * 1024)).toBe('5.5 MB');
  });
});
