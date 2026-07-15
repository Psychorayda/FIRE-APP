// 渲染进程 IPC 类型声明 / Renderer IPC type declarations
// 声明 window.dataAccess 的类型，供渲染进程使用

import type { User, Account } from '@shared/types/index.js';
import type { CreateUserInput } from '@shared/models/user.js';

export interface DataAccessAPI {
  initDatabase(): Promise<void>;

  user: {
    getFirst(): Promise<User | null>;
    create(input: CreateUserInput): Promise<User>;
  };

  category: {
    seed(userId: string): Promise<void>;
  };

  account: {
    list(userId: string): Promise<Account[]>;
  };
}

declare global {
  interface Window {
    dataAccess: DataAccessAPI;
  }
}
