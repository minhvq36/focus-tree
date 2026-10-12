# Focus Tree 🌱

A minimal desktop focus companion for Windows, built with Electron. Grow a tree while you focus, jot quick notes, and keep yourself accountable with a daily planning/review/work-hours tracker that scores every day.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/electron-36-47848F)
![License](https://img.shields.io/badge/license-ISC-green)

---

## Table of Contents

- [Features](#features)
  - [Stopwatch & Auto Notes](#1-stopwatch--auto-notes)
  - [Productivity Inside](#2-productivity-inside)
  - [Daily Tracker](#3-daily-tracker)
- [Getting Started](#getting-started)
- [Building a Windows Executable](#building-a-windows-executable)
- [Data Storage](#data-storage)
- [Project Structure](#project-structure)
- [Configuration](#configuration)

---

## Features

The app opens full screen (respecting the Windows taskbar) in a frameless window. Move the mouse to the top edge of the screen to reveal the **minimize** (`_`) and **close** (`×`) buttons.

### 1. Stopwatch & Auto Notes

- **Stopwatch** with Start / Pause / Reset and a circular progress ring that fills over 2 hours.
- **Growing tree** that evolves as you focus:

  | Elapsed | Stage |
  |---------|-------|
  | 0 min   | 🌱 |
  | 25 min  | 🌿 |
  | 50 min  | 🌳 |
  | 2 h     | 🌲 |

  A popup announces each evolution.
- **Auto Notes**: type a note and press *Submit* — it is appended with a timestamp to `AUTONOTES.txt` in the [data folder](#data-storage).

### 2. Productivity Inside

A weekly (Mon–Sun) work/rest tracker split into **morning** and **afternoon** blocks.

- Log *work* or *rest* stacks in minutes (a block must start with work, and the same type cannot be logged twice in a row).
- *Remove* the last stack or *Clear* the whole block.
- **Efficiency check** per block: `Rest ≤ Work` and `Work ≥ 120 min`, shown as green/red indicators.
- **Weekly overview**: stacked bar charts for morning and afternoon across the week.
- **Weekly statistics**: total work, total rest, work ratio and daily average.

### 3. Daily Tracker

A day-by-day accountability log with a cumulative score.

- **Today is determined automatically in Vietnam time** (`Asia/Ho_Chi_Minh`), independent of the computer's time zone.
- For today you can record:
  - ☑ *Planned the day*
  - ☑ *Reviewed the day*
  - ⏱ *Hours worked* (decimal, e.g. `1.4`)
- Changes are staged until you press **💾 Lưu** (Save); the status line shows unsaved changes and a preview of today's score.
- **Past days are read-only.** Saving is validated in the main process against the current Vietnam date, so yesterday's data cannot be changed from the UI — even if you leave the app open past midnight. A day that was never saved counts as *not planned, not reviewed, 0 h*.
- **↻ Làm mới** (Refresh) reloads data and re-detects the current day. The app also checks for a date rollover every minute.

**Scoring**

| Condition | Points |
|-----------|--------|
| Planned the day | **+1** |
| Reviewed the day | **+1** |
| Worked ≥ 2 h | **+2** |
| Worked ≥ 7 h | **+4** (replaces the 2 h reward) |
| Worked < 2 h | **−3**, and **no rewards at all** for that day |

**Charts** (line charts with hover tooltips)

- **Hours worked** over the last **7** or **30** days, with reference lines at 2 h and 7 h.
- **Cumulative score** from a configurable **start date** to today. The start date defaults to the first day you open the tracker; if you set it in the future, the score is 0 until that day arrives.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- Windows 10/11 (the app is developed and packaged for Windows)
- An internet connection on launch — charts use [Plotly](https://plotly.com/javascript/) from its CDN

### Install & run

```bash
git clone git@github.com:minhvq36/focus-tree.git
cd focus-tree
npm install
npm start          # or: npx electron .
```

---

## Building a Windows Executable

Close the running app first (Windows locks its files), then:

```bash
npm run build
```

The packaged app is written to `FocusTreeApp-win32-x64/`; launch `FocusTreeApp.exe`.

`npm run build` runs [`scripts/build.js`](scripts/build.js), which protects your data before packaging:

1. **Snapshots the data folder** into `%APPDATA%\FocusTree\backups\<UTC timestamp>\` (the 10 most recent snapshots are kept).
2. **Rescues old notes**: versions ≤ 1.2 wrote `AUTONOTES.txt` *inside* the build folder (`resources\app\`), which every rebuild deleted. If such a file is found, it is copied into the snapshot and merged (at the top) into `%APPDATA%\FocusTree\AUTONOTES.txt`. The build aborts if the merge cannot be verified.
3. **Packages** with `electron-packager --overwrite`, replacing only `FocusTreeApp-win32-x64/`.

> ⚠️ Always build with `npm run build` rather than calling `electron-packager` directly. The build folder is disposable — never keep anything you care about inside it.

---

## Data Storage

All user data lives in `%APPDATA%\FocusTree\`, outside the app folder, so rebuilding or reinstalling never touches it:

| File | Used by |
|------|---------|
| `AUTONOTES.txt` | Stopwatch & Auto Notes |
| `productivity_data.json` | Productivity Inside (weekly stacks) |
| `daily_tracker.json` | Daily Tracker (`startDate` + one entry per day) |
| `backups\` | Snapshots taken by `npm run build` |

`daily_tracker.json` format:

```json
{
  "startDate": "2026-10-12",
  "days": {
    "2026-10-12": { "planned": true, "reviewed": false, "hours": 2.5 }
  }
}
```

> Back up this folder to keep your history. Editing past entries by hand is possible but intentionally not supported by the UI.

---

## Project Structure

```
focus-tree/
├── main.js               # Electron main process: window, IPC, file storage, Vietnam-date logic
├── index.html            # Renderer: all three tabs (UI, styles and scripts)
├── icon.ico              # App icon used when packaging
├── package.json
├── scripts/
│   └── build.js          # Safe build: back up data, rescue old notes, package
├── productivity.html     # Legacy standalone version of the Productivity tab
├── productivity.js       #   (not loaded by the app)
└── productivity_app.py   # Legacy Streamlit prototype of the Productivity tab
```

---

## Configuration

| Setting | Where | Description |
|---------|-------|-------------|
| `FOCUSTREE_DATA_DIR` | environment variable | Overrides the data folder. Useful for development so you never touch your real data: `set FOCUSTREE_DATA_DIR=C:\temp\focustree-dev && npm start` |
| Score values & thresholds | `DAILY_POINTS`, `DAILY_MIN_HOURS`, `DAILY_STRONG_HOURS` in `index.html` | Adjust the Daily Tracker rewards/penalties. Changing them re-scores all past days. |
