// tests/utils/money.test.ts
import { describe, it, expect } from 'vitest';
import { yuanToCents, centsToYuan, basisPointsToDecimal } from '../../src/utils/money.js';

describe('money utils', () => {
  it('yuanToCents: 1234.56元 → 123456分', () => {
    expect(yuanToCents(1234.56)).toBe(123456);
  });

  it('yuanToCents: 0元 → 0分', () => {
    expect(yuanToCents(0)).toBe(0);
  });

  it('yuanToCents: 四舍五入到分', () => {
    expect(yuanToCents(1.005)).toBe(101);
  });

  it('yuanToCents: 负数金额（负债场景）', () => {
    expect(yuanToCents(-100)).toBe(-10000);
    expect(yuanToCents(-1.005)).toBe(-101);
  });

  it('centsToYuan: 123456分 → 1234.56元', () => {
    expect(centsToYuan(123456)).toBe(1234.56);
  });

  it('centsToYuan: 0分 → 0元', () => {
    expect(centsToYuan(0)).toBe(0);
  });

  it('basisPointsToDecimal: 350基点 → 0.035', () => {
    expect(basisPointsToDecimal(350)).toBe(0.035);
  });

  it('basisPointsToDecimal: 700基点 → 0.07', () => {
    expect(basisPointsToDecimal(700)).toBe(0.07);
  });
});
