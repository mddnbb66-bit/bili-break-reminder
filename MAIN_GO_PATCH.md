# main.go 如何改（把默认的 greet 示例换成 BiliBreakService）

你用 `wails3 init -n bili-break-reminder` 生成项目后，默认会有：

- `main.go`
- `greetservice.go`

你需要做 3 件事：

---

## 1) 删除/忽略 greetservice.go

可以直接删掉 `greetservice.go`，避免生成多余 bindings。

---

## 2) 在 main.go 里引入 notifications service，并注册我们的服务

在 imports 里加：

```go
"github.com/wailsapp/wails/v3/pkg/services/notifications"
```

在 main() 里创建 notifier 并注册：

```go
notifier := notifications.New()

biliSvc := NewBiliBreakService(notifier)

app := application.New(application.Options{
    Name: "bili-break-reminder",

    Services: []application.Service{
        application.NewService(notifier),
        application.NewService(biliSvc),
    },

    // 其他 options 保持 init 生成的即可（Assets / Windows / etc）
})
```

---

## 3) 前端调用的服务名要一致

前端 v3 的 `frontend/src/main.js` 里调用的是：

- `BiliBreakService.GetConfig`
- `BiliBreakService.SetConfig`
- `BiliBreakService.Start/Stop/...`

因此 Go 里的 struct 名必须是 `BiliBreakService`（本 overlay 已经是）。

