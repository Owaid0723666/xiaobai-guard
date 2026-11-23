// 护栏：限制子代理数量，避免一件小事开出很多“分身”大量消耗额度。
import { readState, writeState, approves } from '../lib.mjs';

const AGENT_TOOLS = new Set(['Agent', 'Task']);
const MENTIONED = /子代理|代理|分身|帮手|幫手|并行|並行|同时做|同時做|subagent|sub-agent|agent|parallel/i;

export function check(ctx) {
  if (!AGENT_TOOLS.has(ctx.tool)) return [];
  if (approves(ctx.userText, MENTIONED)) return [];
  const state = readState(ctx.sessionId);
  const used = Number(state.agents || 0);
  if (used >= ctx.config.maxAgentsWithoutAsking) {
    return [
      `【小白护栏·子代理】这次对话已经开了 ${used} 个子代理，每个都会额外消耗额度。能自己做的活自己做；确实需要再开，先用白话告诉用户为什么要开、大概多花多少，等用户同意。`,
    ];
  }
  state.agents = used + 1;
  writeState(ctx.sessionId, state);
  return [];
}
