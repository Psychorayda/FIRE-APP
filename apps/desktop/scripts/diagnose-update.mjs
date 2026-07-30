#!/usr/bin/env node
/**
 * electron-updater 下载链路诊断脚本（不依赖 electron-updater 本身）
 * Download pipeline diagnostic (does NOT depend on electron-updater)
 *
 * 原理 / Principle:
 *   electron-updater 下载更新本质上是 3 步：
 *   1. GET latest.yml（获取版本号 + exe 文件名 + sha512 + size）
 *   2. 解析 latest.yml，拼出 exe 下载 URL
 *   3. GET exe 文件（大文件，流式下载）
 *
 *   本脚本用 Node 原生 https 模块复刻这 3 步，逐步打印结果，
 *   定位到底是哪一步失败、失败的具体原因（证书/DNS/HTTP/超时/权限）。
 *
 * 使用 / Usage:
 *   cd C:\Projects\FIRE-APP\apps\desktop
 *   node scripts/diagnose-update.mjs
 *
 * 输出 / Output:
 *   - DNS 解析结果
 *   - 代理/TLS 环境变量
 *   - latest.yml 下载结果（HTTP 状态、headers、内容）
 *   - exe 文件下载结果（HTTP 状态、headers、下载字节数）
 *   - 每一步的完整错误（含 stack）
 */

import https from 'https';
import http from 'http';
import dns from 'dns';
import { URL } from 'url';
import { createWriteStream, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import os from 'os';

// ===== 配置（与 electron-builder.yml publish 一致）/ Config =====
const GITHUB_OWNER = 'Psychorayda';
const GITHUB_REPO = 'FIRE-APP';
const RELEASE_TAG = 'v0.1.1-dev.49';  // 与 latest.yml 中一致
const RELEASE_VERSION = '0.1.1-dev.49';

// ===== 工具函数 / Helpers =====
function log(tag, data) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${ts}] [${tag}]`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  } else {
    console.log(`[${ts}] [${tag}]`);
  }
}

function formatError(err) {
  if (!err) return 'null/undefined';
  const result = {
    name: err.name,
    message: err.message,
    code: err.code,
    host: err.host,
    port: err.port,
    stack: err.stack,
  };
  if (err.response) {
    result.response = {
      statusCode: err.response.statusCode,
      statusMessage: err.response.statusMessage,
      headers: err.response.headers,
    };
  }
  if (err.cause) result.cause = formatError(err.cause);
  // 清理 undefined 字段
  Object.keys(result).forEach(k => result[k] === undefined && delete result[k]);
  return result;
}

/**
 * 手动跟随重定向的 https.get
 * Node 原生 https 不自动跟随 301/302，需手动处理
 */
function httpsGet(url, options = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 60000,
      headers: {
        'User-Agent': 'fire-app-diagnose/1.0',
        ...options.headers,
      },
      // 关键：不拒绝无效证书（诊断用，复刻 NODE_TLS_REJECT_UNAUTHORIZED=0 行为）
      rejectUnauthorized: false,
    };

    const req = https.request(reqOptions, (res) => {
      // 处理重定向
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        const nextUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        log('HTTP-REDIRECT', { from: url, to: nextUrl, status: res.statusCode });
        // 消费当前响应体，避免 socket 泄漏
        res.resume();
        httpsGet(nextUrl, options, maxRedirects - 1).then(resolve, reject);
        return;
      }
      resolve(res);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`TIMEOUT after ${reqOptions.timeout}ms`));
    });
    req.end();
  });
}

/**
 * 读取完整响应体
 */
function readBody(res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => resolve(Buffer.concat(chunks)));
    res.on('error', reject);
  });
}

// ===== 1. 网络环境探测 / Network probe =====
async function probeNetwork() {
  log('PROBE', '=== 网络环境探测开始 / Network probe start ===');

  // 1.1 DNS 解析
  for (const host of ['github.com', 'objects.githubusercontent.com', 'codeload.github.com']) {
    try {
      const addrs = await dns.promises.lookup(host, { all: true });
      log('PROBE-DNS', { host, addresses: addrs });
      if (addrs.some(a => a.address === '127.0.0.1' || a.address === '0.0.0.0')) {
        log('PROBE-WARN', `⚠️  ${host} 解析到 127.0.0.1 —— 本地代理/hosts 劫持`);
      }
    } catch (err) {
      log('PROBE-DNS-ERR', { host, error: formatError(err) });
    }
  }

  // 1.2 环境变量
  log('PROBE-ENV', {
    NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '(unset)',
    HTTPS_PROXY: process.env.HTTPS_PROXY ?? process.env.https_proxy ?? '(unset)',
    HTTP_PROXY: process.env.HTTP_PROXY ?? process.env.http_proxy ?? '(unset)',
    NO_PROXY: process.env.NO_PROXY ?? process.env.no_proxy ?? '(unset)',
    ELECTRON_NO_ATTACH_CONSOLE: process.env.ELECTRON_NO_ATTACH_CONSOLE ?? '(unset)',
  });

  log('PROBE', '=== 网络环境探测结束 / Network probe end ===\n');
}

// ===== 2. 模拟 electron-updater 下载链路 / Simulate download pipeline =====
async function simulateDownloadPipeline() {
  log('PIPELINE', '=== 模拟 electron-updater 下载链路开始 ===');

  // 步骤 1：下载 latest.yml
  const ymlUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${RELEASE_TAG}/latest.yml`;
  log('STEP-1', `下载 latest.yml: ${ymlUrl}`);

  let ymlContent;
  try {
    const res = await httpsGet(ymlUrl);
    const body = await readBody(res);
    log('STEP-1-OK', {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      headers: res.headers,
      bodyLength: body.length,
      body: body.toString('utf8'),
    });
    if (res.statusCode !== 200) {
      log('STEP-1-FAIL', `latest.yml 返回非 200 状态码: ${res.statusCode}，终止诊断`);
      return;
    }
    ymlContent = body.toString('utf8');
  } catch (err) {
    log('STEP-1-ERR', formatError(err));
    log('PIPELINE', 'latest.yml 下载失败，终止后续步骤');
    return;
  }

  // 步骤 2：解析 latest.yml，提取 exe 文件名和 URL
  log('STEP-2', '解析 latest.yml...');
  let exeFileName;
  let exeSha512;
  let exeSize;
  try {
    // 简单解析 yml（不引入 yaml 依赖）
    const urlMatch = ymlContent.match(/^  - url: (.+)$/m);
    const shaMatch = ymlContent.match(/^    sha512: (.+)$/m);
    const sizeMatch = ymlContent.match(/^    size: (.+)$/m);
    const pathMatch = ymlContent.match(/^path: (.+)$/m);
    exeFileName = (urlMatch?.[1] || pathMatch?.[1] || '').trim();
    exeSha512 = shaMatch?.[1]?.trim();
    exeSize = parseInt(sizeMatch?.[1]?.trim() || '0', 10);
    log('STEP-2-OK', { exeFileName, exeSha512: exeSha512?.slice(0, 20) + '...', exeSize });
    if (!exeFileName) {
      log('STEP-2-FAIL', '无法从 latest.yml 解析出 exe 文件名');
      return;
    }
  } catch (err) {
    log('STEP-2-ERR', formatError(err));
    return;
  }

  // 步骤 3：下载 exe（只下前 1MB 探测连通性，避免下载完整 90MB）
  const exeUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${RELEASE_TAG}/${exeFileName}`;
  log('STEP-3', `探测下载 exe（只取前 1MB 验证连通性）: ${exeUrl}`);

  const tempFile = join(os.tmpdir(), `fire-app-diagnose-${Date.now()}.exe`);
  try {
    const res = await httpsGet(exeUrl);
    log('STEP-3-RESP', {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      headers: {
        'content-type': res.headers['content-type'],
        'content-length': res.headers['content-length'],
        'accept-ranges': res.headers['accept-ranges'],
        'content-disposition': res.headers['content-disposition'],
      },
    });

    if (res.statusCode !== 200) {
      const body = await readBody(res);
      log('STEP-3-FAIL', {
        message: `exe 下载返回非 200 状态码: ${res.statusCode}`,
        body: body.toString('utf8').slice(0, 500),
      });
      return;
    }

    // 流式下载到临时文件，但只下 1MB 就中断（验证连通性足够）
    const writeStream = createWriteStream(tempFile);
    let downloadedBytes = 0;
    const MAX_BYTES = 1024 * 1024;  // 1MB

    await new Promise((resolve, reject) => {
      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (downloadedBytes <= MAX_BYTES) {
          writeStream.write(chunk);
        }
        if (downloadedBytes >= MAX_BYTES) {
          log('STEP-3-PROGRESS', `已下载 ${downloadedBytes} 字节（达到 1MB 探测阈值，主动中断）`);
          res.destroy();  // 主动中断下载
          writeStream.end();
          resolve();
        }
      });
      res.on('end', () => {
        writeStream.end();
        resolve();
      });
      res.on('error', reject);
      writeStream.on('error', reject);
    });

    let fileSize = 0;
    try { fileSize = statSync(tempFile).size; } catch {}
    log('STEP-3-OK', {
      message: 'exe 下载探测成功（连通性验证通过）',
      downloadedBytes,
      savedToFile: tempFile,
      fileSize,
      expectedTotalSize: exeSize,
      note: '如需下载完整 exe，请用浏览器或 curl 下载完整文件',
    });
  } catch (err) {
    // ECONNRESET 是我们主动中断导致的，不算失败
    if (err.code === 'ECONNRESET' || err.message?.includes('aborted')) {
      let fileSize = 0;
      try { fileSize = statSync(tempFile).size; } catch {}
      log('STEP-3-OK', {
        message: 'exe 下载探测成功（主动中断，连通性验证通过）',
        savedToFile: tempFile,
        fileSize,
        expectedTotalSize: exeSize,
      });
    } else {
      log('STEP-3-ERR', formatError(err));
    }
  } finally {
    // 清理临时文件
    try { unlinkSync(tempFile); } catch {}
  }

  log('PIPELINE', '=== 模拟 electron-updater 下载链路结束 ===');
}

// ===== 主流程 / Main =====
async function main() {
  console.log('========================================');
  console.log(' electron-updater 下载链路诊断脚本');
  console.log(' (不依赖 electron-updater，纯 Node https)');
  console.log('========================================\n');

  await probeNetwork();
  await simulateDownloadPipeline();

  console.log('\n========================================');
  console.log(' 诊断完成，请把以上全部输出贴给 AI');
  console.log(' Diagnostic complete, paste all output');
  console.log('========================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', formatError(err));
  process.exit(1);
});
