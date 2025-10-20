import { Injectable } from '@angular/core';
import { DataService } from '../data/data.service';
import { ElectronService } from '../electron/electron.service';
import { NotifierService } from '../notifier/notifier.service';

export enum FileType {
  JSON = '.json',
  JPG = '.jpg',
  GLB = '.glb',
  UNKNOWN = '',
}

@Injectable({
  providedIn: 'root',
})
export class FileAccessService {
  private invalidCharacters =
    /[ ^°+;,$%&/()=#!@"&<>¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿŒœŸΑαΒβΓγΔδΕεΖζΗηΘθΙιΚκΛλΜμΝνΞξΟοΠπΡρΣςσΤτΥυΦφΧχΨψΩωϑϒϖ∀∂∃∅∇∈∉∋∏∑−∗√∝∞∠∧∨∩∪∫∴∼≅≈≠≡≤≥⊂⊃⊄⊆⊇⊕⊗⊥⋅◊℘ℑℜℵ⌈⌉⌊⌋〈〉←↑→↓↔↵⇐⇑⇒⇓⇔   ‎‏–—‘’‚“”„‹›«»†‡‰“””“„”«»»«‹››‹•…′‾⁄™€♠♣♥♦]/g;

  constructor(
    private electronService: ElectronService,
    private notifierService: NotifierService,
    private dataService: DataService
  ) {}

  public async exists(filePath: string): Promise<boolean> {
    const constants = (window as any).electronAPI.fsConstants();
    const flags = constants.F_OK;
    return await new Promise<boolean>((resolve) => {
      (window as any).electronAPI.fsAccess(filePath, flags, (error) =>
        error ? resolve(false) : resolve(true)
      );
    });
  }

  public getDirName(filePath: string): string {
    return (window as any).electronAPI.path().dirname(filePath);
  }

  public getFileName(filePath: string): string {
    return (window as any).electronAPI.path().basename(filePath);
  }

  public getFileType(filePath: string): string {
    return (window as any).electronAPI.path().extname(filePath);
  }

  public async getFileSize(filePath: string): Promise<number> {
    const stats = await (window as any).electronAPI.fsPromisesLstat(filePath);
    return stats.size;
  }

  public async getFileTimestamp(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      (window as any).electronAPI.fsStat(filePath, (error, stats) =>
        error ? reject(error) : resolve(stats.mtime.toISOString())
      );
    });
  }

  public hasUpperCase(fileName: string) {
    return fileName.toLowerCase() != fileName;
  }

  public hasInvalidCharacters(fileName: string) {
    return this.invalidCharacters.test(fileName);
  }

  public sanitizeFileName(fileName: string) {
    const oldFileName = fileName;

    if (!this.dataService.allowUppercase) {
      fileName = fileName.toLocaleLowerCase();
    }
    fileName = fileName.replace(this.invalidCharacters, '');
    this.notifierService.notify(
      'warning',
      `Because of invalid characters "${oldFileName}" was changed to "${fileName}".`
    );
    console.warn(`Because of invalid characters "${oldFileName}" was changed to "${fileName}".`);
    return fileName;
  }

  public getFileExtensionFromFileName(file: string): FileType {
    const regexJsonFile = new RegExp('.json$', 'i');
    if (regexJsonFile.test(file)) {
      return FileType.JSON;
    } else {
      return FileType.UNKNOWN;
    }
  }

  public async getFile(basePath: string, fileName: string, fileType: FileType): Promise<string> {
    const electronAPI = (window as any).electronAPI;
    let filePath = electronAPI.path().join(basePath, fileName);
    filePath = filePath + fileType;
    filePath = filePath.replace('file:', '');
    const exist = await this.exists(filePath);
    return new Promise<string>((resolve, reject) => {
      if (!exist) {
        reject(`File ${filePath} not exist`);
        // resolve(undefined);
        return;
      }
      console.log(filePath);
      return (window as any).electronAPI.fsReadFile(
        filePath,
        { encoding: 'utf8' },
        (err, data: any) => {
          if (err) reject(err);
          resolve(data);
          return data;
        }
      );
    });
  }

  public async addFile(
    basePath: string,
    fileName: string,
    fileType: FileType,
    data: string
  ): Promise<void> {
    const filePath = (window as any).electronAPI.path().join(basePath, fileName) + fileType;
    const exist = await this.exists(filePath);
    return new Promise<void>((resolve, reject) => {
      if (exist) {
        reject(`File ${fileName} already exist in ${basePath}`);
      }
      (window as any).electronAPI.fsWriteFile(filePath, data, 'utf8', (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }

  public setReadAndWritePermissions(filePath): void {
    let mode = (window as any).electronAPI.fsStatSync(filePath).mode;
    let newMode = mode | 0o666;
    (window as any).electronAPI.fsChmodSync(filePath, newMode);
  }

  public async updateFile(
    basePath: string,
    fileName: string,
    fileType: FileType,
    data: string
  ): Promise<void> {
    const filePath = (window as any).electronAPI.path().join(basePath, fileName) + fileType;
    const exist = await this.exists(filePath);
    this.setReadAndWritePermissions(filePath);
    return new Promise<void>((resolve, reject) => {
      if (!exist) {
        reject(`File ${fileName} not exist in ${basePath}`);
      }
      (window as any).electronAPI.fsWriteFile(filePath, data, 'utf8', (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }

  public async renameFile(
    basePath: string,
    fileName: string,
    fileType: FileType,
    newFileName: string
  ): Promise<void> {
    const filePath = (window as any).electronAPI.path().join(basePath, fileName) + fileType;
    const exist = await this.exists(filePath);
    return new Promise<void>((resolve, reject) => {
      if (!exist) {
        reject(`File ${fileName} does not exist in ${basePath}`);
      }
      const newFilePath = (window as any).electronAPI.path().join(basePath, newFileName + fileType);
      (window as any).electronAPI.fsRename(filePath, newFilePath, (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }

  public async removeFile(url: string): Promise<void> {
    const exist = await this.exists(url);
    return new Promise<void>((resolve, reject) => {
      if (!exist) {
        reject(`File ${url} not exist`);
      }
      (window as any).electronAPI.fsUnlink(url, (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }

  public async copyFileFromPathToNewPath(filePath: string, newFilePath: string): Promise<void> {
    const exist = await this.exists(filePath);
    return new Promise<void>((resolve, reject) => {
      if (!exist) {
        reject(`${filePath} not exist`);
      }
      (window as any).electronAPI.fsCopyFile(filePath, newFilePath, (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }

  public async copyFile(sourcePath: string, destinationPath: string) {
    const filePath = (window as any).electronAPI.path().dirname(destinationPath);
    await (window as any).electonAPI.fsPromisesMkdir(filePath, { recursive: true });
    return new Promise<string>((resolve, reject) => {
      (window as any).electronAPI.fsCopyFile(sourcePath, destinationPath, (error) =>
        error ? reject(error) : resolve(destinationPath)
      );
    });
  }

  public async getFilesInDirectory(directoryPath: string): Promise<string[]> {
    const exist = await this.exists(directoryPath);
    return new Promise<string[]>((resolve, reject) => {
      if (!exist) {
        reject(`Directory '${directoryPath}' not exist`);
      }
      (window as any).electronAPI.fsReaddir(directoryPath, (err, files) => {
        if (err) reject(err);
        resolve(files);
      });
    });
  }
}
