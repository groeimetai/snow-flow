package global

import (
	"os"
	"path/filepath"
)

var configDir = (func() string {
	home, err := os.UserConfigDir()
	if err != nil {
		panic(err)
	}
	result := filepath.Join(home, "sst")
	os.MkdirAll(result, 0755)
	os.MkdirAll(filepath.Join(result, "bin"), 0755)
	return result
}())

var cacheDir = (func() string {
	home, err := os.UserCacheDir()
	if err != nil {
		panic(err)
	}
	result := filepath.Join(home, "sst")
	os.MkdirAll(result, 0755)
	return result
}())

func ConfigDir() string {
	return configDir
}

func CacheDir() string {
	return cacheDir
}

type Config struct {
}
