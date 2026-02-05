package main

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

// Stats is pushed to the frontend via events and is also queryable via GetStats().
type Stats struct {
	Running               bool   `json:"running"`
	Watching              bool   `json:"watching"`
	TotalWatchedSeconds   int    `json:"totalWatchedSeconds"`
	SinceLastBreakSeconds int    `json:"sinceLastBreakSeconds"`
	NextBreakInSeconds    int    `json:"nextBreakInSeconds"`
	ActiveTitle           string `json:"activeTitle"`
	ActiveProcess         string `json:"activeProcess"`
	Day                   string `json:"day"`
	SnoozedUntil          string `json:"snoozedUntil,omitempty"` // RFC3339 if snoozed
}

type RemindPayload struct {
	Message   string `json:"message"`
	IntervalM int    `json:"intervalMinutes"`
	WatchedS  int    `json:"watchedSeconds"`
}

type BiliBreakService struct {
	mu sync.RWMutex
	cfg Config
	stats Stats
	day   string
	snoozedUntil time.Time
	ctx    context.Context
	cancel context.CancelFunc
	notifier *notifications.NotificationService
	mainWindow *application.WebviewWindow
}

func NewBiliBreakService(notifier *notifications.NotificationService) *BiliBreakService {
	cfg := defaultConfig()
	cfg.Normalize()
	return &BiliBreakService{
		cfg:      cfg,
		notifier: notifier,
		day:      time.Now().Format("2006-01-02"),
	}
}

func (s *BiliBreakService) SetMainWindow(win *application.WebviewWindow) {
	s.mainWindow = win
}

func (s *BiliBreakService) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	s.ctx, s.cancel = context.WithCancel(ctx)
	cfg, err := LoadConfig()
	if err == nil {
		s.mu.Lock()
		s.cfg = cfg
		s.mu.Unlock()
	}
	_ = SetAutoStart(s.cfg.AutoStart)
	go s.loop()
	s.emitConfig()
	s.emitStats()
	return nil
}

func (s *BiliBreakService) ServiceShutdown() error {
	if s.cancel != nil {
		s.cancel()
	}
	return nil
}

func (s *BiliBreakService) setWindowTop(top bool) {
	win := s.mainWindow
	if win == nil {
		return
	}
	if top {
		if win.IsMinimised() {
			win.Restore()
		}
		win.Show()
		win.SetAlwaysOnTop(true)
		win.Focus()
	} else {
		win.SetAlwaysOnTop(false)
	}
}

// ===== Public methods =====

func (s *BiliBreakService) GetConfig() Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cfg
}

func (s *BiliBreakService) SetConfig(cfg Config) error {
	cfg.Normalize()
	s.mu.Lock()
	s.cfg = cfg
	s.mu.Unlock()
	if err := SaveConfig(cfg); err != nil {
		return err
	}
	_ = SetAutoStart(cfg.AutoStart)
	s.emitConfig()
	s.emitStats()
	return nil
}

func (s *BiliBreakService) GetStats() Stats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.stats
}

func (s *BiliBreakService) Start() error {
	s.mu.Lock()
	s.cfg.MonitorEnabled = true
	cfg := s.cfg
	s.mu.Unlock()
	s.setWindowTop(false)
	if err := SaveConfig(cfg); err != nil {
		return err
	}
	s.emitConfig()
	s.emitStats()
	return nil
}

func (s *BiliBreakService) Stop() error {
	s.mu.Lock()
	s.cfg.MonitorEnabled = false
	cfg := s.cfg
	s.mu.Unlock()
	s.setWindowTop(false)
	if err := SaveConfig(cfg); err != nil {
		return err
	}
	s.emitConfig()
	s.emitStats()
	return nil
}

func (s *BiliBreakService) ResetToday() {
	s.mu.Lock()
	s.stats.TotalWatchedSeconds = 0
	s.stats.SinceLastBreakSeconds = 0
	s.mu.Unlock()
	s.emitStats()
}

func (s *BiliBreakService) Snooze(minutes int) {
	if minutes < 0 { minutes = 0 }
	if minutes > 240 { minutes = 240 }
	s.setWindowTop(false)
	s.mu.Lock()
	if minutes > 0 {
		s.snoozedUntil = time.Now().Add(time.Duration(minutes) * time.Minute)
	}
	s.stats.SinceLastBreakSeconds = 0
	s.mu.Unlock()
	s.emitStats()
}

func (s *BiliBreakService) ManualRemind() {
	s.fireReminder("手动提醒")
}

// ===== Internal loop =====

func (s *BiliBreakService) loop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.tick()
		}
	}
}

func (s *BiliBreakService) tick() {
	now := time.Now()
	day := now.Format("2006-01-02")
	aw := GetActiveWindowInfo()

	// 获取配置
	s.mu.RLock()
	cfg := s.cfg
	snoozedUntil := s.snoozedUntil
	currentDay := s.day

	// 正式版：不再修改标题栏，只计算匹配结果
	match, _ := s.matchesDebug(cfg, strings.ToLower(aw.Title), strings.ToLower(aw.Process))

	// 如果你想让标题栏恢复成软件名，可以加这一句（或者干脆什么都不做，它就是静态的）
	// if s.mainWindow != nil { s.mainWindow.SetTitle("Bili Break Reminder") }

	s.mu.RUnlock()

	if day != currentDay {
		s.mu.Lock()
		s.day = day
		s.stats.TotalWatchedSeconds = 0
		s.stats.SinceLastBreakSeconds = 0
		s.mu.Unlock()
	}

	running := cfg.MonitorEnabled
	watching := false
	if running && aw.OK {
		watching = match
	}

	intervalSec := cfg.IntervalMinutes * 60
	if intervalSec < 60 { intervalSec = 60 }

	s.mu.Lock()
	s.stats.Running = running
	s.stats.Watching = watching
	s.stats.ActiveTitle = aw.Title
	s.stats.ActiveProcess = aw.Process
	s.stats.Day = day
	if !s.snoozedUntil.IsZero() && now.Before(s.snoozedUntil) {
		s.stats.SnoozedUntil = s.snoozedUntil.Format(time.RFC3339)
	} else {
		s.stats.SnoozedUntil = ""
	}
	if watching {
		s.stats.TotalWatchedSeconds++
		s.stats.SinceLastBreakSeconds++
	}
	next := intervalSec - s.stats.SinceLastBreakSeconds
	if next < 0 { next = 0 }
	s.stats.NextBreakInSeconds = next

	canRemind := now.After(snoozedUntil) || snoozedUntil.IsZero()
	if watching && canRemind && s.stats.SinceLastBreakSeconds >= intervalSec {
		s.stats.SinceLastBreakSeconds = 0
		s.stats.NextBreakInSeconds = intervalSec
		s.mu.Unlock()
		s.fireReminder("时间到了")
		s.emitStats()
		return
	}
	s.mu.Unlock()
	s.emitStats()
}
func (s *BiliBreakService) matchesDebug(cfg Config, titleLower, processLower string) (bool, string) {
	browsers := []string{
		"chrome.exe", "msedge.exe", "firefox.exe", "brave.exe",
		"opera.exe", "vivaldi.exe", "iexplore.exe", "browser.exe",
	}

	// 1. 检查白名单 (强力容错分割)
	isTargetProcess := false

	if len(cfg.Processes) > 0 {
		realList := make([]string, 0)
		for _, raw := range cfg.Processes {
			clean := strings.ReplaceAll(raw, "，", ",")
			clean = strings.ReplaceAll(clean, "\n", ",")
			parts := strings.Split(clean, ",")
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					realList = append(realList, p)
				}
			}
		}

		for _, p := range realList {
			pLower := strings.ToLower(p)
			if strings.EqualFold(processLower, pLower) {
				isTargetProcess = true
				break
			}
			// .exe 容错
			if !strings.HasSuffix(pLower, ".exe") && strings.EqualFold(processLower, pLower+".exe") {
				isTargetProcess = true
				break
			}
		}

		if !isTargetProcess {
			return false, "不在白名单"
		}
	} else {
		return false, "白名单为空"
	}

	// 2. 检查是否为浏览器
	isBrowser := false
	for _, b := range browsers {
		if strings.EqualFold(processLower, b) {
			isBrowser = true
			break
		}
	}

	// 3. 决策
	if isBrowser {
		if len(cfg.Keywords) == 0 {
			return false, "浏览器无关键词"
		}
		for _, k := range cfg.Keywords {
			if k != "" && strings.Contains(titleLower, strings.ToLower(k)) {
				return true, "浏览器关键词匹配"
			}
		}
		return false, "标题未含关键词"
	} else {
		return true, "应用匹配成功"
	}
}

func (s *BiliBreakService) fireReminder(reason string) {
	s.mu.RLock()
	cfg := s.cfg
	stats := s.stats
	s.mu.RUnlock()
	msg := fmt.Sprintf("休息一下吧～（%s）\n本日累计：%s", reason, formatDuration(stats.TotalWatchedSeconds))

	if cfg.NotifySystem && s.notifier != nil {
		_ = s.notifier.SendNotification(notifications.NotificationOptions{
			ID:    fmt.Sprintf("bili-break-%d", time.Now().UnixNano()),
			Title: "长时间使用提醒",
			Body:  msg,
		})
	}
	if cfg.NotifyPopup || cfg.NotifySound {
		s.setWindowTop(true)
		app := application.Get()
		if app != nil {
			app.Event.Emit("bili:remind", RemindPayload{
				Message:   msg,
				IntervalM: cfg.IntervalMinutes,
				WatchedS:  stats.TotalWatchedSeconds,
			})
		}
	}
}

func (s *BiliBreakService) emitStats() {
	app := application.Get()
	if app == nil { return }
	s.mu.RLock()
	stats := s.stats
	s.mu.RUnlock()
	app.Event.Emit("bili:stats", stats)
}

func (s *BiliBreakService) emitConfig() {
	app := application.Get()
	if app == nil { return }
	s.mu.RLock()
	cfg := s.cfg
	s.mu.RUnlock()
	app.Event.Emit("bili:config", cfg)
}

func formatDuration(seconds int) string {
	if seconds < 0 { seconds = 0 }
	h := seconds / 3600
	m := (seconds % 3600) / 60
	s := seconds % 60
	if h > 0 {
		return fmt.Sprintf("%02d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%02d:%02d", m, s)
}