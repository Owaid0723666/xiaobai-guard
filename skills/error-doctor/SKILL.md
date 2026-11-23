---
name: error-doctor
description: 当 Claude Code 或模型接口报错时使用，例如 529 Overloaded、Request rejected (429)、Invalid API key、401、Credit balance is too low、You've hit your session limit、Request timed out、Prompt is too long、连接失败、模型不存在。用大白话告诉用户发生了什么、要不要紧、用户要做什么、你接下来做什么。用户说“报错了”“卡住了”“用不了了”“一直转圈”时也使用。
---

# 报错急救

用户不会写代码。出错时，你的任务是把报错翻译成大白话，并给出下一步，而不是反复重试。

## 处理步骤

1. 找到完整的报错原文（终端里红色或以 `API Error` 开头的那一行），不要凭印象猜。
2. 在下表里找对应的一行。找不到时，按“表里没有的报错”一节处理。
3. 用下面的格式回复用户，四段都要有：
   - 发生了什么：一句白话。
   - 要不要紧：会不会丢东西、会不会扣钱、会不会自己恢复。
   - 你要做什么：用户需要动手的步骤；要复制的命令单独占一行。不需要用户动手就写“不用做什么”。
   - 我接下来做什么：你打算怎么继续。
4. 同一个报错连续出现两次后，不要第三次重试同样的操作，停下来让用户选择。

## 常见报错对照表

| 报错原文（或包含这些字） | 白话意思 | 要不要紧 | 处理办法 |
| --- | --- | --- | --- |
| `Repeated 529 Overloaded errors` | 服务器那边暂时太忙，所有人都受影响。 | 不扣你的额度，不会丢东西，通常几分钟内恢复。 | 等一两分钟再试。一直不好，打开 https://status.claude.com 看官方状态；用第三方接口时看该服务商的状态页。 |
| `Request rejected (429)` | 你这个密钥或账号在短时间内请求太多，被限速了。 | 不会丢东西，等一会儿会恢复。 | 先输入 `/status` 确认正在用的是哪个账号或密钥；少开同时运行的子代理；稍后再试。用第三方接口时，到对方后台查看限额。 |
| `Invalid API key` 或 `401` | 密钥不对：写错、复制不完整、过期或已被停用。 | 不会丢东西，但在换对密钥之前一直用不了。 | 检查环境变量 `ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN` 的值有没有多余的空格、是不是完整复制；必要时到服务商后台重新生成一个。 |
| `Credit balance is too low` | 按量付费的余额用完了；也可能是环境里多了一个按量付费的密钥，盖过了你的订阅。 | 不会丢东西；充值或改用订阅后恢复。 | 充值；或检查环境变量里是否有多余的 `ANTHROPIC_API_KEY`。 |
| `You've hit your session limit`、`weekly limit`、`Opus limit`、`Sonnet limit` | 订阅套餐这段时间的额度用完了。 | 没坏，到报错里写的时间会自动恢复。 | 等到显示的恢复时间；着急的话用 `/model` 换一个还有额度的模型。 |
| `Request timed out` | 接口在规定时间内没有回应（默认等 10 分钟）。 | 这一步没做完，需要重来；已经保存的文件不受影响。 | 检查网络和代理；用第三方接口时，可能是对方在排队，稍后再试。 |
| `Prompt is too long` | 这一轮塞进去的内容太多（系统说明、工具定义或附件太大）。 | 不会丢东西，但这样继续不下去。 | 开一个新对话；不要一次贴很大的文件；关掉用不到的 MCP 工具。 |
| `does not support this model` 加 `version ... or newer is required` | 你的 Claude Code 版本太旧，用不了这个模型。 | 不会丢东西，升级后就好。 | 运行下面这行，再开一个新对话。 |
| 包含 `connect`、`ECONNRESET`、`ETIMEDOUT`、`fetch failed` | 连不上接口，多半是网络、代理或接口地址的问题。 | 不会丢东西。 | 检查网络和代理；用第三方接口时，检查 `ANTHROPIC_BASE_URL` 有没有写错，地址结尾不要自己加 `/v1`。 |
| 包含 `404` 或 `model not found` | 模型名字写错了，或者这个接口不提供这个模型。 | 不会丢东西。 | 输入 `/model` 换一个列表里有的模型；用第三方接口时，按对方文档里的模型名填写。 |

版本太旧时让用户运行：

```
claude update
```

## 用第三方接口时，确认接口本身通不通

设置了 `ANTHROPIC_BASE_URL` 时，报错多半来自第三方服务商。先在终端发一个最小请求确认地址和密钥能用。返回内容以 `{"id":"msg_` 开头就是通的；返回 401 就是密钥被拒绝。

macOS 或 Linux：

```
curl -s "$ANTHROPIC_BASE_URL/v1/messages" -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d '{"model":"claude-sonnet-4-6","max_tokens":1,"messages":[{"role":"user","content":"."}]}'
```

Windows PowerShell：

```
Invoke-RestMethod -Method Post -Uri "$env:ANTHROPIC_BASE_URL/v1/messages" -Headers @{ "Authorization" = "Bearer $env:ANTHROPIC_AUTH_TOKEN"; "anthropic-version" = "2023-06-01" } -ContentType "application/json" -Body '{"model": "claude-sonnet-4-6", "max_tokens": 1, "messages": [{"role": "user", "content": "."}]}'
```

模型名按服务商实际提供的填写。

## 表里没有的报错

1. 把报错原文完整念给用户听（原样贴出，单独占一行）。
2. 到官方报错说明页查找同样的文字：https://code.claude.com/docs/en/errors
3. 查到了就按上面的四段格式回复；查不到就直接说“这个报错我没查到说明”，并说出你打算怎么排查，不要编造原因。
