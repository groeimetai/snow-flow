package util

import (
	tea "github.com/charmbracelet/bubbletea"
)

func CmdHandler(msg tea.Msg) tea.Cmd {
	return func() tea.Msg {
		return msg
	}
}

func Clamp(v, low, high int) int {
	// Swap if needed to ensure low <= high
	if high < low {
		low, high = high, low
	}
	return min(high, max(low, v))
}
