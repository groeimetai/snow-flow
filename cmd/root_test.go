package cmd

import (
	"bytes"
	"io"
	"os"
	"testing"
)

func TestCheckStdinPipe(t *testing.T) {
	// Save original stdin
	origStdin := os.Stdin

	// Restore original stdin when test completes
	defer func() {
		os.Stdin = origStdin
	}()

	// Test case 1: Data is piped in
	t.Run("WithPipedData", func(t *testing.T) {
		// Create a pipe
		r, w, err := os.Pipe()
		if err != nil {
			t.Fatalf("Failed to create pipe: %v", err)
		}

		// Replace stdin with our pipe
		os.Stdin = r

		// Write test data to the pipe
		testData := "test piped input"
		go func() {
			defer w.Close()
			w.Write([]byte(testData))
		}()

		// Call the function
		data, hasPiped := checkStdinPipe()

		// Check results
		if !hasPiped {
			t.Error("Expected hasPiped to be true, got false")
		}
		if data != testData {
			t.Errorf("Expected data to be %q, got %q", testData, data)
		}
	})

	// Test case 2: No data is piped in (simulated terminal)
	t.Run("WithoutPipedData", func(t *testing.T) {
		// Create a temporary file to simulate a terminal
		tmpFile, err := os.CreateTemp("", "terminal-sim")
		if err != nil {
			t.Fatalf("Failed to create temp file: %v", err)
		}
		defer os.Remove(tmpFile.Name())
		defer tmpFile.Close()

		// Open the file for reading
		f, err := os.Open(tmpFile.Name())
		if err != nil {
			t.Fatalf("Failed to open temp file: %v", err)
		}
		defer f.Close()

		// Replace stdin with our file
		os.Stdin = f

		// Call the function
		data, hasPiped := checkStdinPipe()

		// Check results
		if hasPiped {
			t.Error("Expected hasPiped to be false, got true")
		}
		if data != "" {
			t.Errorf("Expected data to be empty, got %q", data)
		}
	})
}

// This is a mock implementation for testing since we can't easily mock os.Stdin.Stat()
// in a way that would return the correct Mode() for our test cases
func mockCheckStdinPipe(reader io.Reader, isPipe bool) (string, bool) {
	if !isPipe {
		return "", false
	}

	data, err := io.ReadAll(reader)
	if err != nil {
		return "", false
	}

	if len(data) > 0 {
		return string(data), true
	}
	return "", false
}

func TestMockCheckStdinPipe(t *testing.T) {
	// Test with data
	t.Run("WithData", func(t *testing.T) {
		testData := "test data"
		reader := bytes.NewBufferString(testData)
		
		data, hasPiped := mockCheckStdinPipe(reader, true)
		
		if !hasPiped {
			t.Error("Expected hasPiped to be true, got false")
		}
		if data != testData {
			t.Errorf("Expected data to be %q, got %q", testData, data)
		}
	})
	
	// Test without data
	t.Run("WithoutData", func(t *testing.T) {
		reader := bytes.NewBufferString("")
		
		data, hasPiped := mockCheckStdinPipe(reader, true)
		
		if hasPiped {
			t.Error("Expected hasPiped to be false, got true")
		}
		if data != "" {
			t.Errorf("Expected data to be empty, got %q", data)
		}
	})
	
	// Test not a pipe
	t.Run("NotAPipe", func(t *testing.T) {
		reader := bytes.NewBufferString("data that should be ignored")
		
		data, hasPiped := mockCheckStdinPipe(reader, false)
		
		if hasPiped {
			t.Error("Expected hasPiped to be false, got true")
		}
		if data != "" {
			t.Errorf("Expected data to be empty, got %q", data)
		}
	})
}