const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');

/* Keep track of the child process to manage its lifecycle 
*/
let streamlitProcess;

function killStreamlit(callback) {
    /* On Windows, spawn with shell:true creates a cmd.exe wrapper.
    Using taskkill with /F (force) and /T (tree) ensures all child 
    processes (Python, Streamlit) are terminated properly.
    */
    if (streamlitProcess && streamlitProcess.pid) {
        const cmd = `taskkill /pid ${streamlitProcess.pid} /f /t`;
        exec(cmd, (err) => {
            if (err) {
                /* Log error but proceed to quit anyway */
                console.error('Master: Clean-up failed, process might have already exited.', err);
            }
            if (callback) callback();
        });
    } else {
        if (callback) callback();
    }
}

function createWindow() {
    /* Configuration for Overlay Fullscreen mode 
    */
    const win = new BrowserWindow({
        fullscreen: true,
        alwaysOnTop: true,
        /* skipTaskbar: false ensures the icon is visible for the user */
        skipTaskbar: false,
        transparent: true,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    /* Force the window to stay above the Taskbar 
    */
    win.setAlwaysOnTop(true, 'screen-saver');

    win.loadFile('index.html');

    /* Minimal Menu for system interaction 
    */
    const menu = Menu.buildFromTemplate([
        {
            label: 'System',
            submenu: [
                { label: 'Minimize', click: () => win.minimize() },
                { label: 'Quit', click: () => app.quit() }
            ]
        }
    ]);
    Menu.setApplicationMenu(menu);

    /* IPC Communication 
    */
    ipcMain.on('app-minimize', () => {
        win.minimize();
    });

    ipcMain.on('app-close', () => {
        /* Master approach: Kill children before closing the main app 
        */
        killStreamlit(() => {
            app.quit();
        });
    });

    /* Streamlit Orchestration 
    */
    try {
        const scriptPath = path.join(__dirname, 'productivity_app.py');
        const appdata = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.config');
        const dataPath = path.join(appdata, 'FocusTree');
        
        const env = Object.assign({}, process.env, {
            STREAMLIT_SERVER_HEADLESS: 'true',
            FOCUS_TREE_DATA_DIR: dataPath
        });

        /* We avoid shell:true here for more direct PID management if possible.
        If 'streamlit' command is not in PATH, use absolute path to python/streamlit.
        */
        streamlitProcess = spawn('streamlit', [
            'run',
            scriptPath,
            '--server.headless=true',
            '--server.port=8501',
            '--server.runOnSave=false'
        ], {
            shell: true, // Kept for command resolution, but handled by taskkill /t
            windowsHide: true,
            stdio: 'ignore',
            env
        });

    } catch (err) {
        console.error('Master Critical: Failed to boot Streamlit engine.', err);
    }
}

/* Ensure no orphans are left when the app is closed through other means 
*/
app.on('before-quit', (e) => {
    if (streamlitProcess && !streamlitProcess.killed) {
        /* Prevent app from quitting immediately to allow cleanup */
        e.preventDefault();
        killStreamlit(() => {
            streamlitProcess = null;
            app.exit(); 
        });
    }
});

/* Handle Window-all-closed to ensure standard Electron behavior 
*/
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.whenReady().then(createWindow);