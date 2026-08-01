# cc-connect 执行内核接入：Phase 2

本分支尚未把 cc-connect 客户端接入 Lark Bridge 运行时。Phase 1 继续使用
现有 Codex CLI Adapter；本文件只记录下一阶段的协议边界和验收条件。

提供的独立融合源码包包含一个可测试的本地 WebSocket 协议客户端，计划在
Phase 2 评审后再以默认关闭的方式纳入：

- token 查询参数连接；
- `register` / `register_ack`；
- 发送 project-scoped `message`；
- 接收 `reply`、`card`、`buttons`、`preview_start`、`update_message`；
- 发送 `card_action`，包括 `perm:allow`、`perm:deny`、`perm:allow_all`；
- preview acknowledgement；
- ping/pong 与断线状态。

当前尚未把这层替换成 Lark Bridge 的正式 `AgentAdapter`，原因是 Lark Bridge 当前 `AgentEvent` 没有表达“审批请求/交互卡片”的稳定事件类型。强行翻译成纯文本会丢掉 cc-connect 的核心价值。

下一阶段应先扩展统一事件契约：

```ts
type AgentEvent =
  | ExistingEvents
  | { type: 'approval_request'; requestId: string; title: string; detail: string; actions: ApprovalAction[] }
  | { type: 'user_question'; requestId: string; question: string; options?: QuestionOption[] }
  | { type: 'progress_handle'; handle: string; content: string };
```

然后完成：

1. `CcConnectAgentAdapter` 把 Bridge server frames 翻译为统一事件；
2. Lark Card dispatcher 将按钮回传为 `card_action`；
3. 每个飞书 scope 绑定稳定 `session_key` 和 cc-connect project；
4. Project Memory 的项目路径映射到 cc-connect project 名；
5. cc-connect 不可用时显式降级到现有 Codex CLI Adapter。

安全要求：Bridge 只监听 `127.0.0.1`，必须配置强 token；禁止把 token 写入仓库或飞书消息。
