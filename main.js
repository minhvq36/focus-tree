const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
let streamlitProcess;

function createWindow() {
    const win = new BrowserWindow({
        fullscreen: true,
        transparent: true,
        frame: false,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html');

    // Add custom menu for close and minimize buttons
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

    win.on('closed', () => {
        if (streamlitProcess) {
            streamlitProcess.kill();
        }
    });

    // Handle minimize and close buttons
    ipcMain.on('app-minimize', () => {
        win.minimize();
    });

    ipcMain.on('app-close', () => {
        app.quit();
    });

    // Start Streamlit app (use local script inside app folder)
    try {
        const scriptPath = path.join(__dirname, 'productivity_app.py');
        const appdata = process.env.APPDATA || process.env.HOME;
        const dataPath = path.join(appdata, 'FocusTree');
        const env = Object.assign({}, process.env, {
            STREAMLIT_SERVER_HEADLESS: 'true',
            FOCUS_TREE_DATA_DIR: dataPath
        });

        // Run Streamlit headless on fixed port, hide Windows console, and suppress stdio
        streamlitProcess = spawn('streamlit', [
            'run',
            scriptPath,
            '--server.headless=true',
            '--server.port=8501',
            '--server.runOnSave=false'
        ], {
            shell: true,
            windowsHide: true,
            stdio: 'ignore',
            env
        });
    } catch (err) {
        console.error('Failed to start Streamlit:', err);
    }
}

app.whenReady().then(createWindow);
