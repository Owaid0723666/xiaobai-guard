// 护栏：同一条命令在中间没有任何修改的情况下连续重复执行时叫停，避免原地打转消耗额度。
// 中间改过文件再执行同一条命令（例如改完代码再跑一次测试）属于正常操作，不计入重复。
import { readState, writeState } from '../lib.mjs';

const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

function normalize(command) {
  return command.replace(/\s+/g, ' ').trim();
}

export function check(ctx) {
  const state = readState(ctx.sessionId);
  if (EDIT_TOOLS.has(ctx.tool)) {
    if (state.lastCommand) {
      state.lastCommand = null;
      state.sameCount = 0;
      writeState(ctx.sessionId, state);
    }
    return [];
  }
  if (!ctx.command) return [];
  const cmd = normalize(ctx.command);
  const count = state.lastCommand === cmd ? Number(state.sameCount || 0) : 0;
  if (count >= ctx.config.maxSameCommandInARow) {
    return [
      `【小白护栏·打转】同一条命令已经连续执行了 ${count} 次，中间没有做任何修改。不要再重复：先停下，用白话告诉用户卡在哪里、试过什么、接下来有哪几种办法，请用户选择。`,
    ];
  }
  state.lastCommand = cmd;
  state.sameCount = count + 1;
  writeState(ctx.sessionId, state);
  return [];
}
