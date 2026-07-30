// @vitest-environment node
// IPC 输入 schema 校验 + 错误脱敏测试
// IPC input schema validation + error sanitization tests

import { describe, it, expect, vi } from 'vitest';

// 屏蔽 electron 主进程模块，避免在 node 测试环境加载失败
// Mock electron main-process module so it can be imported under node test env
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

import {
  createTransactionSchema,
  updateScenarioSchema,
  createAccountSchema,
} from '../src/main/ipc/schemas.js';
import { sanitizeError } from '../src/main/ipc/register-handlers.js';

describe('IPC input schemas', () => {
  it('createTransactionSchema 接受合法输入', () => {
    const valid = {
      user_id: 'u1',
      account_id: 'a1',
      transaction_type: 'expense',
      amount: 1000,
      transaction_date: 1700000000000,
    };
    expect(createTransactionSchema.safeParse(valid).success).toBe(true);
  });

  it('createTransactionSchema 拒绝 NaN/Infinity amount', () => {
    const invalid = {
      user_id: 'u1',
      account_id: 'a1',
      transaction_type: 'expense',
      amount: NaN,
      transaction_date: 1700000000000,
    };
    expect(createTransactionSchema.safeParse(invalid).success).toBe(false);
  });

  it('createTransactionSchema 拒绝负数 amount', () => {
    const invalid = {
      user_id: 'u1',
      account_id: 'a1',
      transaction_type: 'expense',
      amount: -100,
      transaction_date: 1700000000000,
    };
    expect(createTransactionSchema.safeParse(invalid).success).toBe(false);
  });

  it('updateScenarioSchema 剔除 user_id/sync_version 字段', () => {
    const parsed = updateScenarioSchema.safeParse({
      user_id: 'evil',
      sync_version: 999,
      name: '新名',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data!.user_id).toBeUndefined();
    expect(parsed.data!.sync_version).toBeUndefined();
    expect(parsed.data!.name).toBe('新名');
  });

  it('createAccountSchema 校验 asset_class 枚举', () => {
    expect(
      createAccountSchema.safeParse({
        user_id: 'u1',
        name: '招行',
        asset_class: 'liquid',
        account_type: 'checking',
      }).success,
    ).toBe(true);
    expect(
      createAccountSchema.safeParse({
        user_id: 'u1',
        name: '招行',
        asset_class: 'evil',
        account_type: 'checking',
      }).success,
    ).toBe(false);
  });
});

describe('sanitizeError', () => {
  it('SQLITE_CONSTRAINT: CHECK 映射为 VALIDATION_ERROR 且不泄露 SQL', () => {
    const err = new Error(
      'SQLITE_CONSTRAINT: CHECK constraint failed: amount > 0 in "INSERT INTO transactions..."',
    );
    const out = sanitizeError(err);
    expect(out.code).toBe('VALIDATION_ERROR');
    expect(out.message).not.toContain('INSERT');
    expect(out.message).not.toContain('transactions');
  });

  it('SQLITE_CONSTRAINT: UNIQUE 映射为 DUPLICATE_ERROR', () => {
    const out = sanitizeError(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: users.id'));
    expect(out.code).toBe('DUPLICATE_ERROR');
    expect(out.message).not.toContain('users');
  });

  it('not found 映射为 NOT_FOUND', () => {
    const out = sanitizeError(new Error('scenario not found: scn-1'));
    expect(out.code).toBe('NOT_FOUND');
    expect(out.message).not.toContain('scn-1');
  });

  it('未知错误兜底为 DB_ERROR，不暴露原始堆栈/路径', () => {
    const err = new Error('ENOENT: no such file or directory, open \'/etc/shadow\'');
    const out = sanitizeError(err);
    expect(out.code).toBe('DB_ERROR');
    expect(out.message).not.toContain('/etc/shadow');
    expect(out.message).not.toContain('ENOENT');
  });

  it('路径守卫错误保留原消息（对用户有意义）', () => {
    const out = sanitizeError(new Error('路径不安全：未通过 dialog 签发'));
    expect(out.code).toBe('PATH_FORBIDDEN');
    expect(out.message).toContain('路径不安全');
  });
});
