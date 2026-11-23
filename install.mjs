// 安装小白护栏：把规矩、护栏和报错急救技能装进 Claude Code 的设置目录。
// 改动前会备份 settings.json 和 CLAUDE.md；重复运行不会重复添加。
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const TARGET = join(CLAUDE_DIR, 'xiaobai-guard');
const SETTINGS = join(CLAUDE_DIR, 'settings.json');
const MEMORY = join(CLAUDE_DIR, 'CLAUDE.md');
const SKILL_TARGET = join(CLAUDE_DIR, 'skills', 'error-doctor');
const MARK = 'xiaobai-guard';
const MATCHER = 'Bash|PowerShell|Agent|Task|Write|Edit|MultiEdit|NotebookEdit';

const slash = (p) => p.replace(/\\/g, '/');
const guardCommand = `node "${slash(join(TARGET, 'hooks', 'guard.mjs'))}"`;
const importLine = `@${slash(join(TARGET, 'CLAUDE.md'))}`;

function backup(file) {
  if (!existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const copy = `${file}.${MARK}-${stamp}.bak`;
  copyFileSync(file, copy);
  return copy;
}

function readSettings() {
  if (!existsSync(SETTINGS)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS, 'utf8'));
  } catch {
    console.error(`无法读取 ${SETTINGS}：文件内容不是有效的 JSON。为避免弄坏设置，本次没有做任何改动。`);
    process.exit(1);
  }
}

const settings = readSettings();
mkdirSync(CLAUDE_DIR, { recursive: true });

// 1. 复制护栏和规矩。
cpSync(join(HERE, 'hooks'), join(TARGET, 'hooks'), { recursive: true });
copyFileSync(join(HERE, 'rules', 'CLAUDE.md'), join(TARGET, 'CLAUDE.md'));

// 2. 安装报错急救技能；同名技能不是本工具装的就不覆盖。
let skillNote = '已安装报错急救技能 error-doctor。';
const skillFile = join(SKILL_TARGET, 'SKILL.md');
if (existsSync(skillFile) && !readFileSync(skillFile, 'utf8').includes('# 报错急救')) {
  skillNote = `已存在同名技能 ${SKILL_TARGET}，不是本工具安装的，没有覆盖。`;
} else {
  cpSync(join(HERE, 'skills', 'error-doctor'), SKILL_TARGET, { recursive: true });
}

// 3. 在 settings.json 里登记护栏。
settings.hooks = settings.hooks || {};
settings.hooks.PreToolUse = settings.hooks.PreToolUse || [];
const registered = settings.hooks.PreToolUse.some((entry) =>
  (entry.hooks || []).some((h) => String(h.command || '').includes(MARK)),
);
let settingsBackup = null;
if (!registered) {
  settingsBackup = backup(SETTINGS);
  settings.hooks.PreToolUse.push({
    matcher: MATCHER,
    hooks: [{ type: 'command', command: guardCommand, timeout: 10 }],
  });
  writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
}

// 4. 在全局 CLAUDE.md 里引用规矩。
let memoryBackup = null;
const memory = existsSync(MEMORY) ? readFileSync(MEMORY, 'utf8') : '';
if (!memory.includes(importLine)) {
  memoryBackup = backup(MEMORY);
  const joined = memory && !memory.endsWith('\n') ? `${memory}\n` : memory;
  writeFileSync(MEMORY, `${joined}${joined ? '\n' : ''}${importLine}\n`);
}

console.log('小白护栏安装完成。');
console.log(`- 规矩和护栏放在：${TARGET}`);
console.log(`- ${skillNote}`);
console.log(registered ? '- 护栏之前已登记过，这次没有重复添加。' : '- 已在 settings.json 登记护栏。');
console.log(memory.includes(importLine) ? '- 规矩之前已引用过，这次没有重复添加。' : '- 已在全局 CLAUDE.md 引用规矩。');
if (settingsBackup) console.log(`- settings.json 改动前的备份：${settingsBackup}`);
if (memoryBackup) console.log(`- CLAUDE.md 改动前的备份：${memoryBackup}`);
console.log('重新打开 Claude Code 后生效。');
