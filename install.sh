#!/usr/bin/env bash
# ThreadTrace Linux & macOS One-Click Installer
# Powered by ALL-FOR-ONE-TECH (https://github.com/ALL-FOR-ONE-TECH/ThreadTrace)

set -e

echo "============================================================"
echo "  🕵️‍♂️ THREAD_TRACE // Spatial Code Investigation Canvas"
echo "  Organization: ALL-FOR-ONE-TECH"
echo "============================================================"

REPO="ALL-FOR-ONE-TECH/ThreadTrace"
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "Detected OS: $OS ($ARCH)"

INSTALL_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR"

if [ "$OS" = "Darwin" ]; then
    echo "Fetching latest macOS release..."
    DMG_URL="https://github.com/$REPO/releases/latest/download/ThreadTrace.dmg"
    curl -fsSL -o /tmp/ThreadTrace.dmg "$DMG_URL"
    hdiutil attach /tmp/ThreadTrace.dmg
    cp -R "/Volumes/ThreadTrace/ThreadTrace.app" /Applications/
    hdiutil detach "/Volumes/ThreadTrace"
    echo "✓ ThreadTrace installed to /Applications/ThreadTrace.app"
    open "/Applications/ThreadTrace.app"
elif [ "$OS" = "Linux" ]; then
    echo "Fetching latest Linux AppImage..."
    APPIMAGE_URL="https://github.com/$REPO/releases/latest/download/ThreadTrace.AppImage"
    curl -fsSL -o "$INSTALL_DIR/threadtrace" "$APPIMAGE_URL"
    chmod +x "$INSTALL_DIR/threadtrace"
    echo "✓ ThreadTrace installed to $INSTALL_DIR/threadtrace"
    echo "Run with: ~/.local/bin/threadtrace"
fi

echo "Installation complete!"
