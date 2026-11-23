// 护栏：大范围删除、强制覆盖、清空数据，要等用户明确同意。
import { approves } from '../lib.mjs';

const DANGER_CMD = new RegExp(
  [
    String.raw`\brm\s+(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b`,
    String.raw`\bRemove-Item\b[^\n]*-Recurse\b`,
    String.raw`\b(rd|rmdir)\s+\/s\b`,
    String.raw`\bdel\s+(\/[a-zA-Z]\s+)*\/[sS]\b`,
    String.raw`\bgit\s+reset\s+--hard\b`,
    String.raw`\bgit\s+clean\s+-[a-zA-Z]*f`,
    String.raw`\bgit\s+push\b[^\n]*(--force\b|\s-f\b)`,
    String.raw`\bgit\s+checkout\s+--\s+\.`,
    String.raw`\bDROP\s+(TABLE|DATABASE|SCHEMA)\b`,
    String.raw`\bTRUNCATE\s+(TABLE\s+)?\w`,
  ].join('|'),
  'i',
);
// 删除这些可再生成的目录不需要问。
const REBUILDABLE = /^(\.\/)?(node_modules|dist|build|out|\.next|\.nuxt|\.cache|\.turbo|coverage|__pycache__|\.pytest_cache|target|tmp|temp)\/?$/i;
const APPROVAL = /删|刪|清空|清掉|移除|重置|delete|remove|wipe|reset|drop/i;

// 整条命令只是用 rm 或 Remove-Item 删除可再生成的目录时，视为安全。
function onlyRebuildable(command) {
  const m = command.match(/^\s*(rm|Remove-Item)\s+(.+)$/i);
  if (!m || /[;&|]/.test(m[2])) return false;
  const targets = m[2]
    .split(/\s+/)
    .filter((t) => t && !t.startsWith('-'))
    .map((t) => t.replace(/^["']|["']$/g, ''));
  return targets.length > 0 && targets.every((t) => REBUILDABLE.test(t));
}

export function check(ctx) {
  if (!ctx.command || !DANGER_CMD.test(ctx.command)) return [];
  if (onlyRebuildable(ctx.command)) return [];
  if (approves(ctx.userText, APPROVAL)) return [];
  return [
    '【小白护栏·删除】这条命令会大范围删除、覆盖或清空东西，删掉后可能找不回来，用户还没有明确同意。先停下，用白话列出会删掉什么、能不能恢复，等用户说“删”后再执行。',
  ];
}
