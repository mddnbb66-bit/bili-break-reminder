# Bili Break Reminder v3（UI美化 + 自定义间隔可往小调修复）

> 这是一个 **Wails v3（Vanilla + Vite 模板）** 的“覆盖包/升级包”。
> 你先用 `wails3 init` 生成一个标准项目，然后把本目录里的文件 **按同名路径覆盖** 到项目里即可。

---

## ✅ v3 这次改了什么

- **UI 全面美化**：更现代的卡片布局、开关、滑块、状态区、弹窗。
- **修复 BUG：自定义间隔无法往小调**  
  v2 通常是因为前端 input/range 的 `min` 写死为 30 或保存逻辑只允许增大。  
  v3 改为：**最小 1 分钟**，并且 number 与 slider 双向同步。
- **更灵活的自定义**：
  - 监测关键词（默认：bilibili / 哔哩哔哩 / B站）
  - 监测进程（默认：chrome.exe / msedge.exe / firefox.exe / brave.exe 等）
  - 提醒方式：系统通知 / 应用内弹窗 / 声音（WebAudio beep）
  - Snooze（稍后提醒）分钟数可配
  - Windows 开机自启动（注册表 HKCU Run）

---

## 1) 生成 Wails v3 项目（只做一次）

参考官方 quick start：`wails3 init -n myapp` 会生成 Vanilla + Vite 模板（项目结构里有 `frontend/src/main.js` 与 `frontend/public/style.css` 等）。  
文档示例也说明 `wails3 dev` 会自动生成 bindings 到 `frontend/bindings/`。  

```bash
wails3 init -n bili-break-reminder
cd bili-break-reminder
```

（建议先跑一次 `wails3 dev`，让依赖和 bindings 全部生成完。）

---

## 2) 覆盖升级文件

把本 zip（overlay）里的文件复制到你项目根目录，按路径覆盖：

- `bilibreakservice.go`
- `activewin_windows.go`
- `activewin_stub.go`
- `autostart_windows.go`
- `autostart_stub.go`
- `config.go`
- `frontend/index.html`
- `frontend/src/main.js`
- `frontend/public/style.css`

---

## 3) 运行调试

```bash
wails3 dev
```

---

## 4) 打包 EXE（单文件）

官方 quick start 写明：`wails3 build` 输出在 `build/bin/`（Windows 下是 `build/bin/<app>.exe`）。  

```bash
wails3 build
```

---

## 5) 打包 EXE 安装包（NSIS）

官方 Windows packaging 文档说明可以用 `wails3 package GOOS=windows` 生成 NSIS 安装包（需要安装 NSIS）。  

```bash
wails3 package GOOS=windows
```

打包产物通常在 `build/windows/nsis/` 或类似目录（以你的 Wails 版本输出为准）。

---

## 注意

- 本版本默认按 **“前台活动窗口标题 + 进程名”** 判断是否在看 B 站 Web 端（比如浏览器标题包含 bilibili/哔哩哔哩/B站）。
- 如果你希望更严格（比如只识别 `www.bilibili.com`），需要浏览器扩展或本地代理，这不在 v3 范围内。

