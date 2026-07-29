import type { Category } from '../types/index.js';

const PLACEHOLDER_TO_NAME: Record<string, string> = {
  '__CATEGORY_FOOD__': '食品',
  '__CATEGORY_TRANSPORT__': '交通',
  '__CATEGORY_HOUSING__': '住房',
  '__CATEGORY_SHOPPING__': '购物',
  '__CATEGORY_ENTERTAINMENT__': '娱乐',
  '__CATEGORY_MEDICAL__': '医疗',
  '__CATEGORY_INSURANCE__': '保险',
  '__CATEGORY_PERSONAL_CARE__': '个人护理',
  '__CATEGORY_EDUCATION__': '教育',
  '__CATEGORY_DEBT_PAYMENT__': '债务还款',
  '__CATEGORY_OTHER_EXPENSE__': '其他支出',
  '__CATEGORY_SALARY__': '工资薪金',
  '__CATEGORY_FREELANCE__': '自由职业',
  '__CATEGORY_INVESTMENT_INCOME__': '投资收益',
  '__CATEGORY_RENT_INCOME__': '租金收入',
  '__CATEGORY_TAX_REFUND__': '退税',
  '__CATEGORY_PENSION__': '社保养老金',
  '__CATEGORY_OTHER_INCOME__': '其他收入',
};

export function resolveCategoryPlaceholder(
  placeholder: string,
  categories: Pick<Category, 'id' | 'name'>[]
): string | undefined {
  const categoryName = PLACEHOLDER_TO_NAME[placeholder];
  if (!categoryName) return undefined;
  return categories.find(c => c.name === categoryName)?.id;
}

export function isPlaceholder(value: string): boolean {
  return value.startsWith('__CATEGORY_') && value.endsWith('__');
}
