// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import * as connectionModule from '@shared/db/connection.js';
import { createDatabase, closeDatabase } from '@shared/db/connection.js';
import { initSchema } from '@shared/db/schema.js';

// mock electron：app.getPath 返回临时目录，模拟 userData；BrowserWindow.getAllWindows 返回空
const mockUserData = mkdtempSync(join(tmpdir(), 'fire-mock-'));
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((key: string) => {
      if (key === 'userData') return mockUserData;
      if (key === 'temp') return tmpdir();
      return mockUserData;
    }),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import { initDatabase, closeAppDatabase, getDatabase } from '../src/main/db-manager.js';

describe('db-manager 安全错误处理', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fire-db-test-'));
    vi.clearAllMocks();
    // 清理 mockUserData 下的 data 子目录和日志文件，避免测试间状态污染
    // （mockUserData 是模块级常量，多个测试共享同一临时目录）
    try { rmSync(join(mockUserData, 'data'), { recursive: true, force: true }); } catch {}
    try { rmSync(join(mockUserData, 'fire-app-debug.log'), { force: true }); } catch {}
  });

  afterEach(() => {
    try { closeAppDatabase(); } catch {}
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('createDatabase 打开失败时，initDatabase 抛错且不删除原文件', () => {
    const dbPath = join(mockUserData, 'data', 'fire.db');
    const db1 = initDatabase();
    db1.prepare("INSERT INTO users (id, display_name, base_currency, is_china_market, default_withdrawal_rate, default_expected_return, default_inflation_rate, sync_version, updated_at, deleted_flag) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run('test-id', 'Test', 'CNY', 1, 350, 700, 300, 0, Date.now(), 0);
    closeAppDatabase();

    expect(existsSync(dbPath)).toBe(true);

    const spy = vi.spyOn(connectionModule, 'createDatabase').mockImplementation(() => {
      throw new Error('SQLITE_BUSY: database is locked');
    });

    expect(() => initDatabase()).toThrow('SQLITE_BUSY');
    expect(existsSync(dbPath)).toBe(true);

    spy.mockRestore();
  });

  it('integrity_check 非 ok 时不删库、不抛错', () => {
    const db = initDatabase();
    db.prepare("INSERT INTO users (id, display_name, base_currency, is_china_market, default_withdrawal_rate, default_expected_return, default_inflation_rate, sync_version, updated_at, deleted_flag) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run('u1', 'User1', 'CNY', 1, 350, 700, 300, 0, Date.now(), 0);
    closeAppDatabase();

    const dbPath = join(mockUserData, 'data', 'fire.db');
    const dbInstance = initDatabase();
    const pragmaSpy = vi.spyOn(dbInstance, 'pragma').mockImplementation((arg: string) => {
      if (arg === 'integrity_check') return [{ integrity_check: 'database disk image is malformed' }];
      return pragmaSpy.mock.calls;
    });
    expect(() => initDatabase()).not.toThrow();
    pragmaSpy.mockRestore();
    closeAppDatabase();

    expect(existsSync(dbPath)).toBe(true);
  });

  it('正常初始化后 users 表存在且可查询', () => {
    initDatabase();
    const db = getDatabase();
    const rows = db.prepare('SELECT count(*) as c FROM users').get() as { c: number };
    expect(rows.c).toBe(0);
  });

  it('诊断日志文件被创建并含 dbPath', () => {
    initDatabase();
    closeAppDatabase();
    const logPath = join(mockUserData, 'fire-app-debug.log');
    expect(existsSync(logPath)).toBe(true);
    const logContent = readFileSync(logPath, 'utf8');
    expect(logContent).toContain('fire.db');
  });
});

describe('db-manager 迁移逻辑', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fire-migrate-test-'));
    vi.clearAllMocks();
    // 重置 dbInstance
    try { closeAppDatabase(); } catch {}
    // 清理 mockUserData 下的 data 子目录和旧路径，避免测试间污染
    try { rmSync(join(mockUserData, 'data'), { recursive: true, force: true }); } catch {}
    try { rmSync(join(mockUserData, 'fire-app'), { recursive: true, force: true }); } catch {}
  });

  afterEach(() => {
    try { closeAppDatabase(); } catch {}
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('旧路径有库、新路径无库时迁移到新路径', () => {
    // 构造旧路径（双层 fire-app）并写入数据
    const legacyDir = join(mockUserData, 'fire-app', 'data');
    mkdirSync(legacyDir, { recursive: true });
    const legacyPath = join(legacyDir, 'fire.db');
    const oldDb = createDatabase(legacyPath);
    initSchema(oldDb);
    oldDb.prepare("INSERT INTO users (id, display_name, base_currency, is_china_market, default_withdrawal_rate, default_expected_return, default_inflation_rate, sync_version, updated_at, deleted_flag) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run('legacy-user', 'Legacy', 'CNY', 1, 350, 700, 300, 0, Date.now(), 0);
    closeDatabase(oldDb);

    // 新路径不应存在
    const newPath = join(mockUserData, 'data', 'fire.db');
    expect(existsSync(newPath)).toBe(false);

    // initDatabase 触发迁移
    const db = initDatabase();
    const row = db.prepare('SELECT id, display_name FROM users').get() as { id: string; display_name: string };
    expect(row.id).toBe('legacy-user');
    expect(row.display_name).toBe('Legacy');

    // 新路径已存在
    expect(existsSync(newPath)).toBe(true);
    // 旧路径已删除
    expect(existsSync(legacyPath)).toBe(false);
  });

  it('迁移失败时回退旧路径（旧库仍可读）', () => {
    // 构造一个损坏的旧路径文件（非合法 SQLite）
    const legacyDir = join(mockUserData, 'fire-app', 'data');
    mkdirSync(legacyDir, { recursive: true });
    const legacyPath = join(legacyDir, 'fire.db');
    writeFileSync(legacyPath, 'not a sqlite database');

    // 新路径不存在
    const newPath = join(mockUserData, 'data', 'fire.db');
    expect(existsSync(newPath)).toBe(false);

    // initDatabase：迁移 copy 成功，但验证打开失败 → 回退用旧路径 → createDatabase 旧路径抛错 → initDatabase 抛错
    expect(() => initDatabase()).toThrow();
    // 旧文件仍在（未被删除）
    expect(existsSync(legacyPath)).toBe(true);
  });
});
