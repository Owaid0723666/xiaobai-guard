// 卸载小白护栏：只移除本工具装进去的内容，其他设置保持原样。
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const TARGET = join(CLAUDE_DIR, 'xiaobai-guard');
const SETTINGS = join(CLAUDE_DIR, 'settings.json');
const MEMORY = join(CLAUDE_DIR, 'CLAUDE.md');
const SKILL_TARGET = join(CLAUDE_DIR, 'skills', 'error-doctor');
const MARK = 'xiaobai-guard';

const slash = (p) => p.replace(/\\/g, '/');
const importLine = `@${slash(join(TARGET, 'CLAUDE.md'))}`;

// 1. 从 settings.json 移除护栏登记。
if (existsSync(SETTINGS)) {
  let settings;
  try {
    settings = JSON.parse(readFileSync(SETTINGS, 'utf8'));
  } catch {
    console.error(`无法读取 ${SETTINGS}：文件内容不是有效的 JSON，没有改动它。`);
  }
  const list = settings && settings.hooks && settings.hooks.PreToolUse;
  if (Array.isArray(list)) {
    const kept = list.filter((entry) => !(entry.hooks || []).some((h) => String(h.command || '').includes(MARK)));
    if (kept.length !== list.length) {
      if (kept.length) settings.hooks.PreToolUse = kept;
      else delete settings.hooks.PreToolUse;
      if (!Object.keys(settings.hooks).length) delete settings.hooks;
      writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
      console.log('- 已从 settings.json 移除护栏。');
    }
  }
}

// 2. 从全局 CLAUDE.md 移除规矩引用。
if (existsSync(MEMORY)) {
  const memory = readFileSync(MEMORY, 'utf8');
  if (memory.includes(importLine)) {
    const cleaned = memory
      .split(/\r?\n/)
      .filter((line) => line.trim() !== importLine)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
    writeFileSync(MEMORY, cleaned.trim() ? `${cleaned.replace(/\n+$/, '')}\n` : '');
    console.log('- 已从全局 CLAUDE.md 移除规矩引用。');
  }
}

// 3. 删除本工具的文件夹；报错急救技能只在确认是本工具装的时才删除。
if (existsSync(TARGET)) {
  rmSync(TARGET, { recursive: true, force: true });
  console.log(`- 已删除 ${TARGET}`);
}
const skillFile = join(SKILL_TARGET, 'SKILL.md');
if (existsSync(skillFile) && readFileSync(skillFile, 'utf8').includes('# 报错急救')) {
  rmSync(SKILL_TARGET, { recursive: true, force: true });
  console.log(`- 已删除 ${SKILL_TARGET}`);
}
console.log('小白护栏已卸载，重新打开 Claude Code 后生效。');
