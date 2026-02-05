//go:build windows

package main

import (
	"fmt"
	"os"
	"strings"

	"golang.org/x/sys/windows/registry"
)

func SetAutoStart(enable bool) error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	// Quote path to survive spaces.
	if strings.ContainsRune(exePath, ' ') && !(strings.HasPrefix(exePath, "\"") && strings.HasSuffix(exePath, "\"")) {
		exePath = fmt.Sprintf("\"%s\"", exePath)
	}
	keyPath := `Software\Microsoft\Windows\CurrentVersion\Run`

	k, err := registry.OpenKey(registry.CURRENT_USER, keyPath, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()

	if enable {
		return k.SetStringValue(AppName, exePath)
	}

	// Disable: delete value. Ignore if missing.
	if err := k.DeleteValue(AppName); err != nil {
		if err == registry.ErrNotExist {
			return nil
		}
		return err
	}
	return nil
}
