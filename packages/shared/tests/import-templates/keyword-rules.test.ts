import { describe, it, expect } from 'vitest';
import { inferCategory, KEYWORD_RULES } from '../../src/import-templates/keyword-rules.js';

describe('keyword-rules', () => {
  it('餐厅 → 食品分类', () => {
    expect(inferCategory('海底捞餐厅消费')).toBe('__CATEGORY_FOOD__');
  });
  it('饿了么 → 食品分类', () => {
    expect(inferCategory('饿了么外卖订单')).toBe('__CATEGORY_FOOD__');
  });
  it('滴滴 → 交通分类', () => {
    expect(inferCategory('滴滴出行打车')).toBe('__CATEGORY_TRANSPORT__');
  });
  it('商品说明字段也参与匹配', () => {
    expect(inferCategory('消费', '美团外卖')).toBe('__CATEGORY_FOOD__');
  });
  it('未命中关键词返回 undefined', () => {
    expect(inferCategory('某笔无关键词的交易')).toBeUndefined();
  });
  it('多关键词命中返回第一个匹配规则', () => {
    // '保险医药费' 同时命中 MEDICAL(医药, index 5) 与 INSURANCE(保险, index 6)
    // 按规则数组顺序，MEDICAL 在前，故返回 MEDICAL
    expect(inferCategory('保险医药费')).toBe('__CATEGORY_MEDICAL__');
  });
  it('KEYWORD_RULES 至少 11 条', () => {
    expect(KEYWORD_RULES.length).toBeGreaterThanOrEqual(11);
  });
});
