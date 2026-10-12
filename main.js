const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');

function getDataPath() {
    /* FOCUSTREE_DATA_DIR lets dev runs use a sandbox dir instead of live data */
    if (process.env.FOCUSTREE_DATA_DIR) return process.env.FOCUSTREE_DATA_DIR;
    const appdata = process.env.APPDATA || process.env.HOME;
    return path.join(appdata, 'FocusTree');
}

function ensureDataDir() {
    const dataDir = getDataPath();
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

function getDataFile() {
    return path.join(getDataPath(), 'productivity_data.json');
}

function createWindow() {
    /* Get primary display workAreaSize to respect Windows taskbar */
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const win = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        skipTaskbar: false,
        transparent: true,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html');

    /* Add custom menu for close and minimize buttons */
    const menu = Menu.buildFromTemplate([
        {
            label: 'Window',
            submenu: [
                {
                    label: 'Minimize',
                    click: () => win.minimize()
                },
                {
                    label: 'Close',
                    click: () => app.quit()
                }
            ]
        }
    ]);

    Menu.setApplicationMenu(menu);

    /* Handle minimize and close buttons */
    ipcMain.on('app-minimize', () => {
        win.minimize();
    });

    ipcMain.on('app-close', () => {
        app.quit();
    });

    /* Ensure data directory exists */
    ensureDataDir();
}

/*
IPC Handlers for Productivity Data
*/
ipcMain.handle('load-productivity-data', async () => {
    try {
        const dataFile = getDataFile();
        if (fs.existsSync(dataFile)) {
            const data = fs.readFileSync(dataFile, 'utf8');
            let parsedData = JSON.parse(data);
            
            /* Ensure all days and blocks exist */
            const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const BLOCKS = ['morning', 'afternoon'];
            DAYS.forEach(day => {
                if (!parsedData[day]) {
                    parsedData[day] = {};
                }
                BLOCKS.forEach(block => {
                    if (!parsedData[day][block]) {
                        parsedData[day][block] = [];
                    }
                });
            });
            
            return parsedData;
        } else {
            /* Return empty structure if file doesn't exist */
            const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const BLOCKS = ['morning', 'afternoon'];
            const data = {};
            DAYS.forEach(day => {
                data[day] = {};
                BLOCKS.forEach(block => {
                    data[day][block] = [];
                });
            });
            return data;
        }
    } catch (err) {
        console.error('Error loading productivity data:', err);
        throw err;
    }
});

ipcMain.handle('save-productivity-data', async (event, data) => {
    try {
        ensureDataDir();
        const dataFile = getDataFile();
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
        return { success: true };
    } catch (err) {
        console.error('Error saving productivity data:', err);
        throw err;
    }
});

/*
IPC Handler for Auto Notes
*/
ipcMain.handle('append-note', async (event, line) => {
    ensureDataDir();
    fs.appendFileSync(path.join(getDataPath(), 'AUTONOTES.txt'), line, 'utf8');
    return { success: true };
});

/*
IPC Handlers for Daily Tracker
Only today's entry (Vietnam time) can be written; past days are read-only.
*/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getDailyFile() {
    return path.join(getDataPath(), 'daily_tracker.json');
}

function vnToday() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

function writeDaily(data) {
    ensureDataDir();
    fs.writeFileSync(getDailyFile(), JSON.stringify(data, null, 2), 'utf8');
}

function readDaily() {
    const dataFile = getDailyFile();
    if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        if (!DATE_RE.test(data.startDate)) data.startDate = vnToday();
        if (!data.days || typeof data.days !== 'object') data.days = {};
        return data;
    }
    /* First run: pin the start date to today so it doesn't drift */
    const data = { startDate: vnToday(), days: {} };
    writeDaily(data);
    return data;
}

ipcMain.handle('daily-today', async () => vnToday());

ipcMain.handle('daily-load', async () => {
    return { today: vnToday(), ...readDaily() };
});

ipcMain.handle('daily-save-today', async (event, clientDate, entry) => {
    const today = vnToday();
    if (clientDate !== today) {
        return { success: false, error: 'day-changed', today };
    }
    const hours = Number(entry.hours);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
        return { success: false, error: 'invalid-hours', today };
    }
    const data = readDaily();
    data.days[today] = {
        planned: !!entry.planned,
        reviewed: !!entry.reviewed,
        hours: Math.round(hours * 100) / 100
    };
    writeDaily(data);
    return { success: true, today, ...data };
});

ipcMain.handle('daily-set-start', async (event, startDate) => {
    if (!DATE_RE.test(startDate)) {
        return { success: false, error: 'invalid-date' };
    }
    const data = readDaily();
    data.startDate = startDate;
    writeDaily(data);
    return { success: true, today: vnToday(), ...data };
});

app.whenReady().then(createWindow);