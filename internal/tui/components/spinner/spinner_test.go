package spinner

import (
	"testing"
	"time"
)

func TestSpinner(t *testing.T) {
	t.Parallel()

	// Create a spinner
	s := NewSpinner("Test spinner")
	
	// Start the spinner
	s.Start()
	
	// Wait a bit to let it run
	time.Sleep(100 * time.Millisecond)
	
	// Stop the spinner
	s.Stop()
	
	// If we got here without panicking, the test passes
}