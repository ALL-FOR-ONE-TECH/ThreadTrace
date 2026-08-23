#!/usr/bin/env bash
# ==============================================================================
# ThreadTrace - macOS / Linux Uninstaller
# Cleans up app installation while safely preserving project files & databases.
# ==============================================================================

set -e

echo -e "\033[1;33m============================================================\033[0m"
echo -e "\033[1;33m  THREAD_TRACE // Uninstaller (macOS / Linux)\033[0m"
echo -e "\033[1;33m  ALL-FOR-ONE-TECH (https://github.com/ALL-FOR-ONE-TECH/ThreadTrace)\033[0m"
echo -e "\033[1;33m============================================================\033[0m"

# 1. Stop any running instances
echo -e "\033[1;36m[1/3] Stopping running processes...\033[0m"
pkill -f "threadtrace" 2>/dev/null || true
pkill -f "ThreadTrace" 2>/dev/null || true

# 2. Remove binaries and app bundles
echo -e "\033[1;36m[2/3] Removing installed files...\033[0m"

# Linux
if [ -f "$HOME/.local/bin/threadtrace" ]; then
    rm -f "$HOME/.local/bin/threadtrace"
    echo -e "  \033[1;32m-> Removed ~/.local/bin/threadtrace\033[0m"
fi

if [ -f "$HOME/.local/share/applications/threadtrace.desktop" ]; then
    rm -f "$HOME/.local/share/applications/threadtrace.desktop"
    echo -e "  \033[1;32m-> Removed ~/.local/share/applications/threadtrace.desktop\033[0m"
fi

# macOS
if [ -d "/Applications/ThreadTrace.app" ]; then
    rm -rf "/Applications/ThreadTrace.app"
    echo -e "  \033[1;32m-> Removed /Applications/ThreadTrace.app\033[0m"
fi

if [ -d "$HOME/Applications/ThreadTrace.app" ]; then
    rm -rf "$HOME/Applications/ThreadTrace.app"
    echo -e "  \033[1;32m-> Removed ~/Applications/ThreadTrace.app\033[0m"
fi

echo -e ""
echo -e "\033[1;32m============================================================\033[0m"
echo -e "\033[1;32m  ThreadTrace uninstalled successfully.\033[0m"
echo -e "\033[1;36m  Note: Your project code files and workspace databases remain safe.\033[0m"
echo -e "\033[1;32m============================================================\033[0m"
