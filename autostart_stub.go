//go:build !windows

package main

import "errors"

func SetAutoStart(enable bool) error {
	return errors.New("autostart is only implemented on Windows in this project")
}
