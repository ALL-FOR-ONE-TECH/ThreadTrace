#!/usr/bin/env bash
# ==============================================================================
# 🕵️‍♂️ ThreadTrace — Linux & macOS Dynamic Installer
# Spatial Code Investigation Canvas & Low-Memory Evidence Board
# Powered by ALL-FOR-ONE-TECH (https://github.com/ALL-FOR-ONE-TECH/ThreadTrace)
# License: MIT Open Source
# ==============================================================================

set -e

echo "============================================================"
echo "  🕵️‍♂️ THREAD_TRACE // Linux & macOS Native Installer"
echo "  Organization: ALL-FOR-ONE-TECH"
echo "  License: MIT Open Source (Free for all use)"
echo "============================================================"

REPO="ALL-FOR-ONE-TECH/ThreadTrace"
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "Detected OS: $OS ($ARCH)"

INSTALL_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR"

# 1. Fetch latest release info via GitHub API
echo "🔍 Resolving latest release from GitHub API..."
LATEST_TAG=""
RELEASE_JSON=""
if command -v curl >/dev/null 2>&1; then
    RELEASE_JSON=$(curl -fsSL -H "User-Agent: ThreadTrace-Installer" "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null || true)
fi

if [ -n "$RELEASE_JSON" ]; then
    LATEST_TAG=$(echo "$RELEASE_JSON" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' || true)
fi

if [ -n "$LATEST_TAG" ]; then
    echo "✓ Found release: $LATEST_TAG"
else
    echo "⚠️ Using default latest release endpoint..."
fi

# 2. OS-specific installation
if [ "$OS" = "Darwin" ]; then
    echo "🍎 Installing ThreadTrace on macOS..."
    DMG_URL="https://github.com/$REPO/releases/latest/download/ThreadTrace.dmg"
    TEMP_DMG="/tmp/ThreadTrace_$$.dmg"

    echo "⬇️ Downloading from $DMG_URL..."
    curl -fsSL -o "$TEMP_DMG" "$DMG_URL"

    echo "📦 Mounting DMG image..."
    MOUNT_DIR=$(hdiutil attach "$TEMP_DMG" -nobrowse -readonly | grep "/Volumes" | awk '{print $3}')

    if [ -d "$MOUNT_DIR/ThreadTrace.app" ]; then
        echo "📂 Copying to /Applications/ThreadTrace.app..."
        rm -rf "/Applications/ThreadTrace.app"
        cp -R "$MOUNT_DIR/ThreadTrace.app" /Applications/
    fi

    hdiutil detach "$MOUNT_DIR" -quiet || true
    rm -f "$TEMP_DMG"

    # Also symlink to CLI path
    if [ -d "/Applications/ThreadTrace.app" ]; then
        ln -sf "/Applications/ThreadTrace.app/Contents/MacOS/ThreadTrace" "$INSTALL_DIR/threadtrace" 2>/dev/null || true
    fi

    echo "✓ ThreadTrace successfully installed to /Applications/ThreadTrace.app"
    echo "🚀 Launching ThreadTrace..."
    open "/Applications/ThreadTrace.app" 2>/dev/null || true

elif [ "$OS" = "Linux" ]; then
    echo "🐧 Installing ThreadTrace on Linux..."
    APPIMAGE_URL="https://github.com/$REPO/releases/latest/download/ThreadTrace.AppImage"
    TARGET_BIN="$INSTALL_DIR/threadtrace"

    echo "⬇️ Downloading AppImage from $APPIMAGE_URL..."
    curl -fsSL -o "$TARGET_BIN" "$APPIMAGE_URL"
    chmod +x "$TARGET_BIN"

    # Create standard Linux Desktop entry
    DESKTOP_DIR="$HOME/.local/share/applications"
    mkdir -p "$DESKTOP_DIR"
    cat <<EOF > "$DESKTOP_DIR/threadtrace.desktop"
[Desktop Entry]
Name=ThreadTrace
Comment=Spatial Code Investigation Canvas & Evidence Board
Exec=$TARGET_BIN %u
Terminal=false
Type=Application
Categories=Development;IDE;Debugger;
StartupWMClass=ThreadTrace
EOF
    chmod +x "$DESKTOP_DIR/threadtrace.desktop"

    echo "✓ ThreadTrace installed to $TARGET_BIN"
    echo "✓ Desktop application entry created in $DESKTOP_DIR"
    echo "✓ You can launch it by running: ~/.local/bin/threadtrace"

    # Try to launch if DISPLAY or WAYLAND_DISPLAY is present
    if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
        "$TARGET_BIN" &
    fi
else
    echo "❌ Unsupported OS: $OS"
    exit 1
fi

echo ""
echo "============================================================"
echo "  🎉 Installation Complete!"
echo "  Ensure $INSTALL_DIR is in your PATH."
echo "============================================================"
