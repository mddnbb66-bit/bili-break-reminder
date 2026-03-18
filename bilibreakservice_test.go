package main

import (
	"testing"
	"time"
)

func TestSnoozeZeroClearsCountdownWithoutLeavingSnooze(t *testing.T) {
	svc := NewBiliBreakService(nil)
	svc.cfg.IntervalMinutes = 45
	svc.snoozedUntil = time.Now().Add(10 * time.Minute)
	svc.stats.SinceLastBreakSeconds = 321
	svc.stats.NextBreakInSeconds = 12
	svc.stats.TotalWatchedSeconds = 999
	svc.stats.CumulativeWatchedSeconds = 777

	svc.Snooze(0)

	if !svc.snoozedUntil.IsZero() {
		t.Fatalf("expected snoozedUntil to be cleared, got %v", svc.snoozedUntil)
	}
	if svc.stats.SinceLastBreakSeconds != 0 {
		t.Fatalf("expected sinceLastBreakSeconds reset to 0, got %d", svc.stats.SinceLastBreakSeconds)
	}
	if svc.stats.NextBreakInSeconds != 45*60 {
		t.Fatalf("expected nextBreakInSeconds reset to interval, got %d", svc.stats.NextBreakInSeconds)
	}
	if svc.stats.TotalWatchedSeconds != 999 {
		t.Fatalf("expected totalWatchedSeconds unchanged, got %d", svc.stats.TotalWatchedSeconds)
	}
	if svc.stats.CumulativeWatchedSeconds != 777 {
		t.Fatalf("expected cumulativeWatchedSeconds unchanged, got %d", svc.stats.CumulativeWatchedSeconds)
	}
}
