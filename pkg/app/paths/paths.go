package paths

import "path/filepath"

func Data(project string) string {
	return filepath.Join(project, ".opencode")
}

func Storage(project string) string {
	return filepath.Join(Data(project), "storage")
}

func Log(project string) string {
	return filepath.Join(Data(project), "log")
}
