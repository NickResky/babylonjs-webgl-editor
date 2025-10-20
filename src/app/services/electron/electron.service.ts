import { Injectable } from '@angular/core';

// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.
import * as childProcess from 'child_process';
import { ipcRenderer, webFrame } from 'electron';
import * as path from 'path';

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  ipcRenderer: typeof ipcRenderer;
  webFrame: typeof webFrame;
  childProcess: typeof childProcess;
  path: typeof path;

  constructor() {
    // this.ipcRenderer = window.require('electron').ipcRenderer;
    // this.webFrame = window.require('electron').webFrame;
    // this.childProcess = window.require('child_process');
    // this.path = window.require('path');
  }
}
