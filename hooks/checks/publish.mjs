// 护栏：推送代码、发布、上线，要等用户明确同意。
import { approves } from '../lib.mjs';

const PUBLISH_CMD = new RegExp(
  [
    String.raw`\bgit\s+push\b`,
    String.raw`\b(npm|pnpm|bun)\s+publish\b`,
    String.raw`\byarn\s+(npm\s+)?publish\b`,
    String.raw`\bvercel\b[^\n]*--prod\b`,
    String.raw`\bnetlify\s+deploy\b[^\n]*--prod\b`,
    String.raw`\brailway\s+up\b`,
    String.raw`\bfly(ctl)?\s+deploy\b`,
    String.raw`\bwrangler\s+(deploy|publish)\b`,
    String.raw`\bgh\s+release\s+create\b`,
    String.raw`\bfirebase\s+deploy\b`,
    String.raw`\beas\s+(submit|update)\b`,
  ].join('|'),
  'i',
);
const APPROVAL = /推送|推上|推吧|发布|發布|上线|上線|部署|push|deploy|publish|release|ship/i;

export function check(ctx) {
  if (!ctx.command || !PUBLISH_CMD.test(ctx.command)) return [];
  if (approves(ctx.userText, APPROVAL)) return [];
  return [
    '【小白护栏·发布】这条命令会把改动推到网上或发布出去，用户还没有明确同意。先停下，用一句白话告诉用户要推送或发布什么、会影响什么，等用户说“推”或“发布”后再执行。',
  ];
}
