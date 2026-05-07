# Q-Hub

Q-Hub 是一个基于 Electron、Vue 3 和 electron-vite 构建的桌面端网络诊断工具箱。

它面向本地网络排障场景，提供连通性检测、延迟监控、端口扫描、局域网设备发现、子网计算和本地脚本管理等功能。

> 本项目仅用于你自己拥有或已获得授权的网络和设备。请不要在未授权的第三方网络上进行扫描、探测或其他测试行为。

## 功能特性

- 查看本机系统和网络信息
- CPU 与内存使用率监控
- Ping 诊断，支持实时终端输出
- 常用公网服务延迟检测
- 指定主机和端口范围扫描
- Traceroute / tracert 路由追踪
- 当前网段局域网设备发现
- IPv4 子网和 CIDR 计算
- 本地脚本管理，支持 `.bat`、`.py`、`.sh`

## 当前状态

Q-Hub 目前仍处于早期本地自用阶段。

应用可以正常构建，但在更广泛分发前，还有一些地方需要继续加固：

- 网络命令执行逻辑需要从 shell 字符串执行迁移到更安全的参数数组执行。
- IPC 入参需要更严格的校验。
- 脚本运行功能只应执行可信的本地脚本。
- 代码中存在测速面板，但目前还没有完整接入应用。
- 当前主要测试平台是 Windows。

## 技术栈

- Electron
- Vue 3
- Vite / electron-vite
- electron-builder
- ESLint
- Prettier

## 项目结构

```text
src/
  main/
    index.js              Electron 主进程和 IPC 处理
  preload/
    index.js              暴露给渲染进程的桥接 API
  renderer/
    index.html
    src/
      App.vue             Vue 主界面
      main.js             渲染进程入口
      components/         功能面板组件
      assets/             样式和图标资源
```

## 安装依赖

```bash
npm install
```

## 开发运行

```bash
npm run dev
```

## 构建

```bash
npm run build
```

构建平台安装包：

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

## 代码检查

```bash
npm run lint
```

```bash
npm run format
```

## 安全说明

Q-Hub 可以执行本地网络命令，也可以运行用户选择的本地脚本。请将它视为可信本地桌面工具，而不是隔离的 Web 沙箱应用。

使用时请注意：

- 只运行你信任并理解内容的脚本。
- 只扫描你拥有或已获得授权的网络和设备。
- 分享截图、日志或 issue 前，注意隐藏私有 IP、MAC 地址、主机名、用户名和本地文件路径。
- 修改 preload API 时要谨慎，因为它会把主进程能力暴露给渲染进程。
- 在公开分发前，应继续加固命令执行方式和 IPC 入参校验。

## 平台支持

| 平台 | 状态 |
| --- | --- |
| Windows | 主要目标平台 |
| macOS | 尚未完整测试 |
| Linux | 尚未完整测试 |

部分功能依赖平台命令：

- Windows：`ping`、`tracert`、`arp`、`nbtstat`、`taskkill`
- macOS / Linux：`ping`、`traceroute`、`arp` 或对应环境下的等价工具

## 后续计划

- 将 shell 字符串命令执行替换为更安全的 `spawn(command, args)`
- 增加 host、IP、端口和脚本路径校验
- 清理 lint 错误和格式警告
- 为扫描类任务增加可取消的任务管理
- 拆分主进程逻辑，降低单文件复杂度
- 决定补全或移除测速面板
- 改善跨平台命令兼容性
- 为解析和校验逻辑增加基础测试

## 免责声明

本软件仅用于本地诊断、学习和授权网络维护。使用网络扫描、路由追踪、脚本执行等功能时，使用者应自行确保遵守相关法律法规、组织政策和授权边界。
