const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

let mainWindow;

// Function to extract images from CBZ file
function extractImagesFromCbz(cbzPath) {
    return new Promise((resolve, reject) => {
        try {
            const zip = new AdmZip(cbzPath);
            const tempDir = path.join(app.getPath('temp'), 'cbz_temp', path.basename(cbzPath, '.cbz'));

            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Filter for image entries only
            const imageEntries = zip.getEntries().filter(entry => entry.entryName.match(/\.(png|jpe?g|gif)$/i));

            if (imageEntries.length === 0) {
                return reject('No images found in CBZ file.');
            }

            const imagePaths = imageEntries.map(entry => {
                const sanitizedEntryName = entry.entryName.replace(/[^\w.-]/g, '_'); // Sanitize filename
                const outputPath = path.join(tempDir, sanitizedEntryName);
                fs.writeFileSync(outputPath, entry.getData());
                return outputPath;
            });

            resolve(imagePaths);
        } catch (error) {
            reject(error);
        }
    });
}

// Create the Electron window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minHeight: 600,
        minWidth: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        },
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Handle the open-file-dialog event
ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'CBZ Files', extensions: ['cbz'] }]
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const cbzPath = result.filePaths[0];
    try {
        const images = await extractImagesFromCbz(cbzPath);
        return { images, filePath: cbzPath };
    } catch (error) {
        console.error(error);
        throw error;
    }
});

// Handle open-file-from-path event (for saved volumes)
ipcMain.handle('open-file-from-path', async (event, cbzPath) => {
    try {
        const images = await extractImagesFromCbz(cbzPath);
        return images;
    } catch (error) {
        console.error(error);
        throw error;
    }
});

// Electron app ready event
app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

try {
    require('electron-reloader')(module)
  } catch (_) {}