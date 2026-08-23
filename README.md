<div align="center">

<img src="docs/screenshots/threadtrace_logo.jpg" alt="ThreadTrace Logo" width="140" style="border-radius: 12px; box-shadow: 0 0 25px rgba(255, 176, 0, 0.4);" />

# 🕵️‍♂️ THREAD_TRACE
### *Terminal Investigation Canvas & Low-Memory Code Evidence Board*

[![Release](https://img.shields.io/github/v/release/karthikeyanV2K/Code-Board?style=for-the-badge&color=ffb000&label=RELEASE)](https://github.com/karthikeyanV2K/Code-Board/releases)
[![Tauri v2](https://img.shields.io/badge/Tauri_v2-Rust_Core-blue?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React_19-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Memory Footprint](https://img.shields.io/badge/Memory_Footprint-~18MB_RAM-52c41a?style=for-the-badge)](https://github.com/karthikeyanV2K/Code-Board)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<p align="center">
  <b>A ultra-fast, local-first spatial canvas for tracking complex bugs, security vulnerabilities, git diffs, and architectural clues using detective-style curved red strings.</b>
</p>

[✨ Key Features](#-key-features) •
[📸 Visual Proofs](#-visual-proofs--interactive-states) •
[📡 How Git Watcher Works](#-how-git-watcher-works) •
[⚡ Memory Benchmarks](#-memory-benchmarks--performance) •
[🚀 Download & Install](#-download--installation) •
[⌨️ Shortcuts](#️-keyboard-shortcuts)

</div>

---

## 🎯 The Problem & The Vision

When investigating complex distributed race conditions, multi-file security vulnerabilities, or regression cascades, developers are forced to context-switch across dozens of open editor tabs, ticket trackers, and terminal logs.

**ThreadTrace** brings the physical detective evidence board into your dev environment:
- **Pin snippets and logs** anywhere on an infinite 2D plane.
- **Draw red evidence strings** between connected clues with quadratic Bézier droop physics.
- **Live Git Watcher** syncs repository commit hashes and diffs without leaving the canvas.
- **Runs on ~18MB RAM**—so lightweight you can keep it open 24/7 next to your IDE without stealing memory.

`
┌──[0x01:BUG]──┐        ┌──[0x02:EVIDENCE]──┐
│ AUTH_RACE    ├───────►│ PROD_LOGS_409     │
└───┬──────────┘        └───┬───────────────┘
    ▼                       ▼
┌──[0x03:FIX]───────────────┴───────────────┐
│ INFLIGHT_MUTEX_QUEUE_DEDUPLICATION        │
└───────────────────────────────────────────┘
`

---

## 📸 Visual Proofs & Interactive States

### 1. Main Canvas with Curved Red String Clue Linking
![ThreadTrace Main Canvas](docs/screenshots/threadtrace_main_canvas.png)
*Spatial evidence board showing custom security tags (SECURITY:1, LEAK:1), dynamic radar minimap, and curved red evidence links.*

---

### 2. Live System Resource Telemetry Dashboard
![System Resource Telemetry Modal](docs/screenshots/telemetry_dashboard.png)
*Real-time diagnostics displaying live JS Heap memory sparklines, FPS render speeds, DOM node counts, and zero idle editor memory leaks.*

---

### 3. Dynamic Custom Tag Engine
![Custom Tag Engine](docs/screenshots/custom_tag_engine.png)
*Create custom classification tags with 8 phosphor color swatches, sub-labels, and instant preview badges.*

---

### 4. Tag-Based Clue Isolation & Filtering
![Custom Tag Filtering](docs/screenshots/custom_tag_filtering.png)
*Instant tag filtering to isolate critical CVE clues and sensitive evidence.*

---

## 📡 How Git Watcher Works

ThreadTrace includes an active Git Watcher daemon built directly into the Rust backend (git_watcher.rs):

`mermaid
flowchart LR
    A[Local Git Repo] -->|notify crate / inotify| B[Rust Git Watcher Daemon]
    B -->|transient cli: git log -1| C[Latest Commit Info]
    B -->|transient cli: git diff --stat| D[Active Diff Summary]
    C & D -->|Tauri Event Bridge| E[React Masthead Ticker]
    E -->|Live UI Update| F[Investigator HUD Banner]
`

1. **Filesystem Monitor**: Uses the Rust 
otify crate to watch .git/HEAD, .git/refs/heads/, and working tree files for modifications.
2. **Non-Blocking Shell Exec**: On file touch, executes lightweight non-blocking subprocesses (git log -1 --oneline and git diff --stat) to extract the latest commit message, hash, and modified files.
3. **Zero-Latency Event Dispatch**: Streams updates through the Tauri IPC event channel to the React masthead without polling.
4. **Offline / Web Fallback**: Seamlessly switches to web local storage persistence when running in standard browser mode.

---

## ⚡ Memory Benchmarks & Performance

ThreadTrace is specifically engineered to eliminate the memory bloat of Electron-based apps:

| Metric | Electron-Based Tools | Standard Web App | **ThreadTrace (Rust + React 19)** |
|---|---|---|---|
| **Base RAM Usage** | 300MB – 650MB | 80MB – 150MB | **~18MB – 35MB** ⚡ |
| **Active Editor Strategy** | N instances mounted | N instances mounted | **Single Active Mount** (Prism read mode for idle cards) |
| **Startup Time** | 2.5s – 4.0s | 1.5s | **< 250ms** 🚀 |
| **Persistence** | Remote Cloud / Heavy DB | LocalStorage only | **Native SQLite (ACID) + LocalStorage Sync** |
| **Binary Size** | 120MB+ | N/A | **11.2 MB Standalone Executable** |

---

## ✨ Key Features

- 🕵️ **Spatial Clue Canvas**: Infinite panning (Alt + Drag), zoom (Ctrl + Wheel / HUD), and auto-relayout.
- 🧵 **Bézier Red Strings**: Connect cards with curved, drooping evidence threads.
- 🏷️ **Dynamic Custom Tag Engine**: Register custom tags (e.g. SECURITY, LEAK, PERF, API) with 8 phosphor color swatches.
- 📡 **Auto-Bounding Radar Minimap**: Real-time spatial radar that automatically scales to card coordinates with drag-navigation.
- 📊 **Real-Time Telemetry Monitor**: Live memory, JS heap sparklines, FPS counter, and editor isolation.
- 📁 **Markdown Dossier Export**: Generate one-click investigation markdown dossiers complete with Mermaid flowchart diagrams.
- 💾 **ACID SQLite Persistence**: All nodes, links, and tags are stored locally in snippet_board.db with instant zero-server persistence.

---

## 🚀 Download & Installation

### Option 1: Standalone Windows Executable (No Install Required)
Download **ThreadTrace.exe** from the [Latest Release](https://github.com/karthikeyanV2K/Code-Board/releases) and run it directly!

### Option 2: Windows Setup Installer
Download **ThreadTrace_Setup.exe** or **ThreadTrace_1.0.0_x64_en-US.msi** to install to Program Files and Start Menu.

### Option 3: Build from Source
`ash
# 1. Clone the repository
git clone https://github.com/karthikeyanV2K/Code-Board.git
cd Code-Board

# 2. Install dependencies
npm install

# 3. Run in Desktop Dev Mode
npm run tauri dev

# 4. Build Standalone Release
npm run build
npm run tauri build
`

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>N</kbd> | Add new snippet card |
| <kbd>T</kbd> | Open Custom Tag Engine |
| <kbd>Ctrl</kbd> + <kbd>Wheel</kbd> | Smooth cursor-centered canvas zoom |
| <kbd>Alt</kbd> + <kbd>Drag</kbd> | Fluid canvas pan |
| <kbd>0</kbd> | Show all cards |
| <kbd>1</kbd> .. <kbd>4</kbd> | Quick-filter by BUG, TASK, FIX, EVIDENCE |
| <kbd>Esc</kbd> | Cancel evidence linking / Close active modals |
| <kbd>?</kbd> | Toggle Interactive Shortcuts Cheatsheet |

---

## 📄 License

Distributed under the **MIT License**. See LICENSE for more information.

<div align="center">
  <sub>Built with ⚡ by <a href="https://github.com/karthikeyanV2K">karthikeyanV2K</a> using Rust, Tauri v2, React 19, and SQLite.</sub>
</div>
