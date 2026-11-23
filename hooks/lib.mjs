// 各项检查共用的工具：读取用户最近一句话、读写会话状态、读取设置。
import { readFileSync, writeFileSync, existsSync, mkdirSync, openSync, readSync, fstatSync, closeSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const STATE_DIR = process.env.XIAOBAI_GUARD_STATE_DIR || join(tmpdir(), 'xiaobai-guard');
const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const CONFIG_FILE = join(CONFIG_DIR, 'xiaobai-guard.json');

const DEFAULT_CONFIG = {
  // 每个会话里，用户没提到子代理时最多允许开几个。
  maxAgentsWithoutAsking: 2,
  // 同一条命令最多允许连续执行几次。
  maxSameCommandInARow: 2,
};

export function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    // 设置文件写坏时使用默认值。
  }
  return { ...DEFAULT_CONFIG };
}

function stateFile(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_');
  return join(STATE_DIR, `${safe}.json`);
}

export function readState(sessionId) {
  try {
    return JSON.parse(readFileSync(stateFile(sessionId), 'utf8'));
  } catch {
    return {};
  }
}

export function writeState(sessionId, state) {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(stateFile(sessionId), JSON.stringify(state));
  } catch {
    // 写不进状态时不影响正常工作。
  }
}

// 判断用户这句话是否表示同意：句中出现同意用词，且前面紧挨着的不是否定词（例如“先别推”“不要开子代理”“don't push”不算同意）。
// 否定词和同意用词之间最多隔两个汉字；判断不准时宁可当作没同意，让 Claude 再问一次。
const NEGATION_ZH = /(别|別|不要|不用|不|勿|没|沒|暂不|暫不)[一-鿿]{0,2}\s*$/;
const NEGATION_EN = /\b(don't|dont|do not|not|never|no)\s+(\w+\s+)?$/i;

export function approves(text, wordsRegex) {
  const source = String(text || '');
  const re = new RegExp(wordsRegex.source, wordsRegex.flags.includes('g') ? wordsRegex.flags : `${wordsRegex.flags}g`);
  let m;
  while ((m = re.exec(source))) {
    const before = source.slice(Math.max(0, m.index - 16), m.index);
    if (!NEGATION_ZH.test(before) && !NEGATION_EN.test(before)) return true;
  }
  return false;
}

// 从对话记录尾部往回找用户最近一句亲口说的话，跳过系统插入的提醒和工具结果。
export function lastUserText(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return '';
  const fd = openSync(transcriptPath, 'r');
  try {
    const size = fstatSync(fd).size;
    const length = Math.min(size, 2 * 1024 * 1024);
    const buf = Buffer.alloc(length);
    readSync(fd, buf, 0, length, size - length);
    const lines = buf.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      let entry;
      try {
        entry = JSON.parse(lines[i]);
      } catch {
        continue;
      }
      if (entry.type !== 'user' || entry.isMeta || entry.isSidechain) continue;
      const content = entry.message && entry.message.content;
      let text = '';
      if (typeof content === 'string') text = content;
      else if (Array.isArray(content)) {
        text = content
          .filter((b) => b && b.type === 'text')
          .map((b) => b.text)
          .join('\n');
      }
      text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
      if (text) return text;
    }
    return '';
  } finally {
    closeSync(fd);
  }
}
