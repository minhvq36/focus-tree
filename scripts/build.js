/*
Safe build for Windows.
1. Snapshot the user data folder into <data>/backups/<timestamp>/
2. Rescue AUTONOTES.txt left inside an old build (versions <= 1.2 wrote notes there)
3. Package the app with electron-packager (overwrites the old build folder)

Usage: npm run build
*/
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_NAME = 'FocusTreeApp';
const BUILD_DIR = path.join(ROOT, `${APP_NAME}-win32-x64`);
const LEGACY_NOTES = path.join(BUILD_DIR, 'resources', 'app', 'AUTONOTES.txt');
const KEEP_SNAPSHOTS = 10;
const IGNORE = ['^/dist', '^/__pycache__', '^/scripts', `^/${APP_NAME}-win32-x64`, '^/productivity_app\\.py'];

/* Must match getDataPath() in main.js */
function getDataPath() {
    if (process.env.FOCUSTREE_DATA_DIR) return process.env.FOCUSTREE_DATA_DIR;
    const appdata = process.env.APPDATA || process.env.HOME;
    return path.join(appdata, 'FocusTree');
}

function timestamp() {
    return new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
}

function snapshotData(dataDir) {
    const dest = path.join(dataDir, 'backups', timestamp());
    fs.mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(dataDir, { withFileTypes: true }).filter(entry => entry.isFile());
    files.forEach(file => fs.copyFileSync(path.join(dataDir, file.name), path.join(dest, file.name)));
    console.log(`✓ Backed up ${files.length} data file(s) to ${dest}`);
    return dest;
}

function pruneSnapshots(dataDir) {
    const backupsDir = path.join(dataDir, 'backups');
    const snapshots = fs.readdirSync(backupsDir).filter(name => /^\d{4}-\d{2}-\d{2}-/.test(name)).sort();
    snapshots.slice(0, -KEEP_SNAPSHOTS).forEach(name => {
        fs.rmSync(path.join(backupsDir, name), { recursive: true, force: true });
    });
}

function rescueLegacyNotes(dataDir, snapshotDir) {
    if (!fs.existsSync(LEGACY_NOTES)) return;

    const legacy = fs.readFileSync(LEGACY_NOTES, 'utf8');
    fs.copyFileSync(LEGACY_NOTES, path.join(snapshotDir, 'AUTONOTES-from-old-build.txt'));

    /* Old-build notes are older than anything in the data dir, so they go first */
    const notesFile = path.join(dataDir, 'AUTONOTES.txt');
    const current = fs.existsSync(notesFile) ? fs.readFileSync(notesFile, 'utf8') : '';
    if (!current.includes(legacy)) {
        fs.writeFileSync(notesFile, legacy + current, 'utf8');
    }

    if (!fs.readFileSync(notesFile, 'utf8').includes(legacy)) {
        throw new Error(`Could not move notes from ${LEGACY_NOTES} — build aborted, nothing was deleted.`);
    }
    console.log(`✓ Moved notes from old build into ${notesFile}`);
}

function main() {
    const dataDir = getDataPath();
    fs.mkdirSync(dataDir, { recursive: true });

    const snapshotDir = snapshotData(dataDir);
    rescueLegacyNotes(dataDir, snapshotDir);
    pruneSnapshots(dataDir);

    const ignoreArgs = IGNORE.map(pattern => `--ignore="${pattern}"`).join(' ');
    execSync(
        `npx --yes electron-packager . ${APP_NAME} --platform=win32 --arch=x64 --overwrite --icon=icon.ico --out=. ${ignoreArgs}`,
        { cwd: ROOT, stdio: 'inherit' }
    );
    console.log(`✓ Built ${path.join(BUILD_DIR, `${APP_NAME}.exe`)}`);
}

main();
