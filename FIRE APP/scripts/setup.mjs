#!/usr/bin/env node
// 一键安装脚本 / One-click setup script
// 封装 install + rebuild + 验证流程，每步失败给出可复制的修复命令

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const cyan = '\x1b[36m';
const reset = '\x1b[0m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function logStep(n, msg) {
  console.log(`\n${bold}${cyan}[步骤 ${n}]${reset} ${msg}`);
}

function runCommand(cmd, { ignoreError = false } = {}) {
  try {
    execSync(cmd, { cwd: projectRoot, stdio: 'inherit' });
    return true;
  } catch (err) {
    if (!ignoreError) {
      log(`${red}[错误]${reset}`, `命令失败: ${cmd}`);
      log(`${dim}└─${reset}`, `${red}${err.message.split('\n')[0]}${reset}`);
    }
    return false;
  }
}

// 步骤 1: 检测现状 / Step 1: Check current state
function step1Check() {
  logStep(1, '检测环境现状...');
  const passed = runCommand('node scripts/check-env.mjs', { ignoreError: true });
  return passed;
}

// 步骤 2: 安装依赖 / Step 2: Install dependencies
function step2Install() {
  logStep(2, '安装依赖（读取 .npmrc 镜像配置）...');
  console.log(`${dim}  如果卡住，检查网络或镜像配置${reset}`);

  const passed = runCommand('pnpm install');

  if (!passed) {
    console.log(`\n${yellow}[提示]${reset} pnpm install 失败，常见原因：`);
    console.log(`  ${dim}1.${reset} better-sqlite3 编译失败 → 继续 Step 3 rebuild`);
    console.log(`  ${dim}2.${reset}$ ELECTRON_MIRROR 未生效 → 检查 .npmrc`);
    console.log(`  ${dim}3.${reset} OneDrive 锁定 → 移动项目到非 OneDrive 目录`);
    console.log(`  ${dim}4.${reset} Node 版本不对 → nvm use 20.18.0\n`);
  }

  return passed;
}

// 步骤 3: 编译原生模块 / Step 3: Rebuild native module for Electron
function step3Rebuild() {
  logStep(3, '为 Electron 编译原生模块（better-sqlite3）...');

  const passed = runCommand('pnpm --filter @fire-app/desktop rebuild');

  if (!passed) {
    console.log(`\n${red}[修复]${reset} electron-rebuild 失败，尝试以下步骤：`);
    console.log(`  ${dim}1.${reset} 杀掉残留进程:`);
    console.log(`     ${cyan}taskkill /F /IM electron.exe${reset} (Windows)`);
    console.log(`     ${cyan}pkill -f electron${reset} (macOS/Linux)`);
    console.log(`  ${dim}2.${reset} 清理 node_modules 重装:`);
    console.log(`     ${cyan}rmdir /s /q node_modules${reset} (Windows cmd)`);
    console.log(`     ${cyan}rm -rf node_modules${reset} (macOS/Linux)`);
    console.log(`     ${cyan}pnpm install${reset}`);
    console.log(`  ${dim}3.${reset} 手动跑 electron-rebuild:`);
    console.log(`     ${cyan}cd apps/desktop && npx electron-rebuild -f -w better-sqlite3${reset}\n`);
  }

  return passed;
}

// 步骤 4: 验证 / Step 4: Verify
function step4Verify() {
  logStep(4, '验证环境...');
  const passed = runCommand('node scripts/check-env.mjs');

  if (passed) {
    console.log(`\n${green}${bold}✓ 环境就绪！${reset}\n`);
    console.log(`${bold}启动开发模式：${reset}`);
    console.log(`  ${cyan}pnpm --filter @fire-app/desktop dev${reset}\n`);
  } else {
    console.log(`\n${yellow}[警告]${reset} 环境仍有问题，请按上方提示修复后重跑 ${cyan}pnpm setup${reset}\n`);
  }

  return passed;
}

// 主流程 / Main flow
function main() {
  console.log(`${bold}${cyan}╔══════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${cyan}║   FIRE APP 一键安装 / One-click Setup    ║${reset}`);
  console.log(`${bold}${cyan}╚══════════════════════════════════════════╝${reset}`);

  // 步骤 1: 检测
  const step1Passed = step1Check();

  if (step1Passed) {
    console.log(`\n${green}✓ 环境已就绪，无需安装${reset}`);
    console.log(`${bold}启动开发模式：${reset}`);
    console.log(`  ${cyan}pnpm --filter @fire-app/desktop dev${reset}\n`);
    return;
  }

  // 步骤 2: 安装
  step2Install();

  // 步骤 3: Rebuild（无论 install 是否成功都尝试，因为 install 可能部分成功）
  step3Rebuild();

  // 步骤 4: 验证
  step4Verify();
}

main();
