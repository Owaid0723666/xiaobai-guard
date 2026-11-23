// 小白护栏自动测试：模拟 Claude Code 调用护栏，并在临时目录里演练安装与卸载。
// 运行方式：node test/run.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORK = mkdtempSync(join(tmpdir(), 'xiaobai-guard-test-'));
const env = {
  ...process.env,
  XIAOBAI_GUARD_STATE_DIR: join(WORK, 'state'),
  CLAUDE_CONFIG_DIR: join(WORK, 'claude'),
};
let failed = 0;
let passed = 0;

function transcript(userText) {
  const file = join(WORK, `t-${Math.random().toString(36).slice(2)}.jsonl`);
  const lines = [
    { type: 'user', message: { role: 'user', content: userText } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: '好的' }] } },
  ];
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return file;
}

function runGuard(input) {
  const r = spawnSync(process.execPath, [join(ROOT, 'hooks', 'guard.mjs')], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env,
    encoding: 'utf8',
  });
  if (!r.stdout.trim()) return 'allow';
  const out = JSON.parse(r.stdout);
  return out.hookSpecificOutput.permissionDecision;
}

function expect(name, actual, wanted) {
  if (actual === wanted) {
    passed++;
  } else {
    failed++;
    console.log(`不通过：${name}（期望 ${wanted}，实际 ${actual}）`);
  }
}

function bash(session, userText, command) {
  return runGuard({
    session_id: session,
    transcript_path: transcript(userText),
    tool_name: 'Bash',
    tool_input: { command },
  });
}

function tool(session, userText, name, toolInput = {}) {
  return runGuard({ session_id: session, transcript_path: transcript(userText), tool_name: name, tool_input: toolInput });
}

// 发布护栏
expect('没同意时拦下 git push', bash('s1', '帮我把按钮改成蓝色', 'git push origin main'), 'deny');
expect('说了推之后放行 git push', bash('s2', '没问题，推吧', 'git push origin main'), 'allow');
expect('没同意时拦下 npm publish', bash('s3', '检查一下', 'npm publish'), 'deny');
expect('没同意时拦下 vercel 正式发布', bash('s4', '看看效果', 'vercel deploy --prod'), 'deny');
expect('普通命令放行', bash('s5', '跑一下测试', 'npm test'), 'allow');
expect('说“先别推”不算同意', bash('s6', '改好了先别推，我看看', 'git push'), 'deny');
expect('说“don\'t push”不算同意', bash('s7', "looks good but don't push yet", 'git push'), 'deny');
expect('英文明确同意放行', bash('s8', 'ok, push it', 'git push'), 'allow');
expect('说“不要删”不算同意', bash('d0', '旧文件不要删', 'rm -rf old'), 'deny');
expect('说“不要开子代理”不算同意', (tool('a0', '查一下，不要开子代理', 'Agent'), tool('a0', '查一下，不要开子代理', 'Agent'), tool('a0', '查一下，不要开子代理', 'Agent')), 'deny');

// 删除护栏
expect('没同意时拦下 rm -rf src', bash('d1', '整理一下项目', 'rm -rf src'), 'deny');
expect('删除可再生成目录放行', bash('d2', '整理一下项目', 'rm -rf node_modules dist'), 'allow');
expect('说了删之后放行', bash('d3', '把旧的那个文件夹删了', 'rm -rf old'), 'allow');
expect('没同意时拦下 git reset --hard', bash('d4', '恢复一下', 'git reset --hard HEAD~1'), 'deny');
expect('没同意时拦下 PowerShell 递归删除', tool('d5', '清理一下', 'PowerShell', { command: 'Remove-Item -Recurse -Force C:\\proj\\src' }), 'deny');
expect('删除单个文件放行', bash('d6', '整理一下项目', 'rm notes.txt'), 'allow');
expect('PowerShell 删除可再生成目录放行', tool('d7', '清理一下', 'PowerShell', { command: 'Remove-Item -Recurse -Force node_modules' }), 'allow');
expect('串接其他命令时照常拦下', bash('d8', '清理一下', 'rm -rf dist && rm -rf src'), 'deny');

// 子代理护栏
expect('第 1 个子代理放行', tool('a1', '查一下这个问题', 'Agent', { prompt: 'x' }), 'allow');
expect('第 2 个子代理放行', tool('a1', '查一下这个问题', 'Agent', { prompt: 'x' }), 'allow');
expect('第 3 个子代理拦下', tool('a1', '查一下这个问题', 'Agent', { prompt: 'x' }), 'deny');
expect('用户要求并行时放行', tool('a1', '开几个子代理并行做', 'Agent', { prompt: 'x' }), 'allow');

// 打转护栏
expect('第 1 次执行放行', bash('r1', '修一下', 'npm run build'), 'allow');
expect('第 2 次执行放行', bash('r1', '修一下', 'npm run build'), 'allow');
expect('第 3 次连续执行拦下', bash('r1', '修一下', 'npm run build'), 'deny');
expect('改过文件后再执行放行', (tool('r1', '修一下', 'Edit', { file_path: 'a.js' }), bash('r1', '修一下', 'npm run build')), 'allow');
expect('换一条命令放行', bash('r2', '修一下', 'npm test'), 'allow');

// 异常输入
expect('读不懂的输入一律放行', runGuard('不是 JSON'), 'allow');
expect('没有对话记录时照常判断', runGuard({ session_id: 'n1', tool_name: 'Bash', tool_input: { command: 'git push' } }), 'deny');

// 安装与卸载演练
const claudeDir = join(WORK, 'claude');
mkdirSync(claudeDir, { recursive: true });
const existing = { theme: 'dark', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }] } };
writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify(existing, null, 2));
writeFileSync(join(claudeDir, 'CLAUDE.md'), '# 我自己的规矩\n');
const run = (script) => spawnSync(process.execPath, [join(ROOT, script)], { env, encoding: 'utf8' });

run('install.mjs');
run('install.mjs');
const after = JSON.parse(readFileSync(join(claudeDir, 'settings.json'), 'utf8'));
const guardEntries = after.hooks.PreToolUse.filter((e) => e.hooks.some((h) => h.command.includes('xiaobai-guard')));
expect('安装后登记了护栏', guardEntries.length, 1);
expect('安装保留原有设置', after.theme, 'dark');
expect('安装保留原有钩子', after.hooks.Stop.length, 1);
const memory = readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf8');
expect('安装保留原有规矩', memory.startsWith('# 我自己的规矩'), true);
expect('规矩只引用一次', memory.split('xiaobai-guard/CLAUDE.md').length - 1, 1);
expect('技能已安装', existsSync(join(claudeDir, 'skills', 'error-doctor', 'SKILL.md')), true);
expect('护栏文件已复制', existsSync(join(claudeDir, 'xiaobai-guard', 'hooks', 'guard.mjs')), true);

run('uninstall.mjs');
const removed = JSON.parse(readFileSync(join(claudeDir, 'settings.json'), 'utf8'));
expect('卸载后移除护栏登记', removed.hooks.PreToolUse, undefined);
expect('卸载保留原有钩子', removed.hooks.Stop.length, 1);
expect('卸载后规矩恢复原样', readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf8'), '# 我自己的规矩\n');
expect('卸载后删除护栏文件夹', existsSync(join(claudeDir, 'xiaobai-guard')), false);
expect('卸载后删除技能', existsSync(join(claudeDir, 'skills', 'error-doctor')), false);

rmSync(WORK, { recursive: true, force: true });
console.log(`通过 ${passed} 项，不通过 ${failed} 项。`);
process.exit(failed ? 1 : 0);
