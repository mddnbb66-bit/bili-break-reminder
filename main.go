package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

//go:embed frontend/dist
var assets embed.FS

func main() {
	// 1. 初始化通知服务
	notifier := notifications.New()

	// 2. 初始化我们的 B站提醒服务
	biliSvc := NewBiliBreakService(notifier)

	// 3. 创建应用
	app := application.New(application.Options{
		Name:        "Bili Break Reminder",
		Description: "A simple reminder to take a break from Bilibili",
		Services: []application.Service{
			application.NewService(notifier), // 注册通知服务
			application.NewService(biliSvc),  // 注册我们的服务
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// 4. 创建主窗口 (并把窗口对象存下来)
	mainWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "Bili Break Reminder",
		Width:  1120,
		Height: 800,
		// 使用深色背景避免加载时白屏闪烁
		BackgroundColour: application.NewRGB(11, 16, 32),
		URL:              "/",
	})

	// 🔥🔥🔥 5. 关键修复：把窗口传给服务，没有这行，标题调试和弹窗都无效！🔥🔥🔥
	biliSvc.SetMainWindow(mainWindow)

	// 6. 创建悬浮倒计时窗口（单独函数，降低主流程冲突）
	createOverlayWindow(app)

	// 7. 运行
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
