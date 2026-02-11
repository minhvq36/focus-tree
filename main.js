const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');

function getDataPath() {
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

app.whenReady().then(createWindow);