//go:build !windows

package main

type ActiveWindowInfo struct {
	Title   string `json:"title"`
	Process string `json:"process"`
	PID     uint32 `json:"pid"`
	OK      bool   `json:"ok"`
}

func GetActiveWindowInfo() ActiveWindowInfo {
	return ActiveWindowInfo{OK: false}
}
