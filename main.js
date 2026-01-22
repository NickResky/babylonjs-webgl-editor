const {
    app,
    BrowserWindow,
    Menu,
    screen,
    dialog,
    ipcMain
} = require('electron');
const path = require('path');

const args = process.argv;
console.log('ARGS');
console.log(args);
const serve = args.some((val) => val === '--serve');

const menuTemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Open new Entity-File',
                click: () => {
                    win.webContents.send('open-new-entity-file');
                }
            },
            {
                label: 'Open new Production Entity-File',
                click: () => {
                    win.webContents.send('open-new-production-entity-file');
                }
            }
            // {
            //   label: 'Export for production',
            //   click: () => {
            //     win.webContents.send('export-for-production');
            //   }
            // }
        ]
    },
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forcereload' },
            { role: 'toggledevtools' },
            { type: 'separator' },
            { role: 'resetzoom' },
            { role: 'zoomin' },
            { role: 'zoomout' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    }
];

function createMenu() {
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

function appIsPackaged() {
    let basepath = app.getAppPath().replace(/\\/g, '/') + '/';
    const isPackaged = basepath.indexOf('app.asar') !== -1;
    return isPackaged;
}

function handleIcp() {
    console.log('ipcMain');

    ipcMain.handle('dialog:saveFile', async (event, options) => {
        return dialog.showSaveDialogSync(win, options);
    });

    ipcMain.handle('dialog:showOpenDialogSync', async (event, options) => {
        return dialog.showOpenDialogSync(win, options);
    });

    ipcMain.handle('app:getUserDataPath', () => {
        return app.getPath('userData');
    });

    ipcMain.handle('app:getAppBasePath', () => {
        const isPackaged = appIsPackaged();
        let basepath = app.getAppPath().replace(/\\/g, '/') + '/';
        if (isPackaged) {
            console.log('is packaged');
            // TODO fix this
            // basepath = process.env['PORTABLE_EXECUTABLE_DIR'].replace(/\\/g, '/') + '/';
        }
        return basepath;
    });
}

function createWindow() {
    const electronScreen = screen;
    const size = electronScreen.getPrimaryDisplay().workAreaSize;
    // Create the browser window.
    win = new BrowserWindow({
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: true,
            allowRunningInsecureContent: true, // serve ? true : false,
            webSecurity: false
        }
    });
    win.webContents.session.setCertificateVerifyProc((request, callback) => {
        callback(0);
    });

    // Load Angular build
    if (serve || true) {
        console.log('serve');
        // require('electron-reload')(__dirname, {
        //   electron: require(`${__dirname}/node_modules/electron`),
        // });
        win.loadURL('http://localhost:4205');
    } else {
        console.log('build');
        win.loadFile(
            path.join(__dirname, 'dist/mhp-webgl-editor/browser/index.html')
        );
        // win.loadURL(url.format({
        //     pathname: path.join(__dirname, 'dist/mhp-webgl-editor/browser/index.html'),
        //     protocol: 'file:',
        //     slashes: true
        // }));
    }
}

app.whenReady().then(() => {
    handleIcp();
    createWindow();
    createMenu();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
