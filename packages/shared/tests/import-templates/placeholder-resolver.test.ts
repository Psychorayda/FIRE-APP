import { describe, it, expect } from 'vitest';
import { resolveCategoryPlaceholder, isPlaceholder } from '../../src/import-templates/placeholder-resolver.js';

const categories = [
  { id: 'uid-food', name: '食品' },
  { id: 'uid-transport', name: '交通' },
  { id: 'uid-other-expense', name: '其他支出' },
  { id: 'uid-salary', name: '工资薪金' },
];

describe('placeholder-resolver', () => {
  it('__CATEGORY_FOOD__ → 食品分类 ID', () => {
    expect(resolveCategoryPlaceholder('__CATEGORY_FOOD__', categories)).toBe('uid-food');
  });
  it('__CATEGORY_SALARY__ → 工资薪金分类 ID', () => {
    expect(resolveCategoryPlaceholder('__CATEGORY_SALARY__', categories)).toBe('uid-salary');
  });
  it('未找到分类返回 undefined', () => {
    expect(resolveCategoryPlaceholder('__CATEGORY_UNKNOWN__', categories)).toBeUndefined();
  });
  it('非占位符返回 undefined', () => {
    expect(resolveCategoryPlaceholder('random-string', categories)).toBeUndefined();
  });
  it('isPlaceholder: 合法占位符返回 true', () => {
    expect(isPlaceholder('__CATEGORY_FOOD__')).toBe(true);
  });
  it('isPlaceholder: 非占位符返回 false', () => {
    expect(isPlaceholder('uid-food')).toBe(false);
  });
});
