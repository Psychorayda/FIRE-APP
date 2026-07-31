// 镜像注册中心 / Mirror registry
// 维护镜像列表、URL 改写规则、健康状态（熔断）

export interface Mirror {
  id: string;                        // 'ghproxy' | 'gh-proxy' | 'github'
  name: string;                      // 显示名
  rewrite: (url: string) => string;  // URL 改写
}

interface MirrorHealth {
  consecutiveFailures: number;       // 连续失败次数
  lastFailureAt?: number;            // 最近失败时间戳
  disabledUntil?: number;            // 熔断到何时（时间戳）
}

const CIRCUIT_BREAK_THRESHOLD = 2;       // 连续失败 2 次触发熔断
const CIRCUIT_BREAK_DURATION_MS = 5 * 60 * 1000;  // 熔断 5 分钟

// 内置镜像列表（硬编码，按优先级排序）
// Built-in mirror list (hardcoded, ordered by priority)
const BUILTIN_MIRRORS: Mirror[] = [
  {
    id: 'ghproxy',
    name: 'ghproxy',
    rewrite: (url) => `https://ghproxy.com/${url}`,
  },
  {
    id: 'gh-proxy',
    name: 'gh-proxy',
    rewrite: (url) => `https://gh-proxy.com/${url}`,
  },
  {
    id: 'github',
    name: 'GitHub 官方',
    rewrite: (url) => url,  // 不改写
  },
];

export class MirrorRegistry {
  private health: Map<string, MirrorHealth> = new Map();

  constructor() {
    for (const mirror of BUILTIN_MIRRORS) {
      this.health.set(mirror.id, { consecutiveFailures: 0 });
    }
  }

  /**
   * 获取下载顺序：健康镜像在前，被熔断的排到后面
   * Get download order: healthy mirrors first, circuit-broken ones last
   */
  getDownloadOrder(): Mirror[] {
    const now = Date.now();
    return [...BUILTIN_MIRRORS].sort((a, b) => {
      const ha = this.health.get(a.id)!;
      const hb = this.health.get(b.id)!;
      const aDisabled = ha.disabledUntil !== undefined && ha.disabledUntil > now;
      const bDisabled = hb.disabledUntil !== undefined && hb.disabledUntil > now;
      // 健康的排前面（false < true）
      return Number(aDisabled) - Number(bDisabled);
    });
  }

  /**
   * 标记镜像失败（连续失败触发熔断）
   * Mark mirror as failed (consecutive failures trigger circuit break)
   */
  markFailed(mirrorId: string): void {
    const h = this.health.get(mirrorId);
    if (!h) return;
    h.consecutiveFailures += 1;
    h.lastFailureAt = Date.now();
    if (h.consecutiveFailures >= CIRCUIT_BREAK_THRESHOLD) {
      h.disabledUntil = Date.now() + CIRCUIT_BREAK_DURATION_MS;
    }
  }

  /**
   * 标记镜像成功（清除失败计数）
   * Mark mirror as successful (clear failure count)
   */
  markSuccess(mirrorId: string): void {
    const h = this.health.get(mirrorId);
    if (!h) return;
    h.consecutiveFailures = 0;
    h.lastFailureAt = undefined;
    h.disabledUntil = undefined;
  }
}
