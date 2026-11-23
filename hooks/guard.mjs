// 小白护栏入口：在 Claude Code 执行工具之前逐项检查，有任何一项不通过就拦下，并把原因交回给 Claude。
// 单项检查出错时略过该项；读不到输入时一律放行，不挡住正常工作。
import { readFileSync } from 'node:fs';
import { lastUserText, loadConfig } from './lib.mjs';
import * as publish from './checks/publish.mjs';
import * as del from './checks/delete.mjs';
import * as agents from './checks/agents.mjs';
import * as repeat from './checks/repeat.mjs';

const CHECKS = [publish, del, agents, repeat];

function buildContext(input) {
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};
  const ctx = {
    tool,
    input: ti,
    sessionId: input.session_id || 'unknown',
    command: tool === 'Bash' || tool === 'PowerShell' ? String(ti.command || '') : null,
    config: loadConfig(),
  };
  let userText;
  Object.defineProperty(ctx, 'userText', {
    get() {
      if (userText === undefined) userText = lastUserText(input.transcript_path);
      return userText;
    },
  });
  return ctx;
}

try {
  const ctx = buildContext(JSON.parse(readFileSync(0, 'utf8')));
  const reasons = [];
  for (const item of CHECKS) {
    try {
      reasons.push(...(item.check(ctx) || []));
    } catch {
      // 单项检查出错时略过。
    }
    if (reasons.length) break;
  }
  if (reasons.length) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reasons.join('\n'),
        },
      }),
    );
  }
} catch {
  // 读不到输入时放行。
}
process.exit(0);
