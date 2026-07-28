// tests/utils/time.test.ts
import { describe, it, expect } from 'vitest';
import { nowMs, toYearMonth, addMonths, monthsBetween } from '../../src/utils/time.js';

describe('time utils', () => {
  it('nowMs: 返回当前毫秒时间戳', () => {
    const before = Date.now();
    const result = nowMs();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it('toYearMonth: 从时间戳提取 YYYY-MM', () => {
    // 2026-07-13 00:00:00 UTC
    const ts = Date.UTC(2026, 6, 13);
    expect(toYearMonth(ts)).toBe('2026-07');
  });

  it('toYearMonth: 不同月份', () => {
    // 2026-01-01 00:00:00 UTC
    const ts = Date.UTC(2026, 0, 1);
    expect(toYearMonth(ts)).toBe('2026-01');
  });

  it('addMonths: 在时间戳上加N个月', () => {
    // 2026-01-15 00:00:00 UTC
    const ts = Date.UTC(2026, 0, 15);
    const result = addMonths(ts, 3);
    // 2026-04-15
    expect(toYearMonth(result)).toBe('2026-04');
  });

  it('addMonths: 跨年', () => {
    // 2026-11-15 00:00:00 UTC（月份索引 10 = 11月）
    const ts = Date.UTC(2026, 10, 15);
    const result = addMonths(ts, 3);
    // 11月 + 3个月 = 次年2月 → 2027-02
    expect(toYearMonth(result)).toBe('2027-02');
  });

  it('monthsBetween: 计算两个月时间戳间的月数', () => {
    const start = Date.UTC(2026, 0, 1);
    const end = Date.UTC(2026, 6, 1);
    expect(monthsBetween(start, end)).toBe(6);
  });

  it('monthsBetween: 跨年', () => {
    const start = Date.UTC(2026, 0, 1);
    const end = Date.UTC(2028, 5, 1);
    expect(monthsBetween(start, end)).toBe(29);
  });
});
