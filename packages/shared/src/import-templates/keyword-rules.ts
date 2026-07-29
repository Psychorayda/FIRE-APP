export interface KeywordRule {
  categoryId: string;
  keywords: string[];
}

export const KEYWORD_RULES: KeywordRule[] = [
  { categoryId: '__CATEGORY_FOOD__', keywords: ['餐厅', '餐饮', '饿了么', '美团', '外卖', '肯德基', '麦当劳', '星巴克', '超市', '便利店'] },
  { categoryId: '__CATEGORY_TRANSPORT__', keywords: ['滴滴', '出租', '地铁', '公交', '高铁', '火车', '机票', '加油', '停车', 'ETC'] },
  { categoryId: '__CATEGORY_HOUSING__', keywords: ['房租', '物业', '水电', '燃气', '宽带'] },
  { categoryId: '__CATEGORY_SHOPPING__', keywords: ['淘宝', '京东', '拼多多', '天猫', '苏宁', '购物', '商品'] },
  { categoryId: '__CATEGORY_ENTERTAINMENT__', keywords: ['电影', '游戏', 'KTV', '演唱会', '会员', '腾讯视频', '爱奇艺'] },
  { categoryId: '__CATEGORY_MEDICAL__', keywords: ['医院', '药店', '诊所', '挂号', '医药'] },
  { categoryId: '__CATEGORY_INSURANCE__', keywords: ['保险', '保费', '寿险', '医疗险'] },
  { categoryId: '__CATEGORY_PERSONAL_CARE__', keywords: ['理发', '美容', '化妆品', '健身'] },
  { categoryId: '__CATEGORY_EDUCATION__', keywords: ['学费', '培训', '课程', '书店', '教育'] },
  { categoryId: '__CATEGORY_SALARY__', keywords: ['工资', '薪资', '月薪', '代发'] },
  { categoryId: '__CATEGORY_INVESTMENT_INCOME__', keywords: ['分红', '利息', '收益', '股息', '基金赎回'] },
];

export function inferCategory(
  description: string,
  productDescription?: string,
  rules: KeywordRule[] = KEYWORD_RULES
): string | undefined {
  const text = `${description} ${productDescription ?? ''}`;
  for (const rule of rules) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      return rule.categoryId;
    }
  }
  return undefined;
}
