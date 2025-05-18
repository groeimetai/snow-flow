package app

import (
	"os"
	"path/filepath"

	"github.com/marcozac/go-jsonc"
)

type Config struct {
}

type ConfigMCP struct {
}

type ConfigProvider struct {
}

type ErrInvalidConfig struct {
	source error
}

func (e ErrInvalidConfig) Error() string {
	return "ErrInvalidConfig"
}

func (e ErrInvalidConfig) Unwrap() error {
	return e.source
}

func initConfig(directory string) (*Config, error) {
	configPath := filepath.Join(directory, "opencode.jsonc")
	_, err := os.Stat(configPath)
	result := &Config{}
	if err == nil {
		data, err := os.ReadFile(configPath)
		if err == nil {
			err := jsonc.Unmarshal(data, result)
			if err != nil {
				return nil, ErrInvalidConfig{err}
			}
		}
	}
	return result, nil
}
