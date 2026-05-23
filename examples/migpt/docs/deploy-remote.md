# MiGPT 远程常驻部署（V2）

Cooper MiGPT Server 运行在云 VPS 上，音箱 Client 主动连接 `ws://115.190.170.8:4399?token=...`。

## 架构

```
音箱 client ──ws+token──► Ubuntu VPS (PM2 → migpt :4399)
                              ▲
git tag v*.*.* ── GitHub Actions ── SSH deploy
```

## 一次性：VPS 初始化

1. Ubuntu 24.04 x64，安全组放行 **TCP 4399**
2. SSH 登录后：

```bash
curl -fsSL https://raw.githubusercontent.com/Mr-Poole3/open-xiaoai/main/examples/migpt/scripts/vps-bootstrap.sh | sudo bash
```

（或 clone 后 `sudo bash examples/migpt/scripts/vps-bootstrap.sh`）

3. 按 PM2 提示完成 `pm2 startup`（若 bootstrap 未自动完成）

## GitHub Secrets

在仓库 Settings → Secrets → Actions 配置：

| Secret | 说明 |
|---|---|
| `DOUBAO_APP_ID` | 火山引擎 App ID |
| `DOUBAO_ACCESS_KEY` | 火山引擎 Access Key |
| `OPEN_XIAOAI_TOKEN` | WebSocket 连接密钥（随机 32+ 字符） |
| `VPS_HOST` | 云主机 IP，如 `115.190.170.8` |
| `VPS_USER` | SSH 用户，如 `root` |
| `VPS_SSH_KEY` | SSH 私钥全文 |

可选：`DOUBAO_MODEL`、`DOUBAO_SPEAKER`、`MIGPT_SYSTEM_PROMPT` 等（见 `scripts/render-deploy-config.ts`）

## 发布

```bash
git tag v2.0.0
git push origin v2.0.0
```

Actions 流程：测试 → 构建 tar → SSH 部署到 `/opt/migpt/releases/<tag>/` → 切换 `current` 软链 → PM2 reload → WebSocket 冒烟；失败则自动回滚软链。

## 音箱配置（一次性）

在音箱上写入（SSH 登录后）：

```bash
echo 'ws://115.190.170.8:4399?token=<与 OPEN_XIAOAI_TOKEN 相同>' > /data/open-xiaoai/server.txt
pkill -f '/data/open-xiaoai/client' || true
/data/open-xiaoai/client "$(cat /data/open-xiaoai/server.txt)" >/dev/null 2>&1 &
```

若 Mac 已配置 SSH 密钥，可用切换脚本（见下）。

## 本地开发 vs 生产

```bash
cd examples/migpt
cp speaker.local.env.example speaker.local.env
# 编辑 SPEAKER_SSH、LOCAL_SERVER、PROD_SERVER

pnpm speaker:local   # 音箱连 Mac 局域网 IP，本地 pnpm start 调试
pnpm speaker:prod    # 音箱连云 VPS
```

`speaker.local.env` 已 gitignore，勿提交。

## 回滚

SSH 上 VPS：

```bash
ls /opt/migpt/releases/
ln -sfn /opt/migpt/releases/v2.0.0 /opt/migpt/current
cd /opt/migpt/current && pm2 reload migpt
```

保留最近 3 个 release（deploy 脚本自动清理更旧版本）。

## 环境变量（VPS 运行时）

| 变量 | 说明 |
|---|---|
| `OPEN_XIAOAI_TOKEN` | 与音箱 URL token 一致；未设置则关闭鉴权（仅本地开发） |

部署时由 Actions 写入 `current/.env`，PM2 通过 `--update-env` 加载。

## 手动冒烟

```bash
SMOKE_WS_URL="ws://115.190.170.8:4399?token=xxx" pnpm deploy:smoke
```
