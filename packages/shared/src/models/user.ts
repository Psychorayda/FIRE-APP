// src/models/user.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs } from '../utils/time.js';
import type { User } from '../types/index.js';

export interface CreateUserInput {
  id?: string;
  display_name: string;
  base_currency?: string;
  is_china_market?: number;
  default_withdrawal_rate?: number;
  default_expected_return?: number;
  default_inflation_rate?: number;
}

export interface UpdateUserInput {
  display_name?: string;
  base_currency?: string;
  is_china_market?: number;
  default_withdrawal_rate?: number;
  default_expected_return?: number;
  default_inflation_rate?: number;
  encryption_key_hash?: string | null;
  last_sync_at?: number | null;
}

export function createUser(db: DatabaseType, input: CreateUserInput): User {
  const id = input.id ?? uuidv4();
  const isChina = input.is_china_market ?? 1;
  const now = nowMs();

  const user: User = {
    id,
    display_name: input.display_name,
    base_currency: input.base_currency ?? 'CNY',
    is_china_market: isChina,
    default_withdrawal_rate: input.default_withdrawal_rate ?? (isChina ? 350 : 400),
    default_expected_return: input.default_expected_return ?? 700,
    default_inflation_rate: input.default_inflation_rate ?? 300,
    encryption_key_hash: null,
    last_sync_at: null,
    sync_version: 0,
    updated_at: now,
    deleted_flag: 0,
  };

  db.prepare(`
    INSERT INTO users (id, display_name, base_currency, is_china_market,
      default_withdrawal_rate, default_expected_return, default_inflation_rate,
      encryption_key_hash, last_sync_at, sync_version, updated_at, deleted_flag)
    VALUES (@id, @display_name, @base_currency, @is_china_market,
      @default_withdrawal_rate, @default_expected_return, @default_inflation_rate,
      @encryption_key_hash, @last_sync_at, @sync_version, @updated_at, @deleted_flag)
  `).run(user);

  return user;
}

export function getUser(db: DatabaseType, id: string): User | null {
  const row = db.prepare(
    'SELECT * FROM users WHERE id = ? AND deleted_flag = 0'
  ).get(id) as User | undefined;
  return row ?? null;
}

export function updateUser(db: DatabaseType, id: string, input: UpdateUserInput): User {
  const current = getUser(db, id);
  if (!current) {
    throw new Error(`User not found: ${id}`);
  }

  const updated: User = {
    ...current,
    ...input,
    sync_version: current.sync_version + 1,
    updated_at: nowMs(),
  };

  db.prepare(`
    UPDATE users SET
      display_name = @display_name,
      base_currency = @base_currency,
      is_china_market = @is_china_market,
      default_withdrawal_rate = @default_withdrawal_rate,
      default_expected_return = @default_expected_return,
      default_inflation_rate = @default_inflation_rate,
      encryption_key_hash = @encryption_key_hash,
      last_sync_at = @last_sync_at,
      sync_version = @sync_version,
      updated_at = @updated_at
    WHERE id = @id
  `).run(updated);

  return updated;
}

/**
 * 获取第一个用户（用于启动时判断是否首次启动）
 * Get first user (for first-launch detection on startup)
 * @param db 数据库实例 / Database instance
 * @returns 第一个未删除的用户或 null / First non-deleted user or null
 */
export function getFirstUser(db: DatabaseType): User | null {
  const row = db.prepare(
    'SELECT * FROM users WHERE deleted_flag = 0 LIMIT 1'
  ).get() as User | undefined;
  return row ?? null;
}
