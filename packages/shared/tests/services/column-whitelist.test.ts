import { describe, it, expect } from 'vitest';
import { getColumnWhitelist, isValidColumnName, filterRecordColumns } from '../../src/services/column-whitelist.js';

describe('column-whitelist', () => {
  it('返回 transactions 表的合法列名', () => {
    const cols = getColumnWhitelist('transactions');
    expect(cols).toContain('id');
    expect(cols).toContain('amount');
    expect(cols).toContain('transaction_date');
    expect(cols).toContain('deleted_flag');
  });

  it('isValidColumnName 拒绝注入串', () => {
    expect(isValidColumnName('amount')).toBe(true);
    expect(isValidColumnName('name) VALUES (\'x\');--')).toBe(false);
    expect(isValidColumnName('updated_at = 0, sync_version = 0 --')).toBe(false);
    expect(isValidColumnName('foo; DROP TABLE users')).toBe(false);
    expect(isValidColumnName('123abc')).toBe(false);
    expect(isValidColumnName('')).toBe(false);
  });

  it('filterRecordColumns 仅保留白名单列', () => {
    const record = { id: 'x', amount: 100, evil: 'DROP TABLE', 'name) VALUES(1)': 'bad' };
    const filtered = filterRecordColumns('transactions', record);
    expect(Object.keys(filtered)).toEqual(['id', 'amount']);
    expect(filtered.evil).toBeUndefined();
  });

  it('未知表名返回空集合', () => {
    expect(getColumnWhitelist('nonexistent_table' as any)).toEqual([]);
  });
});
