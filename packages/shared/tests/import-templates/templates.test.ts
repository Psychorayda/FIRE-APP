import { describe, it, expect } from 'vitest';
import { getAllTemplates, getTemplate, detectTemplate } from '../../src/import-templates/registry.js';
import { alipayTemplate } from '../../src/import-templates/alipay.js';
import { wechatPayTemplate } from '../../src/import-templates/wechat-pay.js';
import { cmbDebitTemplate } from '../../src/import-templates/cmb-debit.js';

describe('templates registry', () => {
  it('getAllTemplates 返回 7 个模板', () => {
    expect(getAllTemplates()).toHaveLength(7);
  });
  it('getTemplate: 按 ID 查找', () => {
    expect(getTemplate('alipay')?.id).toBe('alipay');
    expect(getTemplate('cmb-debit')?.id).toBe('cmb-debit');
    expect(getTemplate('unknown')).toBeUndefined();
  });
  it('detectTemplate: 支付宝特征文件识别', () => {
    const content = '支付宝（中国）网络技术有限公司 电子账单\n--------';
    expect(detectTemplate(content)).toBe('alipay');
  });
  it('detectTemplate: 微信特征文件识别', () => {
    const content = '微信支付账单明细\n微信账号: test\n起始时间: 2026-01-01';
    expect(detectTemplate(content)).toBe('wechat-pay');
  });
  it('detectTemplate: 无匹配返回 null', () => {
    expect(detectTemplate('unknown content')).toBeNull();
  });
});

describe('alipay template parseHook', () => {
  it('正确解析支付宝 CSV 数据行', () => {
    const metaRows = Array.from({ length: 24 }, () => ['元信息']);
    metaRows[23] = ['交易号', '商家订单号', '交易创建时间', '付款时间', '最近修改时间', '交易来源', '类型', '交易对方', '商品名称', '金额（元）', '收/支', '交易状态', '服务费（元）', '成功退款（元）', '备注', '资金状态'];
    const dataRow = ['tx001', '', '2026-01-15 12:30:00', '', '', '', '餐饮美食', '海底捞', '海底捞餐厅消费', '¥-128.50', '支出', '交易成功', '¥0.00', '¥0.00', '', '资金已转出'];
    const result = alipayTemplate.parseHook!([...metaRows, dataRow]);
    expect(result).toHaveLength(1);
    // description 映射自 商品名称(row[8])，counterparty 映射自 交易对方(row[7])
    expect(result[0].description).toBe('海底捞餐厅消费');
    expect(result[0].amount).toBe(-12850);
    expect(result[0].transactionType).toBe('expense');
    expect(result[0].counterparty).toBe('海底捞');
    expect(result[0].transactionDate).toBeGreaterThan(0);
  });
  it('过滤统计行', () => {
    const metaRows = Array.from({ length: 24 }, () => ['元信息']);
    metaRows[23] = ['交易号', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    const dataRow = ['tx001', '', '2026-01-15 12:30:00', '', '', '', '', '', '消费', '¥-100', '', '', '', '', '', ''];
    const statRow = ['已实交易总笔数: 1 笔'];
    const result = alipayTemplate.parseHook!([...metaRows, dataRow, statRow]);
    expect(result).toHaveLength(1);
  });
});

describe('wechat-pay template parseHook', () => {
  it('正确解析微信支付数据行', () => {
    const metaRows = Array.from({ length: 16 }, () => ['元信息']);
    metaRows[15] = ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态', '交易单号', '商户单号', '备注'];
    const dataRow = ['2026-01-15 12:30:00', '商户消费', '星巴克', '咖啡', '支出', '¥35.00', '零钱', '支付成功', 'tx001', '', ''];
    const result = wechatPayTemplate.parseHook!([...metaRows, dataRow]);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(-3500);
    expect(result[0].transactionType).toBe('expense');
    expect(result[0].description).toBe('咖啡');
  });
});

describe('cmb-debit template parseHook', () => {
  it('正确解析招行流水', () => {
    const headerRow = ['交易日期', '货币', '交易金额', '余额', '交易类型', '交易对手', '摘要', '业务类型'];
    const dataRow = ['2026-01-15', 'RMB', '5000.00', '10000.00', '入账', '某公司', '工资', '工资'];
    const result = cmbDebitTemplate.parseHook!([headerRow, dataRow]);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(500000);
    expect(result[0].transactionType).toBe('income');
    expect(result[0].description).toBe('工资');
  });
});
