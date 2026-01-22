import { Injectable } from '@angular/core';
import { GlbMetaData, MVMeshSetting } from 'mv-core';
import { Subject } from 'rxjs';
import { MVUserStore } from '../../models/mv-user-store';
import { ElectronService } from '../electron/electron.service';
import { FileAccessService } from '../file-access/file-access.service';
import { UserService } from '../user/user.service';
import { DracoCompressionService } from './draco-compression.service';
import { FileGroup, FileGroupSetupService } from './file-group-setup.service';

@Injectable({
    providedIn: 'root'
})
export class ConverterService {
    private _inputDirectory$ = new Subject<string>();
    private _inputDirectory: string;
    public inputDirectory$ = this._inputDirectory$.asObservable();
    private _outputDirectory$ = new Subject<string>();
    private _outputDirectory: string;
    public outputDirectory$ = this._outputDirectory$.asObservable();
    private _log$ = new Subject<string>();
    public log$ = this._log$.asObservable();
    private _conversionInProgress$ = new Subject<boolean>();
    public conversionInProgress$ = this._conversionInProgress$.asObservable();
    private _blenderPath: string;
    private _blenderPath$ = new Subject<string>();
    public blenderPath$ = this._blenderPath$.asObservable();
    private _nodePath: string;
    private _nodePath$ = new Subject<string>();
    public nodePath$ = this._nodePath$.asObservable();
    private userStore: MVUserStore;

    constructor(
        private electronService: ElectronService,
        private userService: UserService,
        private GroupSetupService: FileGroupSetupService,
        private dracoCompressionService: DracoCompressionService,
        private fileAccessService: FileAccessService
    ) {
        this.userService.getUserStore().then((userStore) => {
            this.userStore = userStore;
            this._inputDirectory = this.userStore.conversionInputDirectory;
            this._inputDirectory$.next(this._inputDirectory);
            this._outputDirectory = this.userStore.conversionOutputDirectory;
            this._outputDirectory$.next(this._outputDirectory);

            if (this.userStore.blenderPath) {
                const blenderPathExists = (
                    window as any
                ).electronAPI.fsExistsSync(this.userStore.blenderPath);
                if (blenderPathExists) {
                    this._blenderPath = this.userStore.blenderPath;
                    this._blenderPath$.next(this._blenderPath);
                }
            }

            if (this.userStore.nodePath) {
                const nodePathExists = (window as any).electronAPI.fsExistsSync(
                    this.userStore.nodePath
                );
                if (nodePathExists) {
                    this._nodePath = this.userStore.nodePath;
                    this._nodePath$.next(this._nodePath);
                }
            }
        });
    }

    async chooseInputDirectory() {
        const defaultPath = this._inputDirectory?.replace(/\//g, '\\');
        const openDialogOptions: Electron.OpenDialogSyncOptions = {
            title: 'Open input folder',
            properties: ['openDirectory'],
            defaultPath: defaultPath
        };

        const paths = await (window as any).electronAPI.showOpenDialogSync(
            openDialogOptions
        );
        if (paths && paths.length > 0) {
            this.setInputDirectory(paths[0]);
        }
    }

    async chooseOutputDirectory() {
        const defaultPath = this._outputDirectory?.replace(/\//g, '\\');
        const openDialogOptions: Electron.OpenDialogSyncOptions = {
            title: 'Open output folder',
            properties: ['openDirectory'],
            defaultPath: defaultPath
        };

        const paths = await (window as any).electronAPI.showOpenDialogSync(
            openDialogOptions
        );
        if (paths && paths.length > 0) {
            this.setOutputDirectory(paths[0]);
        }
    }

    async chooseBlenderPath() {
        const openDialogOptions: any = {
            title: 'Select blender.exe',
            filters: [{ extensions: ['exe'] }]
        };
        const result = await (window as any).electronAPI.showOpenDialogSync(
            openDialogOptions
        );
        let path = result[0];
        if (path) {
            path = path.replace(/\\/g, '/');
            this.setBlenderPath(path);
        }
    }

    setBlenderPath(blenderPath: string) {
        this._blenderPath = blenderPath;
        this._blenderPath$.next(this._blenderPath);
        this.userStore['blenderPath'] = this._blenderPath;
        this.userService.setUserStore(this.userStore);
    }

    async chooseNodePath() {
        const openDialogOptions: any = {
            title: 'Select node.exe',
            filters: [{ extensions: ['exe'] }]
        };
        const result = await (window as any).electronAPI.showOpenDialogSync(
            openDialogOptions
        );
        let path = result[0];
        if (path) {
            path = path.replace(/\\/g, '/');
            this.setNodePath(path);
        }
    }

    setNodePath(nodePath: string) {
        this._nodePath = nodePath;
        this._nodePath$.next(this._nodePath);
        this.userStore['nodePath'] = this._nodePath;
        this.userService.setUserStore(this.userStore);
    }

    setInputDirectory(inputDirectory: string) {
        this._inputDirectory = inputDirectory.replace(/\\/g, '/');
        this._inputDirectory$.next(this._inputDirectory);
        this.userStore['conversionInputDirectory'] = this._inputDirectory;
        this.userService.setUserStore(this.userStore);
    }

    setOutputDirectory(outputDirectory: string) {
        this._outputDirectory = outputDirectory.replace(/\\/g, '/');
        this._outputDirectory$.next(this._outputDirectory);
        this.userStore['conversionOutputDirectory'] = this._outputDirectory;
        this.userService.setUserStore(this.userStore);
    }

    getAppBasePath(): Promise<string> {
        return (window as any).electronAPI.getAppBasePath();
    }

    async setBlenderConfig(
        options: ConversionConfigJSON
    ): Promise<ConversionConfigJSON> {
        const basepath = await this.getAppBasePath();
        const configPath = basepath + '/mv-webgl-pipeline-tools/config.json';

        const config: ConversionConfigJSON = (
            window as any
        ).electronAPI.fsReadJSONSync(configPath);

        config['tmpPath'] = basepath + '/mv-webgl-pipeline-tools/_tmp/';
        config['inputDirectory'] = options.inputDirectory;
        config['outputDirectory'] = options.outputDirectory;
        config['blenderToolsPath'] =
            basepath + '/mv-webgl-pipeline-tools/blender_tools/';
        config['productionBuild'] = options.productionBuild;
        config['blenderPath'] = this._blenderPath;
        config['assetsBaseUrl'] = options.assetsBaseUrl;
        config['entityConfigFile'] = options.entityConfigFile;
        config['mergeBySameMaterial'] = options.mergeBySameMaterial;
        config['outputMeshSettingsUrl'] = options.outputMeshSettingsUrl;
        config['glbMetaDataUrl'] = options.glbMetaDataUrl;
        config['preventVertexColorDeletionDuringBuild'] =
            options.preventVertexColorDeletionDuringBuild;
        config['preventDracoCompressionDuringBuild'] =
            options.preventDracoCompressionDuringBuild;

        this.fileAccessService.setReadAndWritePermissions(configPath);
        (window as any).electronAPI.fsWriteJSONSync(configPath, config, {
            spaces: 2
        });

        return config;
    }

    async startNonProductionConversion(): Promise<ConversionStatus> {
        return this.runGlbConversion({
            assetsBaseUrl: '',
            entityConfigFile: '',
            inputDirectory: this._inputDirectory,
            outputDirectory: this._outputDirectory,
            mergeBySameMaterial: true,
            productionBuild: false
        });
    }

    private getNodePath(): string {
        let nodePath = 'node';
        if (this._nodePath) {
            nodePath = this._nodePath;
        }
        return nodePath;
    }

    async runGlbConversion(
        options: ConversionConfigJSON
    ): Promise<ConversionStatus> {
        this._conversionInProgress$.next(true);

        const config: ConversionConfigJSON =
            await this.setBlenderConfig(options);

        const nodePath = this.getNodePath();

        console.log('Using node path: ' + nodePath);

        const basepath = await this.getAppBasePath();

        this._log$.next('Setting up file groups');

        // const fileGroups = await this.fileGroupSetupService.setupFileGroups(config);

        // TODO fix this
        // const fileGroupsScript = spawn(
        //   nodePath,
        //   [basepath + 'mv-webgl-pipeline-tools/setupFileGroups.js'],
        //   { stdio: ['ignore', 'pipe', process.stderr] }
        // );

        // await this.echoReadable(fileGroupsScript.stdout);

        let fileGroups: FileGroup[];

        try {
            const fileGroupsJson = await (
                window as any
            ).electronAPI.fsReadJSONSync(config.tmpPath + '/file_groups.json');
            fileGroups = fileGroupsJson.groups;
        } catch (error) {
            this._log$.next('Error reading file_groups.json');
            return {
                successful: false,
                meshSettings: null,
                glbMetaData: null
            };
        }

        if (!fileGroups || fileGroups.length == 0) {
            this._log$.next('No files found to convert');
            return {
                successful: true,
                meshSettings: null,
                glbMetaData: null
            };
        }

        let meshSettings: ProductionMeshSettings = {};
        let glbMetaData: GlbMetaData = {};

        (window as any).electronAPI.fsCopySync(
            config.inputDirectory,
            config.outputDirectory,
            {
                recursive: true
            }
        );

        // TODO fix this
        // const fbxToGlbScript = (window as any).electronAPI.spawn('python', [
        //     basepath + 'mv-webgl-pipeline-tools/blender_tools/fbx_to_glb_CLI.py'
        // ]);

        // await this.echoReadable(fbxToGlbScript.stdout);

        // if (config.outputMeshSettingsUrl) {
        //     try {
        //         meshSettings = await (window as any).electronAPI.fsReadJSONSync(
        //             config.outputMeshSettingsUrl
        //         );
        //         if (options.glbMetaDataUrl) {
        //             glbMetaData = await (
        //                 window as any
        //             ).electronAPI.fsReadJSONSync(options.glbMetaDataUrl);
        //         }
        //     } catch (error) {
        //         const message = 'No fbx files were found to convert';
        //         console.log(message);
        //         this._log$.next(message);
        //         return {
        //             successful: true,
        //             meshSettings: null,
        //             glbMetaData: null
        //         };
        //     }
        // }

        this._log$.next('Running draco compression');

        // await this.dracoCompressionService.convert(config);

        // TODO fix this
        // const dracoGlbScript = spawn(
        //   nodePath,
        //   [basepath + 'mv-webgl-pipeline-tools/glb_to_glb_draco.js'],
        //   { stdio: ['ignore', 'pipe', process.stderr] }
        // );

        // await this.echoReadable(dracoGlbScript.stdout);

        this._log$.next('Running draco complete');

        this._conversionInProgress$.next(false);

        return {
            successful: true,
            meshSettings: meshSettings,
            glbMetaData: glbMetaData
        };
    }

    async runTextureConversion(
        inputDirectory: string,
        outputDirectory: string,
        conversionTarget: ConversionTarget
    ) {
        this._log$.next(`Running texture conversion for ${conversionTarget}`);

        const nodePath = this.getNodePath();
        const basepath = await this.getAppBasePath();

        const scriptArguments = [
            basepath + 'mv-webgl-pipeline-tools/texture-converter.js',
            inputDirectory,
            outputDirectory,
            conversionTarget
        ];

        // Texture conversion settings include overwrite settings for mobile textures and are optional
        const textureConversionSettingsPath =
            inputDirectory + '/texture_conversion_settings.json';
        if (
            (window as any).electronAPI.fsExistsSync(
                textureConversionSettingsPath
            )
        ) {
            scriptArguments.push(textureConversionSettingsPath);
        }

        // TODO fix this
        // const mobileTextureConverterScript = spawn(nodePath, scriptArguments, {
        //   stdio: ['ignore', 'pipe', process.stderr],
        // });

        // await this.echoReadable(mobileTextureConverterScript.stdout);

        const log = `Texture conversion complete for ${conversionTarget}`;
        console.log(log);
        this._log$.next(log);
    }

    async echoReadable(readable) {
        const lines = (window as any).chunksToLinesAsync(readable);
        for await (const line of lines) {
            if (line.startsWith('###')) {
                this._log$.next(line.replace('###', ''));
            }
            console.log(line);
        }
    }

    async echoReadable2(readable) {
        //const readline = require('readline');

        const rl = (window as any).electronAPI.readlineCreateInterface({
            input: readable,
            crlfDelay: Infinity // handles \r\n and \n correctly
        });

        for await (const line of rl) {
            if (line.startsWith('###')) {
                this._log$.next(line.slice(3)); // remove "###"
            }
            console.log(line);
        }
    }
}

export interface ConversionConfigJSON {
    inputDirectory: string;
    outputDirectory: string;
    productionBuild: boolean;
    assetsBaseUrl: string;
    entityConfigFile: string;
    mergeBySameMaterial: boolean;
    outputMeshSettingsUrl?: string;
    tmpPath?: string;
    glbMetaDataUrl?: string;
    preventVertexColorDeletionDuringBuild?: boolean;
    preventDracoCompressionDuringBuild?: boolean;
}

export interface ConversionStatus {
    successful: boolean;
    meshSettings: ProductionMeshSettings;
    glbMetaData: GlbMetaData;
}

export interface ProductionMeshSettings {
    [key: string]: MVMeshSetting;
}

export enum ConversionTarget {
    'MOBILE' = 'MOBILE',
    'DESKTOP' = 'DESKTOP'
}
