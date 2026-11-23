# xiaobai-guard

Guardrails for people who build things with Claude Code but cannot read code. "Xiaobai" (小白) is Chinese for a complete beginner.

Once installed, Claude Code will:

- ask before it pushes code, publishes or deploys;
- ask before it deletes folders or wipes data;
- stop spawning extra subagents for small tasks, which quietly burn your usage;
- stop and explain when it keeps running the same command in a loop;
- explain errors in plain language: what happened, whether it matters, and what you need to do;
- talk plainly, and verify its work before saying it is done.

## Install

You need Claude Code and Node.js 18 or newer.

1. Download this repository (Code → Download ZIP) and unzip it.
2. Open a terminal in the unzipped folder and run:

```
node install.mjs
```

3. Restart Claude Code.

The installer backs up `settings.json` and `CLAUDE.md` first and prints where the backups are. Running it twice does not add anything twice.

## Uninstall

```
node uninstall.mjs
```

Only what this tool added is removed. Your own settings and rules stay as they were.

## What is inside

| Part | What it does |
| --- | --- |
| Plain-language rules (`rules/CLAUDE.md`) | Claude speaks plainly, always mentions spending and deleting, verifies before saying "done", and stops to ask after two failed attempts. The rules are written in Chinese. |
| Publish guard | Blocks `git push`, `npm publish`, `vercel --prod`, `railway up` and similar commands until you clearly approve. |
| Delete guard | Blocks `rm -rf`, `Remove-Item -Recurse`, `git reset --hard`, `DROP TABLE` and similar commands until you clearly approve. Rebuildable folders such as `node_modules` and `dist` are not blocked. |
| Subagent guard | At most 2 subagents per conversation unless you ask for them. |
| Loop guard | Stops the third identical command in a row when nothing was edited in between. |
| Error doctor (`skills/error-doctor`) | Explains 529, 429, 401, usage limits, timeouts, "prompt is too long" and more, with the next step. |

## How approval is detected

The guards look at your most recent message for approval words such as "push", "deploy", "publish", "推", "发布" or "删". Negated phrases like "don't push" or "先别推" do not count. When unsure, the guard treats it as not approved and Claude asks again.

## Settings

Create `xiaobai-guard.json` in your Claude Code config folder (usually `~/.claude`):

```json
{
  "maxAgentsWithoutAsking": 2,
  "maxSameCommandInARow": 2
}
```

## Known limits

- Only commands Claude Code runs in the terminal are guarded. Buttons clicked on websites or other tools are not.
- Approval is detected by keywords and is not perfect.
- Only common publish and delete commands are covered; see `hooks/checks`.
- Claude Code only for now.

## Tests

```
node test/run.mjs
```

Runs every check and rehearses install and uninstall in a temporary folder without touching your real settings.

## License

MIT
