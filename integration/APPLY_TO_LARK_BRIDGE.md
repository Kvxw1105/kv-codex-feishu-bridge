# 接入 Lark Coding Agent Bridge

本包的第一阶段改动只负责“项目记忆与自动工作区路由”，不会更换现有 Codex 登录、飞书 App、模型或权限配置。

## 自动应用

在本包根目录运行：

```powershell
node scripts/apply-to-lark-bridge.mjs "D:\path\to\lark-coding-agent-bridge" --dry-run
node scripts/apply-to-lark-bridge.mjs "D:\path\to\lark-coding-agent-bridge"
```

脚本会：

1. 校验目标仓库的 `package.json` 名称必须为 `lark-channel-bridge`；
2. 校验每个修改锚点唯一存在；
3. 备份原始 `src/bot/channel.ts`；
4. 添加 `src/project-memory/`；
5. 添加 `src/integration/lark-project-routing-hook.ts`；
6. 在普通消息进入队列前执行项目识别；
7. 不覆盖现有同名文件，遇到冲突立即失败。

应用后运行：

```powershell
pnpm typecheck
pnpm test
pnpm build
```

## 配置项目根目录

Windows PowerShell 当前会话：

```powershell
$env:LARK_PROJECT_ROOTS = "D:\PROJECT_ROOT_1;D:\PROJECT_ROOT_2"
```

持久化到当前用户：

```powershell
[Environment]::SetEnvironmentVariable(
  "LARK_PROJECT_ROOTS",
  "D:\PROJECT_ROOT_1;D:\PROJECT_ROOT_2",
  "User"
)
```

重启 Lark Bridge 后，它会扫描这些根目录下最多三层的 Git/Node/Python/Rust/Go/Java 项目，并在：

```text
%USERPROFILE%\.lark-channel\project-memory.json
```

保存项目身份证、最近活跃时间和用户确认过的自然语言别名。

## 飞书验收

依次发送：

```text
看看那个笔记软件，继续改星图
```

预期：自动切换到 Sample Notes，显示“已定位”，然后执行原任务。

```text
看看那个 bridge 最近还有什么问题
```

预期：返回最多三个候选，回复数字后切换并继续原始任务。

```text
1
```

预期：选中的项目成为当前工作目录，旧 session 清空，原始“bridge”任务自动重放；该描述被保存为本地别名。

```text
/status
```

预期：仍由原有命令系统处理，不经过项目识别。

## 回滚

备份位于：

```text
<仓库>\.kv-fusion-backup\<时间戳>\src\bot\channel.ts
```

删除新增目录并恢复备份即可：

```text
src/project-memory
src/integration/lark-project-routing-hook.ts
```

本阶段不写飞书密钥，不读取 Codex 凭据，也不修改 cc-connect 配置。
