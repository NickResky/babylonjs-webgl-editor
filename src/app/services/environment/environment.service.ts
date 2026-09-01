import { Injectable } from '@angular/core';
import { CubeTexture, Light, Scene } from 'babylonjs';
import {
    Core,
    MVEntityConfig,
    MVEnvironmentConfig,
    MVEnvironmentConfigs,
    MVEnvironmentEntity
} from 'mv-core';
import { BehaviorSubject } from 'rxjs';
import { Mappers } from '../../mappers';
import { CameraService } from '../camera/camera.service';
import { DataService, ProjectSettings } from '../data/data.service';
import { ElectronService } from '../electron/electron.service';
import { EntityService } from '../entity/entity.service';
import {
    FileAccessService,
    FileType
} from '../file-access/file-access.service';
import { NotifierService } from '../notifier/notifier.service';
import { ProductionExportService } from './../production-export/production-export.service';

@Injectable({
    providedIn: 'root'
})
export class EnvironmentService {
    private _core: Core;
    private _baseURL: string;
    private _productEntityConfig: MVEntityConfig;
    private _entityBaseUrl: string;
    private _selectedEnvironmentConfigurationCode: string;
    private _selectedEnvironmentConfigurationCode$ =
        new BehaviorSubject<string>(null);
    public selectedEnvironmentConfigurationCode$ =
        this._selectedEnvironmentConfigurationCode$.asObservable();
    private _selectedEnvironmentEntity$ =
        new BehaviorSubject<MVEnvironmentEntity>(null);
    private _selectedEnvironmentEntity: MVEnvironmentEntity;
    public selectedEnvironmentEntity$ =
        this._selectedEnvironmentEntity$.asObservable();
    public selectedEnvironmentUrl: string;

    constructor(
        private fileService: FileAccessService,
        private notifier: NotifierService,
        private entityService: EntityService,
        private electronService: ElectronService,
        private dataService: DataService,
        private cameraService: CameraService,
        private productionExportService: ProductionExportService
    ) {
        this.dataService.projectSettings$.subscribe(
            (projectSettings: ProjectSettings) => {
                this._baseURL = projectSettings.baseProjectUrl;
            }
        );

        this.cameraService.activeCameraShotCategory$.subscribe(
            (activeCameraShotCategory: string) => {
                this.selectEnvironmentConfig(activeCameraShotCategory);
            }
        );
    }

    /**
     * Sets up the service. This function has to be called before the other service functions can be used.
     * @param {Core} core
     */
    public setup(core: Core) {
        this._core = core;
    }

    public async onEnvironmentSavedClicked(
        basePath: string,
        scene: Scene,
        backgroundImageName?: string
    ): Promise<MVEnvironmentConfigs> {
        if (!Mappers.ENVIRONMENT) {
            throw new Error(`Missing payload mapper.`);
        }

        await this.updateEnvironmentEntityWithLights(scene);

        const environmentSetting: MVEnvironmentConfig = new Mappers.ENVIRONMENT(
            scene,
            backgroundImageName && backgroundImageName.length > 0
                ? backgroundImageName
                : null
        ).toJSON();
        const environmentSettings: MVEnvironmentConfigs =
            await this.updateEnvironmentFile(basePath, environmentSetting);

        this.notifier.notify(
            'success',
            `Environment ${this._selectedEnvironmentEntity.entityConfig.environmentConfigRelative} saved`
        );
        return environmentSettings;
    }

    private async updateEnvironmentEntityWithLights(scene) {
        const lights = this.getSceneLights(scene);

        const environmentEntityConfig =
            this._selectedEnvironmentEntity.entityConfig;

        if (!environmentEntityConfig.lights) {
            environmentEntityConfig.lights = {};
        }

        environmentEntityConfig.lights[
            this._selectedEnvironmentConfigurationCode
        ] = [];

        lights.map((light) => {
            environmentEntityConfig.lights[
                this._selectedEnvironmentConfigurationCode
            ].push(light);
        });

        await this.fileService.updateFile(
            this._entityBaseUrl.replace('file://', ''),
            this.selectedEnvironmentUrl.replace('.json', ''),
            FileType.JSON,
            JSON.stringify(environmentEntityConfig, null, 2)
        );
    }

    private getSceneLights(scene: Scene): Array<Light> {
        const lights = [];

        scene.lights.map((light) => {
            lights.push(scene.getLightByUniqueID(light.uniqueId).serialize());
        });

        return lights;
    }

    private async removeLightsFromScene() {
        // const scene = this._core.getScene();
        // const lightsCount = scene.lights.length;
        // // clean up lights
        // if (lightsCount) {
        //   for (let i = 0; i < lightsCount; i++) {
        //     scene.lights[i].dispose();
        //   }
        // }
    }

    public async updateEnvironmentFile(
        basePath: string,
        environment: MVEnvironmentConfig
    ): Promise<MVEnvironmentConfigs> {
        const environenmentConfigUrl =
            this._selectedEnvironmentEntity.entityConfig
                .environmentConfigRelative;
        const fileName = environenmentConfigUrl.slice(
            environenmentConfigUrl.lastIndexOf('/') + 1
        );
        const newPath =
            basePath.replace('file://', '') +
            environenmentConfigUrl.replace(fileName, '');

        const environmentConfigs: MVEnvironmentConfigs = JSON.parse(
            await this.fileService.getFile(
                newPath,
                fileName.replace('.json', ''),
                FileType.JSON
            )
        );
        environmentConfigs[this._selectedEnvironmentConfigurationCode] =
            environment;

        await this.fileService.updateFile(
            newPath,
            fileName.replace('.json', ''),
            FileType.JSON,
            JSON.stringify(environmentConfigs, null, 2)
        );
        return environmentConfigs;
    }

    public selectEnvironmentConfig(environmentConfigCode: string) {
        this._selectedEnvironmentConfigurationCode = environmentConfigCode;
        this._selectedEnvironmentConfigurationCode$.next(
            this._selectedEnvironmentConfigurationCode
        );
    }

    public async updateEnvironmentConfig(): Promise<void> {
        await this._core.Environment.updateConfiguration(
            this._selectedEnvironmentEntity.uuid,
            [this._selectedEnvironmentConfigurationCode]
        );
        await this.removeLightsFromScene();
        this._selectedEnvironmentEntity$.next(this._selectedEnvironmentEntity);
    }

    public async loadDefaultEnvironment(
        entityBaseUrl: string,
        productEntityConfig: MVEntityConfig
    ): Promise<MVEnvironmentEntity | void> {
        this._productEntityConfig = productEntityConfig;
        this._entityBaseUrl = entityBaseUrl;

        const environmentUrls = this.getEnvironmentUrls();
        if (environmentUrls && environmentUrls.length > 0) {
            return this.selectEnvironment(environmentUrls[0], false);
        }
    }

    public async selectEnvironment(
        environmentUrl: string,
        stopRender: boolean
    ): Promise<MVEnvironmentEntity> {
        this.dataService.setLoading(true);
        await this._core.stopRender(stopRender);
        await this.removeLightsFromScene();
        const previousEnvironmentEntityConfig =
            this._selectedEnvironmentEntity?.entityConfig;
        const environmentCategory = this._selectedEnvironmentConfigurationCode
            ? this._selectedEnvironmentConfigurationCode
            : this.cameraService.activeCameraShotCategory;

        const environmentEntityConfig: MVEntityConfig = (
            window as any
        ).electronAPI.fsReadJSONSync(
            this._baseURL.replace('file://', '') + environmentUrl
        );

        await this.entityService.updateGlbFileRegistryJSON(
            environmentEntityConfig
        );

        console.log(
            `Combining JSON files of entity ${environmentUrl.replace('file://', '')} ...`
        );

        const combinedEntityConfig: MVEntityConfig =
            await this.productionExportService.combineJsonFilesOfEntity({
                entityConfig: environmentEntityConfig,
                id: environmentEntityConfig.id,
                path: this._baseURL.replace('file://', '') + environmentUrl,
                root: this._baseURL.replace('file://', ''),
                log: '',
                status: null
            });
        const combinedEntityConfigString =
            'data:' + JSON.stringify(combinedEntityConfig);

        console.log(
            `Loading entity ${environmentUrl.replace('file://', '')} ...`
        );

        const loadEnvironmentPromise = this._core.Environment.loadEnvironment(
            combinedEntityConfigString,
            environmentCategory,
            this._entityBaseUrl
        );

        const updateEnvironmentConfigForProductPromise =
            this.entityService.updateEnvironmentConfigurationForProduct(
                previousEnvironmentEntityConfig?.id,
                combinedEntityConfig.id
            );

        const [environmentEntity, productEntity] = await Promise.all([
            loadEnvironmentPromise,
            updateEnvironmentConfigForProductPromise
        ]);

        this._selectedEnvironmentEntity = environmentEntity;
        this._selectedEnvironmentConfigurationCode = environmentCategory;
        this.selectedEnvironmentUrl = environmentUrl;
        this.entityService.addEntity(this._selectedEnvironmentEntity);

        const activeEntity = this.entityService.getActiveEntity();
        if (activeEntity) {
            this.dataService.setLoading(false);
            await this._core.startRender({
                fadeOutPreviousFrame: true
            });
        }
        this._selectedEnvironmentEntity$.next(this._selectedEnvironmentEntity);
        return this._selectedEnvironmentEntity;
    }

    public async refreshEnvironment(
        environmentSettings: MVEnvironmentConfigs
    ): Promise<void> {
        this._selectedEnvironmentEntity.environmentSceneSettings =
            environmentSettings;
        await this.removeLightsFromScene();
        await this._core.Environment.updateConfiguration(
            this._selectedEnvironmentEntity.uuid,
            [this._selectedEnvironmentConfigurationCode]
        );
        this._selectedEnvironmentEntity$.next(this._selectedEnvironmentEntity);
        this._selectedEnvironmentConfigurationCode$.next(
            this._selectedEnvironmentConfigurationCode
        );
    }

    public getEnvironmentUrls(): Array<string> {
        return this._productEntityConfig.environmentEntityUrlsRelative
            ? this._productEntityConfig.environmentEntityUrlsRelative
            : [];
    }

    public getCurrentEnvironmentUrl(): string {
        return this.selectedEnvironmentUrl;
    }

    public getSelectedEnvironmentEntity(): MVEnvironmentEntity {
        return this._selectedEnvironmentEntity;
    }

    public getSelectedEnvironmentConfigurationCode(): string {
        return this._selectedEnvironmentConfigurationCode;
    }

    public async updateEnvironmentTexture(
        filePath: string,
        fileName: string
    ): Promise<void> {
        const newEnviromentTexture = new CubeTexture(
            filePath + fileName,
            this._core.getScene()
        );
        const baseUrl = this._baseURL.replace('file://', '');
        let relativeUrl = filePath.replace(baseUrl, '') + fileName;
        relativeUrl = relativeUrl.replace(
            this._selectedEnvironmentEntity.entityConfig.texturesUrlRelative,
            ''
        );
        newEnviromentTexture.url = relativeUrl;
        newEnviromentTexture.name = relativeUrl;
        this._core.getScene().environmentTexture = newEnviromentTexture;
        // const environmentSettings = new Mappers.ENVIRONMENT(this._core.getScene()).toJSON();
        // this.updateEnvironmentFile(baseUrl, environmentSettings);
    }

    public async setEnvironmentEntityConfig(
        relativeUrl
    ): Promise<MVEntityConfig> {
        const baseUrl = this._baseURL.replace('file://', '');
        this._productEntityConfig = await (
            window as any
        ).electronAPI.fsReadJSONSync(baseUrl + relativeUrl);
        return this._productEntityConfig;
    }

    /**
     * Checks if the given mesh file belongs to the selected environment.
     *
     * @param {string} meshFileName - The name of the mesh file.
     */
    public async isMeshFilePartOfSelectedEnvironment(
        meshFileName: string
    ): Promise<boolean> {
        const fullPath =
            this._entityBaseUrl.replace('file://', '') +
            this._selectedEnvironmentEntity.entityConfig.meshesUrlRelative;
        const filesInMeshDirectory: string[] =
            await this.fileService.getFilesInDirectory(fullPath);

        return filesInMeshDirectory.includes(meshFileName);
    }
}
