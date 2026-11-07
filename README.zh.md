# TLS 信任锚点

在 DeepSeek Harness 设置里新增一个「**证书信任**」分区：把某个主机标记为跳过 TLS 证书校验，让自签证书背后的私有模型网关能连上，而不是报 `Connection error`。

[English](README.md)

## 要解决的问题

Node.js 用自己的 **CA 库**校验证书，从不读取 macOS 或 Windows 的系统信任存储。所以 Safari、Chrome 或 Bun 写的 CLI 能接受的证书，在 Harness 运行时里仍然可能被拒绝：

```
UNABLE_TO_VERIFY_LEAF_SIGNATURE | unable to verify the first certificate
```

自签的叶子证书（`Basic Constraints: CA:FALSE`）本身根本不能充当信任锚 —— 除非让 OpenSSL 接受 partial chain，而 Node 并不通过 provider 配置暴露这个开关。现有的模型接入配置里也没有任何证书或信任相关的选项。

## 能做什么

- **按主机开关** —— 添加 `newapi.example.com`，决定是否为它跳过校验，随时移除。决定只对这一个主机生效。
- **不动全局** —— 不设环境变量、不改证书存储、不影响其他应用。其余连接一律保持标准校验：过期、未知根、域名不匹配全都照拦。
- **持久化** —— 列表存在 `~/.dsh/tls-trust/trusted-hosts.json`，重启不丢。
- **即时生效** —— 宿主直接给运行时的 `tls.connect` 打补丁，开关在下一个请求就生效，不用重启。

## 安装

### 环境要求

- DeepSeek Harness 0.2.x 桌面版或 Web profile，且已开启第三方插件安装
- 你想信任的那个模型服务端点

### 安装来源

Harness 的插件管理支持从 GitHub 仓库或 npm 包安装：

- **GitHub 仓库**：`https://github.com/spark-ai-boy/dsh-tls-trust-anchor`
- **npm 包**：`dsh-tls-trust-anchor`

### 步骤

1. 打开 **设置 → 插件**，从仓库或 npm 安装这个 bundle。
2. 打开 **设置 → 模型**，填 `baseURL`、API 类型和 key 添加你的 provider。`baseURL` 是 API 根路径，填 `https://newapi.example.com` —— **不要**带 `/v1`，因为客户端自己会拼 `/v1/messages`。
3. 打开 **设置 → 证书信任**，输入主机名，点「添加主机」。开关默认开启（跳过校验）。
4. 回到对话，选择该模型。

## 安全性

跳过校验只意味着连接仍然**加密**，但不再**证明对端身份**。只在你掌控的证书上使用，有条件时优先换成正规签发的证书。信任范围是刻意收窄的：版本检查、证书过期、未知根，在其他任何主机上依然会被拒绝。

把主机从列表里移除后，下一个请求就立即恢复标准校验。

## 实现方式

| 部分 | 行为 |
|---|---|
| 宿主（`index.js`） | 读取持久化列表、在 Harness 运行时内给 `tls.connect` 打补丁、提供 `tlsTrust` Remote 服务 |
| 客户端（`client.js`） | 注册一个 `settings.section` 分区，渲染列表、开关和删除按钮 |
| 状态（`src/host/state.js`） | 主机名规范化和 JSON 持久化 |

只有 `servername`/`host` 命中信任列表的连接会被设置 `rejectUnauthorized: false`，其余连接原样透传。

## 已知限制

- 宿主代码 `import` 了 `@deepseek-ai/dsh-typert-protocol`，由 Harness 安装本身提供，不随本包打包。
- 没有生成 Typert 产物时，Remote 方法的参数名是从宿主源码签名里解析的，所以 `client.js` 描述符里的参数名必须与宿主方法签名逐字一致。

## 开发

```bash
node --test "tests/*.test.js"   # 单元测试
npm run check                   # 语法检查 + 测试
```

## 许可

MIT
