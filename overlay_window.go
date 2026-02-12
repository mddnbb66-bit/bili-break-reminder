package main

import "github.com/wailsapp/wails/v3/pkg/application"

func createOverlayWindow(app *application.App) {
	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:                "overlay",
		Title:               "",
		Width:               360,
		Height:              160,
		AlwaysOnTop:         true,
		Frameless:           true,
		DisableResize:       true,
		BackgroundType:      application.BackgroundTypeTransparent,
		BackgroundColour:    application.NewRGBA(0, 0, 0, 0),
		URL:                 "/overlay.html",
		MinimiseButtonState: application.ButtonHidden,
		MaximiseButtonState: application.ButtonHidden,
		CloseButtonState:    application.ButtonHidden,
	})
}
