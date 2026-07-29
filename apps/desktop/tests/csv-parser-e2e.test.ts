// CSV 解析端到端测试 / CSV parsing end-to-end tests
// 读取 samples/csv-import 下脱敏样本 → 按模板编码写入临时文件 → parseCsvFile 解析 → 校验
// 验证 fs 读取 + iconv 解码（GBK/UTF-8）+ CSV 解析 + parseHook 全链路

// @vitest-environment node

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import iconv from 'iconv-lite';
import { parseCsvFile } from '../src/main/import-csv-parser.js';
import { getTemplate } from '@shared/import-templates/registry.js';

const SAMPLES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../samples/csv-import',
);

/**
 * 读取 UTF-8 样本文件 → 按模板编码重新编码 → 写入临时文件，返回临时路径
 * Read UTF-8 sample → re-encode per template encoding → write temp file, return path
 */
function writeTempSample(templateId: string): string {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`未知模板: ${templateId}`);
  const utf8Content = fs.readFileSync(path.join(SAMPLES_DIR, `${templateId}_sample.csv`), 'utf-8');
  const tmpPath = path.join(os.tmpdir(), `fire-app-${templateId}-${Date.now()}.csv`);
  fs.writeFileSync(tmpPath, iconv.encode(utf8Content, template.encoding));
  return tmpPath;
}

describe('parseCsvFile E2E（脱敏样本全链路）', () => {
  it('alipay: GBK 解码 + 24 行元信息跳过 + 3 条交易', () => {
    const result = parseCsvFile('alipay', writeTempSample('alipay'));
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      amount: -12850, transactionType: 'expense',
      description: '海底捞火锅消费', counterparty: '海底捞',
    });
    expect(result[1]).toMatchObject({
      amount: -3500, transactionType: 'expense', description: '滴滴打车',
    });
    expect(result[2]).toMatchObject({
      amount: 800000, transactionType: 'income', description: '1月工资',
    });
    // 统计行（“已…”开头）应被过滤
    expect(result.every(t => !t.description.startsWith('已'))).toBe(true);
  });

  it('wechat-pay: GBK 解码 + 16 行元信息跳过 + 收/支方向判定', () => {
    const result = parseCsvFile('wechat-pay', writeTempSample('wechat-pay'));
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      amount: -3500, transactionType: 'expense',
      description: '拿铁咖啡', counterparty: '星巴克',
    });
    expect(result[1]).toMatchObject({
      amount: -4250, transactionType: 'expense', description: '外卖订单',
    });
    expect(result[2]).toMatchObject({
      amount: 12800, transactionType: 'income', description: '订单退款',
    });
  });

  it('cmb-debit: 招行流水 GBK + 正负金额判定收支', () => {
    const result = parseCsvFile('cmb-debit', writeTempSample('cmb-debit'));
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      amount: 500000, transactionType: 'income', description: '工资', counterparty: '某科技公司',
    });
    expect(result[1]).toMatchObject({
      amount: -5000, transactionType: 'expense', description: '超市购物',
    });
    expect(result[2]).toMatchObject({
      amount: -12850, transactionType: 'expense', description: '餐饮',
    });
  });

  it('icbc-debit: 工行流水 GBK（摘要=列1，金额=列2）', () => {
    const result = parseCsvFile('icbc-debit', writeTempSample('icbc-debit'));
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      amount: 800000, transactionType: 'income', description: '工资', counterparty: '某公司',
    });
    expect(result[1]).toMatchObject({
      amount: -6600, transactionType: 'expense', description: '购物',
    });
    expect(result[2]).toMatchObject({
      amount: -200000, transactionType: 'expense', description: '转账',
    });
  });

  it('ccb-debit: 建行流水 GBK（金额=列1，摘要=列6）', () => {
    const result = parseCsvFile('ccb-debit', writeTempSample('ccb-debit'));
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      amount: 800000, transactionType: 'income', description: '工资', counterparty: '某公司',
    });
    expect(result[1]).toMatchObject({
      amount: -3500, transactionType: 'expense', description: '打车',
    });
    expect(result[2]).toMatchObject({
      amount: -12850, transactionType: 'expense', description: '餐饮',
    });
  });

  it('boc-debit: 中行流水 GBK（摘要=列1，金额=列2）', () => {
    const result = parseCsvFile('boc-debit', writeTempSample('boc-debit'));
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      amount: 900000, transactionType: 'income', description: '工资', counterparty: '某公司',
    });
    expect(result[1]).toMatchObject({
      amount: -8880, transactionType: 'expense', description: '购物',
    });
    expect(result[2]).toMatchObject({
      amount: -500000, transactionType: 'expense', description: '理财',
    });
  });

  it('rcu-debit: 农商行流水 UTF-8（交易时间=列0，摘要=列3）', () => {
    const result = parseCsvFile('rcu-debit', writeTempSample('rcu-debit'));
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      amount: 600000, transactionType: 'income', description: '工资', counterparty: '某公司',
    });
    expect(result[1]).toMatchObject({
      amount: -4500, transactionType: 'expense', description: '午餐',
    });
    expect(result[2]).toMatchObject({
      amount: -150000, transactionType: 'expense', description: '房租',
    });
  });

  it('未知模板抛出错误', () => {
    expect(() => parseCsvFile('unknown-template', writeTempSample('alipay'))).toThrow(/未找到模板/);
  });
});
