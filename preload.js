const { contextBridge, ipcRenderer } = require('electron');
console.log('PRELOAD.JS');
const path = require('path');
const fs = require('fs');

contextBridge.exposeInMainWorld('electronAPI', {
  path: () => path,
  onOpenNewEntityFile: (callback) => ipcRenderer.on('open-new-entity-file', callback),
  showSaveDialogSync: (options) => ipcRenderer.invoke('dialog:showSaveDialogSync', options),
  showOpenDialogSync: (options) => ipcRenderer.invoke('dialog:showOpenDialogSync', options),
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
  getAppBasePath: () => ipcRenderer.invoke('app:getAppBasePath'),
  fsConstants: () => fs.constants,
  fsExistsSync: (filePath) => fs.existsSync(filePath),
  fsEnsureDirSync: (path) => fs.ensureDirSync(path),
  fsReadJSONSync: (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8')),
  fsReadJSON: (filePath) => ipcRenderer.invoke('fs:readJSON', filePath),
  fsReadFileSync: (filePath, options) => fs.readFileSync(filePath, options),
  fsReadFile: (filePath, options, callback) => fs.readFile(filePath, options, callback),
  fsWriteJSONSync: (filePath, content, options) => fs.writeJSONSyc(filePath, content, options),
  fsCopyFileSync: (filePath, target) => fs.copyFileSync(filePath, target),
  fsCopyFile: (path, target, callback) => fs.copyFile(path, target, callback),
  fsCopySync: (src, target, options) => fs.copySync(src, target, options),
  fsReaddir: (path, callback) => fs.readdir(path, callback),
  fsReaddirSync: (path) => fs.readdirSync(path),
  fsMkdirSync: (path) => fs.mkdirSync(path),
  fsRmdirSync: (path) => fs.rmdirSync(path),
  fsWriteFileSync: (path, content) => fs.writeFileSync(path, content),
  fsWriteFile: (path, content, options, callback) => fs.writeFile(path, content, options, callback),
  fsAccess: (path, flags, callback) => fs.access(path, flags, callback),
  fsPromisesMkDir: (path, options) => fs.promises.mkdir(path, options),
  fsPromisesLstat: (path) => fs.promises.lstat(path),
  fsStat: (path, callback) => fs.stat(path, callback),
  fsUnlink: (path, callback) => fs.unlink(path, callback),
  fsRename: (path, newPath, callback) => fs.rename(path, newPath, callback),
  fsStatSync: (path) => fs.statSync(path),
  fsChmodSync: (path, mode) => fs.chmodSync(path, mode),
});
