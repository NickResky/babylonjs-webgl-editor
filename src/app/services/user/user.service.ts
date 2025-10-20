import { Injectable } from '@angular/core';
import { MVUserStore } from '../../models/mv-user-store';
import { ElectronService } from '../electron/electron.service';
import { FileAccessService, FileType } from '../file-access/file-access.service';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private _appPath: string;
  private readonly _appStoreName: string;

  constructor(
    private fileAccessService: FileAccessService,
    private electronService: ElectronService
  ) {
    this._appStoreName = 'userConfig';
  }

  public async getUserStore(): Promise<MVUserStore> {
    this._appPath = await (window as any).electronAPI.getUserDataPath();
    const store: MVUserStore = await this.getStore();
    const sessionId = Date.now().toString();
    if (!store.sessionId) {
      store.sessionId = sessionId;
      await this.setUserStore(store);
    }
    return store;
  }

  public async setUserStore(store: MVUserStore): Promise<void> {
    const newStore = JSON.stringify(store);
    await this.fileAccessService.updateFile(
      this._appPath,
      this._appStoreName,
      FileType.JSON,
      newStore
    );
  }

  private async getStore(): Promise<MVUserStore> {
    try {
      const store = await this.fileAccessService.getFile(
        this._appPath,
        this._appStoreName,
        FileType.JSON
      );
      if (store.length == 0) {
        return await this.createNewStore();
      }
      return JSON.parse(store);
    } catch (e) {
      if (e.toString().includes('not exist')) {
        return await this.createNewStore();
      } else {
        throw e;
      }
    }
  }

  private async createNewStore(): Promise<MVUserStore> {
    const newStore: MVUserStore = {
      entityBasePath: null,
      entityName: null,
      sessionId: Date.now().toString(),
      productionMode: false,
    };
    try {
      const store = await this.fileAccessService.getFile(
        this._appPath,
        this._appStoreName,
        FileType.JSON
      );
    } catch (err) {
      await this.fileAccessService.addFile(
        this._appPath,
        this._appStoreName,
        FileType.JSON,
        JSON.stringify(newStore)
      );
      return newStore;
    }

    await this.fileAccessService.updateFile(
      this._appPath,
      this._appStoreName,
      FileType.JSON,
      JSON.stringify(newStore)
    );

    return newStore;
  }
}
