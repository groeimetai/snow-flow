package app

import (
	"log/slog"
	"os"
	"path/filepath"

	"github.com/sst/opencode/pkg/app/paths"
	"gocloud.dev/blob"
	"gocloud.dev/blob/fileblob"
)

type Storage struct {
	bucket *blob.Bucket
	app    *App
	log    *slog.Logger
}

func initStorage(app *App) (*Storage, error) {
	var err error
	result := &Storage{
		app: app,
	}
	storageDir := paths.Storage(app.directory)
	if err := os.MkdirAll(storageDir, 0755); err != nil {
		return nil, err
	}
	result.bucket, err = fileblob.OpenBucket(storageDir, &fileblob.Options{
		NoTempDir: true,
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

type StorageWriterOptions = blob.WriterOptions

func (s *Storage) NewWriter(opts *StorageWriterOptions, path ...string) (*blob.Writer, error) {
	joined := filepath.Join(path...)
	return s.bucket.NewWriter(s.app.ctx, joined, nil)
}
