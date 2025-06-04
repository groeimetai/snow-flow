//go:build windows

package image

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"log/slog"
	"syscall"
	"unsafe"
)

var (
	user32                     = syscall.NewLazyDLL("user32.dll")
	kernel32                   = syscall.NewLazyDLL("kernel32.dll")
	openClipboard              = user32.NewProc("OpenClipboard")
	closeClipboard             = user32.NewProc("CloseClipboard")
	getClipboardData           = user32.NewProc("GetClipboardData")
	isClipboardFormatAvailable = user32.NewProc("IsClipboardFormatAvailable")
	globalLock                 = kernel32.NewProc("GlobalLock")
	globalUnlock               = kernel32.NewProc("GlobalUnlock")
	globalSize                 = kernel32.NewProc("GlobalSize")
)

const (
	CF_TEXT        = 1
	CF_UNICODETEXT = 13
	CF_DIB         = 8
)

type BITMAPINFOHEADER struct {
	BiSize          uint32
	BiWidth         int32
	BiHeight        int32
	BiPlanes        uint16
	BiBitCount      uint16
	BiCompression   uint32
	BiSizeImage     uint32
	BiXPelsPerMeter int32
	BiYPelsPerMeter int32
	BiClrUsed       uint32
	BiClrImportant  uint32
}

func GetImageFromClipboard() ([]byte, string, error) {
	ret, _, _ := openClipboard.Call(0)
	if ret == 0 {
		return nil, "", fmt.Errorf("failed to open clipboard")
	}
	defer func(closeClipboard *syscall.LazyProc, a ...uintptr) {
		_, _, err := closeClipboard.Call(a...)
		if err != nil {
			slog.Error("close clipboard failed")
			return
		}
	}(closeClipboard)
	isTextAvailable, _, _ := isClipboardFormatAvailable.Call(uintptr(CF_TEXT))
	isUnicodeTextAvailable, _, _ := isClipboardFormatAvailable.Call(uintptr(CF_UNICODETEXT))

	if isTextAvailable != 0 || isUnicodeTextAvailable != 0 {
		// Get text from clipboard
		var formatToUse uintptr = CF_TEXT
		if isUnicodeTextAvailable != 0 {
			formatToUse = CF_UNICODETEXT
		}

		hClipboardText, _, _ := getClipboardData.Call(formatToUse)
		if hClipboardText != 0 {
			textPtr, _, _ := globalLock.Call(hClipboardText)
			if textPtr != 0 {
				defer func(globalUnlock *syscall.LazyProc, a ...uintptr) {
					_, _, err := globalUnlock.Call(a...)
					if err != nil {
						slog.Error("Global unlock failed")
						return
					}
				}(globalUnlock, hClipboardText)

				// Get clipboard text
				var clipboardText string
				if formatToUse == CF_UNICODETEXT {
					// Convert wide string to Go string
					clipboardText = syscall.UTF16ToString((*[1 << 20]uint16)(unsafe.Pointer(textPtr))[:])
				} else {
					// Get size of ANSI text
					size, _, _ := globalSize.Call(hClipboardText)
					if size > 0 {
						// Convert ANSI string to Go string
						textBytes := make([]byte, size)
						copy(textBytes, (*[1 << 20]byte)(unsafe.Pointer(textPtr))[:size:size])
						clipboardText = bytesToString(textBytes)
					}
				}

				// Check if the text is not empty
				if clipboardText != "" {
					return nil, clipboardText, nil
				}
			}
		}
	}
	hClipboardData, _, _ := getClipboardData.Call(uintptr(CF_DIB))
	if hClipboardData == 0 {
		return nil, "", fmt.Errorf("failed to get clipboard data")
	}

	dataPtr, _, _ := globalLock.Call(hClipboardData)
	if dataPtr == 0 {
		return nil, "", fmt.Errorf("failed to lock clipboard data")
	}
	defer func(globalUnlock *syscall.LazyProc, a ...uintptr) {
		_, _, err := globalUnlock.Call(a...)
		if err != nil {
			slog.Error("Global unlock failed")
			return
		}
	}(globalUnlock, hClipboardData)

	bmiHeader := (*BITMAPINFOHEADER)(unsafe.Pointer(dataPtr))

	width := int(bmiHeader.BiWidth)
	height := int(bmiHeader.BiHeight)
	if height < 0 {
		height = -height
	}
	bitsPerPixel := int(bmiHeader.BiBitCount)

	img := image.NewRGBA(image.Rect(0, 0, width, height))

	var bitsOffset uintptr
	if bitsPerPixel <= 8 {
		numColors := uint32(1) << bitsPerPixel
		if bmiHeader.BiClrUsed > 0 {
			numColors = bmiHeader.BiClrUsed
		}
		bitsOffset = unsafe.Sizeof(*bmiHeader) + uintptr(numColors*4)
	} else {
		bitsOffset = unsafe.Sizeof(*bmiHeader)
	}

	for y := range height {
		for x := range width {

			srcY := height - y - 1
			if bmiHeader.BiHeight < 0 {
				srcY = y
			}

			var pixelPointer unsafe.Pointer
			var r, g, b, a uint8

			switch bitsPerPixel {
			case 24:
				stride := (width*3 + 3) &^ 3
				pixelPointer = unsafe.Pointer(dataPtr + bitsOffset + uintptr(srcY*stride+x*3))
				b = *(*byte)(pixelPointer)
				g = *(*byte)(unsafe.Add(pixelPointer, 1))
				r = *(*byte)(unsafe.Add(pixelPointer, 2))
				a = 255
			case 32:
				pixelPointer = unsafe.Pointer(dataPtr + bitsOffset + uintptr(srcY*width*4+x*4))
				b = *(*byte)(pixelPointer)
				g = *(*byte)(unsafe.Add(pixelPointer, 1))
				r = *(*byte)(unsafe.Add(pixelPointer, 2))
				a = *(*byte)(unsafe.Add(pixelPointer, 3))
				if a == 0 {
					a = 255
				}
			default:
				return nil, "", fmt.Errorf("unsupported bit count: %d", bitsPerPixel)
			}

			img.Set(x, y, color.RGBA{R: r, G: g, B: b, A: a})
		}
	}

	imageBytes, err := ImageToBytes(img)
	if err != nil {
		return nil, "", err
	}
	return imageBytes, "", nil
}

func bytesToString(b []byte) string {
	i := bytes.IndexByte(b, 0)
	if i == -1 {
		return string(b)
	}
	return string(b[:i])
}
