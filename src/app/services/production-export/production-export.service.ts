import { Injectable } from '@angular/core';
import {
    ActionItemOptionsJSON,
    ActionItemsOptionsJSON,
    MVAnimationMetaData,
    MVCameraShotMetaData,
    MVCameraShotsMetaData,
    MVEntityConfig
} from 'mv-core';
import { Subject } from 'rxjs';
import {
    ConversionTarget,
    ConverterService
} from '../converter/converter.service';
import { ElectronService } from '../electron/electron.service';
import { FileAccessService } from '../file-access/file-access.service';
import { NotifierService } from '../notifier/notifier.service';
import { UserService } from '../user/user.service';

@Injectable({
    providedIn: 'root'
})
export class ProductionExportService {
    private _log$ = new Subject<string>();
    public log$ = this._log$.asObservable();
    private _buildInProgress$ = new Subject<boolean>();
    public buildInProgress$ = this._buildInProgress$.asObservable();
    private _entitiesBuildMetaData: EntityBuildMetaData[] = [];
    private _entities$ = new Subject<EntityBuildMetaData[]>();
    public entities$ = this._entities$.asObservable();
    private _exportDir: string;
    private _assetsBaseUrl: string;
    private _currentlyProcessedEntity: EntityBuildMetaData;
    private _textureConvertionDone = false;

    constructor(
        private electronService: ElectronService,
        private userService: UserService,
        private converterService: ConverterService,
        private fileAccessService: FileAccessService,
        private notifier: NotifierService
    ) {
        this.converterService.log$.subscribe((log: string) => {
            if (this._currentlyProcessedEntity) {
                this._currentlyProcessedEntity.log = log;
                this._entities$.next(this._entitiesBuildMetaData);
            }
        });
    }

    async selectEntityFiles() {
        const openDialogOptions: any = {
            title: 'Open entity files',
            properties: ['multiSelections'],
            filters: [{ name: 'JSON', extensions: ['json'] }]
        };
        const paths = await (window as any).electronAPI.showOpenDialogSync(
            openDialogOptions
        );
        this.setEntities(paths);
    }

    setEntities(paths: string[]) {
        this._entitiesBuildMetaData = [];
        paths.forEach((path) => {
            path = path.replace(/\\/g, '/');
            const root =
                (window as any).electronAPI
                    .path()
                    .dirname(path)
                    .replace(/\\/g, '/') + '/';

            const entityBuildMetaData: EntityBuildMetaData = {
                id: '',
                path: path,
                entityConfig: null,
                status: BuildStatus.NOT_STARTED,
                log: '',
                root: root
            };
            try {
                const entityConfig = (window as any).electronAPI.fsReadJSONSync(
                    path
                );
                entityBuildMetaData.entityConfig = entityConfig;
                entityBuildMetaData.id = entityConfig.id;
                // if (!entityConfig['fbxFilesDirectoryAbsolute'] || entityConfig['fbxFilesDirectoryAbsolute'].length < 1) {
                //   entityBuildMetaData.log = 'fbxFilesDirectoryAbsolute not defined in entity config'
                // } else {
                //   const fbxFilesDirExists = (window as any).electronAPI.fsExistsSync(entityConfig['fbxFilesDirectoryAbsolute']);
                //   if (!fbxFilesDirExists) {
                //     entityBuildMetaData.log = 'fbxFilesDirectoryAbsolute not valid or no access'
                //   }
                // }
            } catch (error) {
                ((entityBuildMetaData.status = BuildStatus.FAILED),
                    (entityBuildMetaData.log = 'Invalid entity config file'));
            }
            this._entitiesBuildMetaData.push(entityBuildMetaData);
            this._entities$.next(this._entitiesBuildMetaData);
        });
    }

    resetEntities() {
        this._textureConvertionDone = false;
        this._entitiesBuildMetaData.forEach((entity) => {
            ((entity.status = BuildStatus.NOT_STARTED), (entity.log = ''));
        });
        this._entities$.next(this._entitiesBuildMetaData);
    }

    formatDate() {
        const d = new Date();

        const pad = (n) => String(n).padStart(2, '0');

        const year = d.getFullYear();
        const month = pad(d.getMonth() + 1); // months are 0-based
        const day = pad(d.getDate());
        const hours = pad(d.getHours());
        const minutes = pad(d.getMinutes());
        const seconds = pad(d.getSeconds());

        return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    }

    async startBuild(convertTextures: boolean): Promise<boolean> {
        this.resetEntities();

        this._log$.next('Build is running');
        this._buildInProgress$.next(true);

        this._assetsBaseUrl =
            (window as any).electronAPI
                .path()
                .dirname(this._entitiesBuildMetaData[0].path) + '/';
        var now = this.formatDate();
        // Directory all production assets are exported to
        this._exportDir = `${this._assetsBaseUrl}/_EXPORT_/${now}/`;

        for (let entityBuildMetaData of this._entitiesBuildMetaData) {
            this._currentlyProcessedEntity = entityBuildMetaData;
            entityBuildMetaData.status = BuildStatus.IN_PROGRESS;
            this._entities$.next(this._entitiesBuildMetaData);

            try {
                entityBuildMetaData.log = 'Combining JSON files';
                this._entities$.next(this._entitiesBuildMetaData);
                let combinedFile =
                    await this.combineJsonFilesOfEntity(entityBuildMetaData);
                this.copyActionItems(entityBuildMetaData);
                this.copyRigAndAnimations(entityBuildMetaData);

                entityBuildMetaData.log = 'Converting production meshes';
                this._entities$.next(this._entitiesBuildMetaData);

                combinedFile = await this.exportProductionMeshes(
                    entityBuildMetaData,
                    combinedFile
                );

                this.writeExportFile(entityBuildMetaData, combinedFile);

                if (convertTextures) {
                    entityBuildMetaData.log = 'Converting production textures';
                    // this._entities$.next(this._entitiesBuildMetaData);
                    await this.exportProductionTextures(entityBuildMetaData);
                }

                entityBuildMetaData.status = BuildStatus.SUCCESS;
                entityBuildMetaData.log = 'Build successful';
                this._entities$.next(this._entitiesBuildMetaData);
            } catch (error) {
                console.error(error);
                entityBuildMetaData.status = BuildStatus.FAILED;
                entityBuildMetaData.log = 'Error ' + entityBuildMetaData.log;
                this._entities$.next(this._entitiesBuildMetaData);
            }

            this._entities$.next(this._entitiesBuildMetaData);
        }

        // Copy core production settings
        const coreProductionSettingsFileName = 'core-settings-production.json';
        const coreProductionSettingPath =
            this._assetsBaseUrl + coreProductionSettingsFileName;
        if (
            (window as any).electronAPI.fsExistsSync(coreProductionSettingPath)
        ) {
            (window as any).electronAPI.fsCopyFileSync(
                coreProductionSettingPath,
                this._exportDir + coreProductionSettingsFileName
            );
        }

        this._buildInProgress$.next(false);
        return true;
    }

    /**
     *
     * @param entity
     * @param combinedJsonFile
     */
    async exportProductionMeshes(
        entity: EntityBuildMetaData,
        combinedJsonFile: any
    ): Promise<any> {
        const fbxFilesDirectoryAbsolute =
            entity.entityConfig['fbxFilesDirectoryAbsolute'];
        // if (fbxFilesDirectoryAbsolute && fbxFilesDirectoryAbsolute.length > 0) {

        const entityConfigFileName = (window as any).electronAPI
            .path()
            .basename(entity.path);
        const inputDirectory =
            this._assetsBaseUrl + entity.entityConfig.meshesUrlRelative;
        const outputDirectory =
            this._exportDir + entity.entityConfig.meshesUrlRelative;
        const outputMeshSettingsUrl =
            this._exportDir + entity.entityConfig.meshSettingsRelative;
        const glbMetaDataUrl =
            this._assetsBaseUrl +
            entity.entityConfig.meshesUrlRelative +
            '/glbFileMetaData.json';

        (window as any).electronAPI.fsEnsureDirSync(outputDirectory);

        const conversionStatus = await this.converterService.runGlbConversion({
            assetsBaseUrl: this._assetsBaseUrl,
            entityConfigFile: entityConfigFileName,
            inputDirectory: inputDirectory,
            mergeBySameMaterial: true,
            outputDirectory: outputDirectory,
            productionBuild: true,
            outputMeshSettingsUrl: outputMeshSettingsUrl,
            glbMetaDataUrl: glbMetaDataUrl,
            preventDracoCompressionDuringBuild:
                entity.entityConfig.preventDracoCompressionDuringBuild,
            preventVertexColorDeletionDuringBuild:
                entity.entityConfig.preventVertexColorDeletionDuringBuild
        });

        combinedJsonFile['productionMeshSettings'] =
            conversionStatus.meshSettings;
        combinedJsonFile['glbMetaData'] = conversionStatus.glbMetaData;

        // await this.copyRemainingGlbFiles(entity);

        this.updateGlbFileRegistry(entity);

        // } else {
        //   entity.log = 'Copying meshes';
        //   this._entities$.next(this._entitiesBuildMetaData);
        //   const inputDirectory = this._assetsBaseUrl + entity.entityConfig.meshesUrlRelative;
        //   const outputDirectory = this._exportDir + entity.entityConfig.meshesUrlRelative;
        //   (window as any).electronAPI.fsCopySync(inputDirectory, outputDirectory);
        // }

        return combinedJsonFile;
    }

    async copyRemainingGlbFiles(entity: EntityBuildMetaData) {
        entity.log = 'Copying remaining glb files';
        this._entities$.next(this._entitiesBuildMetaData);

        const glbFileNames = (window as any).electronAPI
            .fsReaddirSync(
                this._assetsBaseUrl + entity.entityConfig.meshesUrlRelative
            )
            .filter((fileName) => fileName.endsWith('.glb'))
            .map((fileName) => fileName.replace('.glb', ''));

        const fbxFileNames = (window as any).electronAPI
            .fsReaddirSync(entity.entityConfig['fbxFilesDirectoryAbsolute'])
            .filter((fileName) => fileName.endsWith('.fbx'))
            .map((fileName) => fileName.replace('.fbx', ''));

        glbFileNames.forEach((glbFileName) => {
            const fileExistsInFbxDirectory = fbxFileNames.includes(glbFileName);
            if (!fileExistsInFbxDirectory) {
                const fullFilePath =
                    this._assetsBaseUrl +
                    entity.entityConfig.meshesUrlRelative +
                    '/' +
                    glbFileName +
                    '.glb';
                let fullOutputFilePath =
                    this._exportDir +
                    entity.entityConfig.meshesUrlRelative +
                    '/' +
                    glbFileName +
                    '.glb';
                const fileExistsInOutputDir = (
                    window as any
                ).electronAPI.fsExistsSync(fullOutputFilePath);
                if (fileExistsInOutputDir) {
                    fullOutputFilePath =
                        this._exportDir +
                        entity.entityConfig.meshesUrlRelative +
                        '/' +
                        glbFileName +
                        '_part_1' +
                        '.glb';
                }
                (window as any).electronAPI.fsCopyFileSync(
                    fullFilePath,
                    fullOutputFilePath
                );
                console.log('Copied file: ' + glbFileName);
            }
        });
    }

    async exportProductionTextures(entityBuildMetaData: EntityBuildMetaData) {
        // copy non mobile textures
        const texturesUrlRelative =
            entityBuildMetaData.entityConfig.texturesUrlRelative;

        if (texturesUrlRelative && !this._textureConvertionDone) {
            // await this.converterService.runTextureConversion(
            //   entityBuildMetaData.root + texturesUrlRelative,
            //   this._exportDir + texturesUrlRelative,
            //   ConversionTarget.DESKTOP
            // );
            (window as any).electronAPI.fsCopySync(
                this._assetsBaseUrl + texturesUrlRelative,
                this._exportDir + texturesUrlRelative,
                {
                    recursive: true
                }
            );
        }

        // convert mobile textures
        const mobileTexturesUrlRelative =
            entityBuildMetaData.entityConfig.mobileTexturesUrlRelative;

        if (mobileTexturesUrlRelative && !this._textureConvertionDone) {
            await this.converterService.runTextureConversion(
                entityBuildMetaData.root + texturesUrlRelative,
                this._exportDir + mobileTexturesUrlRelative,
                ConversionTarget.MOBILE
            );
        }

        this._textureConvertionDone = true;
    }

    updateGlbFileRegistry(entity: EntityBuildMetaData) {
        const meshesUrl = (window as any).electronAPI
            .path()
            .join(this._assetsBaseUrl, entity.entityConfig.meshesUrlRelative);
        const glbRegistryPath = (window as any).electronAPI
            .path()
            .join(meshesUrl, '/glbFileRegistry.json');
        const allFileNames = (window as any).electronAPI
            .fsReaddirSync(meshesUrl)
            .toString();
        if ((window as any).electronAPI.fsExistsSync(glbRegistryPath)) {
            this.fileAccessService.setReadAndWritePermissions(glbRegistryPath);
        }
        (window as any).electronAPI.fsWriteFileSync(
            glbRegistryPath,
            allFileNames
        );
        this.fileAccessService.setReadAndWritePermissions(glbRegistryPath);
    }

    async writeExportFile(
        entity: EntityBuildMetaData,
        combinedEntityConfig: any
    ) {
        (window as any).electronAPI.fsEnsureDirSync(`${this._exportDir}`);
        (window as any).electronAPI.fsWriteJSONSync(
            `${this._exportDir}/mv_${entity.id}.json`,
            combinedEntityConfig
        );
    }

    public async combineCameraShots(
        cameraShotsMetaData: MVCameraShotsMetaData,
        entityBaseUrl: string
    ): Promise<MVCameraShotsMetaData> {
        const cameraShotsMetaDataCopy = { ...cameraShotsMetaData };

        if (!cameraShotsMetaData) return {};

        entityBaseUrl = entityBaseUrl.replace('file://', '');

        if (cameraShotsMetaDataCopy) {
            for (let cameraShotId of Object.keys(cameraShotsMetaDataCopy)) {
                const cameraShotMetaData: MVCameraShotMetaData =
                    cameraShotsMetaDataCopy[cameraShotId];
                cameraShotMetaData.id = cameraShotId;

                if (cameraShotMetaData.urlRelative) {
                    const url = entityBaseUrl + cameraShotMetaData.urlRelative;
                    try {
                        const cameraSettings = (
                            window as any
                        ).electronAPI.fsReadJSONSync(url);
                        cameraShotMetaData['cameraShotSettings'] =
                            cameraSettings;
                    } catch (error) {
                        const errorMessage = `Camera shot JSON ${url} not found for camera shot ${cameraShotId}`;
                        console.error(errorMessage);
                        this.notifier.notify('error', errorMessage);
                    }
                }

                if (cameraShotMetaData.mobileUrlRelative) {
                    const url =
                        entityBaseUrl + cameraShotMetaData.mobileUrlRelative;
                    try {
                        const cameraSettings = (
                            window as any
                        ).electronAPI.fsReadJSONSync(url);
                        cameraShotMetaData['cameraShotSettingsMobile'] =
                            cameraSettings;
                    } catch (error) {
                        const errorMessage = `Camera shot JSON ${url} not found for camera shot ${cameraShotId}`;
                        console.error(errorMessage);
                        this.notifier.notify('error', errorMessage);
                    }
                }
            }
        }

        return cameraShotsMetaData;
    }

    public async combineJsonFilesOfEntity(
        entityBuildMetaData: EntityBuildMetaData
    ) {
        const root = entityBuildMetaData.root;

        const entityConfig: MVEntityConfig = entityBuildMetaData.entityConfig;

        if (entityConfig.cameraShots) {
            entityConfig.cameraShots = await this.combineCameraShots(
                entityConfig.cameraShots,
                root
            );
        }

        // const cameraShotUrlsRelative = entityConfig.cameraShotUrlsRelative;
        // const cameraShots = cameraShotUrlsRelative.filter(p => (window as any).electronAPI.fsExistsSync(root + p)).map(p => {
        //     // TODO copy camera animation glb files
        //     const cc = (window as any).electronAPI.fsReadJSONSync(root + p);
        //     const id = p.split('/').pop().replace('.json', '');
        //     cc.id = id;
        //     return cc
        // });
        // delete entity.cameraShotUrlsRelative;
        // entityConfig.cameraShotsArr = cameraShots;

        const meshSettingsRelative = entityConfig.meshSettingsRelative;
        if (!!meshSettingsRelative) {
            const meshSettings = (window as any).electronAPI.fsReadJSONSync(
                root + meshSettingsRelative
            );
            // delete entity.meshSettingsRelative;
            entityConfig.meshSettings = meshSettings;
        }
        const productionMeshSettingsRelative =
            entityConfig.productionMeshSettingsRelative;
        if (!!productionMeshSettingsRelative) {
            const productionMeshSettings = (
                window as any
            ).electronAPI.fsReadJSONSync(root + productionMeshSettingsRelative);
            // delete entity.productionMeshSettingsRelative;
            entityConfig.productionMeshSettings = productionMeshSettings;
        }
        const ruleEngineConfigUrlRelative =
            entityConfig.ruleEngineConfigUrlRelative;
        if (!!ruleEngineConfigUrlRelative) {
            if (
                (window as any).electronAPI.fsExistsSync(
                    root + ruleEngineConfigUrlRelative
                )
            ) {
                const ruleEngineConfig = (
                    window as any
                ).electronAPI.fsReadJSONSync(
                    root + ruleEngineConfigUrlRelative
                );
                // delete entity.ruleEngineConfigUrlRelative;
                entityConfig.ruleEngineConfig = ruleEngineConfig;
            }
        }

        const materialMappingsUrlRelative =
            entityConfig.materialMappingsUrlRelative;
        if (!!materialMappingsUrlRelative) {
            const materialMappings = (window as any).electronAPI.fsReadJSONSync(
                root + materialMappingsUrlRelative
            );
            // delete entity.materialMappingsUrlRelative;

            entityConfig.materials = {};
            //Material mappings assemble
            materialMappings.materialAllocators =
                materialMappings.materialAllocators.map((p) => {
                    const materialPath = `${entityConfig.materialsUrlRelative}${p.mapping}`;

                    if (materialPath.includes('.glb')) {
                        return p; // skip this iteration
                    }

                    let material = entityConfig.materials[materialPath];
                    if (
                        !material &&
                        (window as any).electronAPI.fsExistsSync(
                            root + materialPath
                        )
                    ) {
                        material = (window as any).electronAPI.fsReadJSONSync(
                            root + materialPath
                        );
                        entityConfig.materials[materialPath] = material;
                    }
                    p.mapping = materialPath;
                    return p;
                });

            materialMappings.switchMaterials =
                materialMappings.switchMaterials.map((p) => {
                    p.slots = p.slots.map((p) => {
                        if (p.mapping) {
                            try {
                                const materialPath = `${entityConfig.materialsUrlRelative}${p.mapping}`;

                                let material =
                                    entityConfig.materials[materialPath];
                                if (!material) {
                                    material = (
                                        window as any
                                    ).electronAPI.fsReadJSONSync(
                                        root + materialPath
                                    );
                                    entityConfig.materials[materialPath] =
                                        material;
                                }
                                p.mapping = materialPath;
                            } catch (error) {
                                p.mapping = 'missing file';
                            }
                        }
                        return p;
                    });

                    return p;
                });

            if (
                entityBuildMetaData.entityConfig.defaultNodeMaterialUrlRelative
            ) {
                const materialPath =
                    entityConfig.materialsUrlRelative +
                    entityBuildMetaData.entityConfig
                        ?.defaultNodeMaterialUrlRelative;
                try {
                    const defaultNodeMaterial = (
                        window as any
                    ).electronAPI.fsReadJSONSync(root + materialPath);
                    entityConfig.materials[materialPath] = defaultNodeMaterial;
                } catch (error) {
                    console.error(`Failed to load ${root + materialPath}`);
                }
            }

            entityConfig.materialMappings = materialMappings;
        }

        const lightmapTexturesUrlRelative =
            entityConfig.lightmapTexturesUrlRelative;
        if (!!lightmapTexturesUrlRelative) {
            const lightmapTextures = (window as any).electronAPI.fsReadJSONSync(
                root + lightmapTexturesUrlRelative + 'registry.json'
            );
            // delete entity.lightmapTexturesUrlRelative;
            entityConfig.lightmapTextures =
                lightmapTextures && lightmapTextures.files;

            const mobileLightmapTexturesUrlRelative =
                entityConfig.mobileLightmapTexturesUrlRelative;
            if (!!mobileLightmapTexturesUrlRelative) {
                entityConfig.mobileLightmapTextures =
                    lightmapTextures && lightmapTextures.files;
            }
        }
        // const mobileLightmapTexturesUrlRelative = entityConfig.mobileLightmapTexturesUrlRelative;
        // if (!!mobileLightmapTexturesUrlRelative) {
        //     const mobileLightmapTextures = (window as any).electronAPI.fsReadJSONSync(root + mobileLightmapTexturesUrlRelative + 'registry.json');
        //     // delete entity.mobileLightmapTexturesUrlRelative;
        //     entityConfig.mobileLightmapTextures = mobileLightmapTextures && mobileLightmapTextures.files;
        // }

        const environmentConfigRelative =
            entityConfig.environmentConfigRelative;
        if (!!environmentConfigRelative) {
            const environmentConfig = (
                window as any
            ).electronAPI.fsReadJSONSync(root + environmentConfigRelative);
            // delete entity.environmentConfigRelative;
            entityConfig.environmentConfig = environmentConfig;
        }

        //removed BRDFTexture
        for (const key in entityConfig.materials) {
            if (entityConfig.materials.hasOwnProperty(key)) {
                const mm = entityConfig.materials[key];
                delete mm._imageProcessingConfiguration;
                delete mm.environmentBRDFTexture;
            }
        }

        return entityConfig;
    }

    private copyActionItems(entityBuildMetaData: EntityBuildMetaData) {
        const root = entityBuildMetaData.root;
        const entityConfig: any = entityBuildMetaData.entityConfig;

        const actionItemUrl = root + entityConfig.actionItemUrlRelative;
        const actionItemUrlExport =
            this._exportDir + entityConfig.actionItemUrlRelative;

        if (
            entityConfig.actionItemUrlRelative &&
            (window as any).electronAPI.fsExistsSync(actionItemUrl) &&
            !(window as any).electronAPI.fsExistsSync(actionItemUrlExport)
        ) {
            (window as any).electronAPI.fsCopySync(
                actionItemUrl,
                actionItemUrlExport,
                {}
            );

            const actionItemOptions: ActionItemsOptionsJSON = (
                window as any
            ).electronAPI.fsReadJSONSync(actionItemUrl);
            // delete entity.actionItemUrlRelative;
            entityConfig.actionItems = actionItemOptions;

            const defaultMaterialUrl =
                root +
                actionItemOptions.materialsUrlRelative +
                actionItemOptions.defaultMaterial;
            const defaultMaterialUrlExport =
                this._exportDir +
                actionItemOptions.materialsUrlRelative +
                actionItemOptions.defaultMaterial;

            const animationsUrl =
                root + actionItemOptions.animationsUrlRelative;
            const animationsUrlExport =
                this._exportDir + actionItemOptions.animationsUrlRelative;

            if (
                actionItemOptions.defaultMaterial &&
                !(window as any).electronAPI.fsExistsSync(
                    defaultMaterialUrlExport
                )
            ) {
                (window as any).electronAPI.fsCopySync(
                    defaultMaterialUrl,
                    defaultMaterialUrlExport,
                    {}
                );
            }

            const actionItemTexturesUrl =
                root + actionItemOptions.texturesUrlRelative;
            const actionItemTexturesUrlExport =
                this._exportDir + actionItemOptions.texturesUrlRelative;
            if (
                actionItemOptions.texturesUrlRelative &&
                !(window as any).electronAPI.fsExistsSync(
                    actionItemTexturesUrlExport
                )
            ) {
                (window as any).electronAPI.fsCopySync(
                    actionItemTexturesUrl,
                    actionItemTexturesUrlExport,
                    {
                        recursive: true
                    }
                );
            }

            actionItemOptions.actionItems.forEach(
                (actionItemOption: ActionItemOptionsJSON) => {
                    const materialUrl =
                        root +
                        actionItemOptions.materialsUrlRelative +
                        actionItemOption.material;
                    const materialUrlExport =
                        this._exportDir +
                        actionItemOptions.materialsUrlRelative +
                        actionItemOption.material;

                    if (
                        actionItemOption.material &&
                        !(window as any).electronAPI.fsExistsSync(
                            materialUrlExport
                        )
                    ) {
                        (window as any).electronAPI.fsCopySync(
                            materialUrl,
                            materialUrlExport,
                            {}
                        );
                    }

                    if (animationsUrl && actionItemOption.animation) {
                        (window as any).electronAPI.fsCopySync(
                            animationsUrl + actionItemOption.animation,
                            animationsUrlExport + actionItemOption.animation,
                            {}
                        );
                    }
                }
            );
        }
    }

    private copyRigAndAnimations(entityBuildMetaData: EntityBuildMetaData) {
        const entityConfig = entityBuildMetaData.entityConfig;
        const root = entityBuildMetaData.root;

        // copy rig
        if (entityConfig.rigUrlRelative) {
            (window as any).electronAPI.fsCopySync(
                root + entityConfig.rigUrlRelative,
                this._exportDir + entityConfig.rigUrlRelative,
                {}
            );
        }

        // copy animations
        entityConfig.animations?.forEach((animation: MVAnimationMetaData) => {
            (window as any).electronAPI.fsCopySync(
                root + animation.fileUrl,
                this._exportDir + animation.fileUrl,
                {}
            );
        });
    }
}

export enum BuildStatus {
    'NOT_STARTED' = 'NOT_STARTED',
    'IN_PROGRESS' = 'IN_PROGRESS',
    'SUCCESS' = 'SUCCESS',
    'FAILED' = 'FAILED'
}

export interface EntityBuildMetaData {
    id: string;
    path: string;
    entityConfig: MVEntityConfig;
    status: BuildStatus;
    log: string;
    root: string;
}
