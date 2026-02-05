//go:build windows

package main

import (
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

type ActiveWindowInfo struct {
	Title   string `json:"title"`
	Process string `json:"process"`
	PID     uint32 `json:"pid"`
	OK      bool   `json:"ok"`
}

var (
	user32                       = windows.NewLazySystemDLL("user32.dll")
	kernel32                     = windows.NewLazySystemDLL("kernel32.dll")
	procGetForegroundWindow      = user32.NewProc("GetForegroundWindow")
	procGetWindowTextW           = user32.NewProc("GetWindowTextW")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")

	// QueryFullProcessImageNameW is in kernel32.dll (Windows Vista+).
	procQueryFullProcessImageNameW = kernel32.NewProc("QueryFullProcessImageNameW")
)

func GetActiveWindowInfo() ActiveWindowInfo {
	hwnd, _, _ := procGetForegroundWindow.Call()
	if hwnd == 0 {
		return ActiveWindowInfo{OK: false}
	}

	// Window title
	titleBuf := make([]uint16, 512)
	procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&titleBuf[0])), uintptr(len(titleBuf)))
	title := windows.UTF16ToString(titleBuf)

	// PID
	var pid uint32
	procGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&pid)))

	process := ""
	if pid != 0 {
		h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
		if err == nil {
			defer windows.CloseHandle(h)

			// QueryFullProcessImageNameW(handle, flags, buf, &size)
			pathBuf := make([]uint16, windows.MAX_PATH)
			size := uint32(len(pathBuf))
			r1, _, _ := procQueryFullProcessImageNameW.Call(
				uintptr(h),
				uintptr(0),
				uintptr(unsafe.Pointer(&pathBuf[0])),
				uintptr(unsafe.Pointer(&size)),
			)
			if r1 != 0 && size > 0 {
				full := windows.UTF16ToString(pathBuf[:size])
				process = strings.ToLower(filepath.Base(full))
			}
		}
	}

	return ActiveWindowInfo{
		Title:   title,
		Process: process,
		PID:     pid,
		OK:      true,
	}
}

// The syscall package can return empty strings if the window title is not accessible.
// This helper keeps behavior predictable.
func containsAnyKeyword(titleLower string, keywords []string) bool {
	if len(keywords) == 0 {
		return false
	}
	for _, k := range keywords {
		if k == "" {
			continue
		}
		if strings.Contains(titleLower, strings.ToLower(k)) {
			return true
		}
	}
	return false
}

// UTF16ToString wrapper for completeness (kept for compatibility with older snippets).
func utf16ToString(p []uint16) string {
	return syscall.UTF16ToString(p)
}
