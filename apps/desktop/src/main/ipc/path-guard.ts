import path from 'node:path';

/**
 * 已签发路径集合：dialog:save/open 返回路径时记录，文件读写前校验并消费
 * Issued-path set: recorded when dialog:save/open returns, validated+consumed before file I/O
 * 一次性 token：消费后即焚，防止渲染端复用旧路径绕过
 * One-time token: burned after consumption, prevents renderer reusing stale paths
 */
const issuedPaths = new Set<string>();

/**
 * 签发路径 token（dialog 返回合法路径时调用）
 * Issue a path token (called when dialog returns a legitimate path)
 */
export function issuePathToken(filePath: string): void {
  const resolved = path.resolve(filePath);
  issuedPaths.add(resolved);
}

/**
 * 消费路径 token（文件读写前调用，一次性）
 * Consume path token (called before file I/O, one-time)
 * @returns true 若路径已签发且未被消费
 */
export function consumePathToken(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  if (issuedPaths.has(resolved)) {
    issuedPaths.delete(resolved);
    return true;
  }
  return false;
}

/**
 * 校验路径本身是否安全（绝对路径 + 无 .. 穿越）
 * Validate path is inherently safe (absolute + no .. traversal)
 */
export function isPathSafe(filePath: string): boolean {
  if (!path.isAbsolute(filePath)) return false;
  const resolved = path.resolve(filePath);
  // 检测 .. 穿越：resolve 后若包含 .. 段（已被 normalize 则检查原始是否含 ..）
  if (filePath.includes('..')) return false;
  // resolved 应与 normalize 一致
  return resolved === path.normalize(filePath);
}

/**
 * 文件操作前置校验：必须经过 dialog 签发且路径安全
 * Pre-check for file operations: must be dialog-issued and path-safe
 * @throws 若路径未经 dialog 签发或含穿越
 */
export function assertFileOperationAllowed(filePath: string, operation: 'read' | 'write'): void {
  if (!isPathSafe(filePath)) {
    throw new Error(`路径不安全，拒绝${operation === 'read' ? '读取' : '写入'}: ${filePath}`);
  }
  if (!consumePathToken(filePath)) {
    throw new Error(`路径未经文件对话框选择，拒绝${operation === 'read' ? '读取' : '写入'}`);
  }
}
