package config

import (
	"bufio"
	"fmt"
	"log/slog"
	"os"

	"github.com/BurntSushi/toml"
)

type Config struct {
	Theme    string `toml:"Theme"`
	Provider string `toml:"Provider"`
	Model    string `toml:"Model"`
}

// NewConfig creates a new Config instance with default values.
// This can be useful for initializing a new configuration file.
func NewConfig(theme, provider, model string) *Config {
	return &Config{
		Theme:    theme,
		Provider: provider,
		Model:    model,
	}
}

// SaveConfig writes the provided Config struct to the specified TOML file.
// It will create the file if it doesn't exist, or overwrite it if it does.
func SaveConfig(filePath string, config *Config) error {
	file, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("failed to create/open config file %s: %w", filePath, err)
	}
	defer file.Close()

	writer := bufio.NewWriter(file)

	encoder := toml.NewEncoder(writer)
	if err := encoder.Encode(config); err != nil {
		return fmt.Errorf("failed to encode config to TOML file %s: %w", filePath, err)
	}

	if err := writer.Flush(); err != nil {
		return fmt.Errorf("failed to flush writer for config file %s: %w", filePath, err)
	}

	slog.Debug("Configuration saved to file", "file", filePath)
	return nil
}

// LoadConfig reads a Config struct from the specified TOML file.
// It returns a pointer to the Config struct and an error if any issues occur.
func LoadConfig(filePath string) (*Config, error) {
	var config Config

	if _, err := toml.DecodeFile(filePath, &config); err != nil {
		if _, statErr := os.Stat(filePath); os.IsNotExist(statErr) {
			return nil, fmt.Errorf("config file not found at %s: %w", filePath, statErr)
		}
		return nil, fmt.Errorf("failed to decode TOML from file %s: %w", filePath, err)
	}

	return &config, nil
}
