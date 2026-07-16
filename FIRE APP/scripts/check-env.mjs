#!/usr/bin/env node
// 环境检查脚本 / Environment check script
// 检测 Node 版本、pnpm、OneDrive 路径、原生模块、electron 二进制
// 检测到问题时输出可复制的修复命令

import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// 解析参数 / Parse args
const quiet = process.argv.includes('--quiet');

// 结果收集 / Collect results
const results = [];
let hasFatal = false;

// 致命错误名单：这些检查失败会阻断流程（退出码 1）
// Fatal checks: failures here block the flow (exit code 1)
const FATAL_CHECKS = ['Node 版本', '原生模块', 'Electron 二进制'];

function addResult(name, passed, detail, fix) {
  results.push({ name, passed, detail, fix });
  if (!passed && FATAL_CHECKS.includes(name)) hasFatal = true;
}

// 颜色 / Colors（Windows cmd 也支持 ANSI）
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';
const dim = '\x1b[2m';

// 检测 1: Node 版本 / Check Node version
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1));
  const passed = major >= 20 && major < 22;
  const detail = `${version} (要求 >=20 <22)`;
  const fix = passed ? null : '安装 Node 20 LTS:\n  nvm install 20.18.0\n  nvm use 20.18.0\n或手动下载: https://npmmirror.com/mirrors/node/v20.18.0/';
  addResult('Node 版本', passed, detail, fix);
}

// 检测 2: pnpm 版本 / Check pnpm version
function checkPnpmVersion() {
  try {
    const output = execSync('pnpm -v', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const major = parseInt(output.split('.')[0]);
    const passed = major >= 9;
    const detail = `${output} (要求 >=9)`;
    const fix = passed ? null : '安装 pnpm 9:\n  npm install -g pnpm@9';
    addResult('pnpm 版本', passed, detail, fix);
  } catch {
    addResult('pnpm 版本', false, '未安装', '安装 pnpm:\n  npm install -g pnpm@9');
  }
}

// 检测 3: OneDrive 路径 / Check OneDrive path
function checkOneDrivePath() {
  const cwd = process.cwd();
  const passed = !cwd.includes('OneDrive') && !cwd.includes('onedrive');
  const detail = passed ? cwd : `${cwd} (位于 OneDrive 同步目录)`;
  const fix = passed ? null : '移动项目到非 OneDrive 目录:\n  建议移动到 D:\\Projects\\FIRE-APP\n  或暂停 OneDrive 同步后操作';
  addResult('OneDrive 路径', passed, detail, fix);
}

// 检测 4: 原生模块状态 / Check native module
function checkNativeModule() {
  // 查找 better-sqlite3 的 .node 文件
  const possiblePaths = [
    join(projectRoot, 'node_modules', '.pnpm', 'better-sqlite3@11.10.0', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    join(projectRoot, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
  ];

  const foundPath = possiblePaths.find(p => existsSync(p));
  if (!foundPath) {
    addResult('原生模块', false, 'better_sqlite3.node 未找到', '为 Electron 编译原生模块:\n  pnpm --filter @fire-app/desktop rebuild');
    return;
  }

  // 检查文件修改时间是否新于 package.json（确保 rebuild 过）
  const nodeMtime = statSync(foundPath).mtime;
  const pkgJsonPath = join(projectRoot, 'package.json');
  const pkgMtime = existsSync(pkgJsonPath) ? statSync(pkgJsonPath).mtime : new Date(0);
  const fresh = nodeMtime > pkgMtime || nodeMtime.getTime() > Date.now() - 86400000 * 7; // 7 天内编译过

  const detail = fresh ? `已编译 (${foundPath.split(/[\\/]/).slice(-3).join('/')})` : '已编译但可能过期';
  const fix = fresh ? null : '重新编译原生模块:\n  pnpm --filter @fire-app/desktop rebuild';
  addResult('原生模块', fresh, detail, fix);
}

// 检测 5: electron 二进制 / Check electron binary
function checkElectronBinary() {
  // electron 包路径
  const electronPkgPath = join(projectRoot, 'node_modules', '.pnpm', 'electron@31.7.7', 'node_modules', 'electron');
  const electronPathTxt = join(electronPkgPath, 'path.txt');

  if (!existsSync(electronPkgPath)) {
    addResult('Electron 二进制', false, 'electron 包未安装', '安装依赖:\n  pnpm install');
    return;
  }

  // path.txt 是 electron install 后生成的，存在说明二进制已下载
  if (existsSync(electronPathTxt)) {
    addResult('Electron 二进制', true, '已下载 (31.7.7)', null);
  } else {
    addResult('Electron 二进制', false, 'path.txt 不存在，二进制可能未下载', '下载 electron 二进制:\n  cd node_modules/.pnpm/electron@31.7.7/node_modules/electron\n  node install.js');
  }
}

// 输出结果 / Output results
function outputResults() {
  if (!quiet) {
    console.log('[check-env] 环境检查开始...\n');
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.length - passedCount;

  for (const r of results) {
    if (quiet && r.passed) continue; // quiet 模式只输出问题项

    const icon = r.passed ? `${green}[✓]${reset}` : `${red}[✗]${reset}`;
    console.log(`${icon} ${r.name}: ${r.passed ? r.detail : `${red}${r.detail}${reset}`}`);

    if (!r.passed && r.fix) {
      const fixLines = r.fix.split('\n');
      console.log(`    ${dim}└─ 问题: ${red}${r.name === 'OneDrive 路径' ? '文件同步会导致原生模块编译失败' : r.detail}${reset}`);
      console.log(`    ${dim}└─ 修复:${reset}`);
      for (const line of fixLines) {
        console.log(`       ${line}`);
      }
    }
  }

  if (!quiet) {
    console.log(`\n[check-env] 检查完成: ${green}${passedCount} 通过${reset}, ${failedCount > 0 ? `${red}${failedCount} 警告${reset}` : '0 警告'}`);
  }

  // 退出码：致命错误（Node 版本）才阻断，其他只警告
  process.exit(hasFatal ? 1 : 0);
}

// 执行所有检测 / Run all checks
checkNodeVersion();
checkPnpmVersion();
checkOneDrivePath();
checkNativeModule();
checkElectronBinary();
outputResults();
