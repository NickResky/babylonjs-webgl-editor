import { Scene } from 'babylonjs';
import { inject, injectable } from 'inversify';
import { Subject } from 'rxjs';
import { MVEventTypes } from '../globals/mv-event-types';
import { QueueAsync } from '../globals/queue-async.decorator';
import { loadJson } from '../helper';
import { TYPES } from '../ioc/types';
import { MVLogger } from '../logging';
import { MVEntityConfig } from '../models/entity/interfaces';
import { MVEntity } from '../models/entity/mv-entity';
import { CameraService, ConfigurationService } from '../services';
import { EntityService } from '../services/entity.service';
import { EventDispatcherService } from '../services/event-dispatcher.service';
import { MVSceneOptimizerService } from '../services/mv-scene-optimizer.service';
import { PlatformService } from '../services/platform.service';
import { CoreSettings } from '../settings';

/**
 * The ProductController is responsible for loading, updating and removing ProductEntities
 */
@injectable()
export class ProductController {
    public onLoadingProgressUpdate$: Subject<number> = new Subject<number>();

    /**
     * Creates a new ProductController
     */
    constructor(
        @inject(TYPES.ConfigurationService)
        private _configurationService: ConfigurationService,
        @inject(TYPES.EntityService) private _entityService: EntityService,
        @inject(TYPES.EventDispatcherService)
        private _eventDispatcherService: EventDispatcherService,
        @inject(TYPES.CameraService) private _cameraService: CameraService,
        @inject(TYPES.PlatformService) private _platform: PlatformService,
        @inject(TYPES.MVSceneOptimizerService)
        private _sceneOptimizerService: MVSceneOptimizerService,
        @inject(TYPES.Scene) private _scene: Scene,
        @inject(TYPES.CoreSettings) private _settings: CoreSettings
    ) {}

    /**
     * Load a product into the scene. TODO: should not return MVENtity
     * @param relativeEntityConfigUrlOrEntityConfig - Either the relative config Url of the product or the EntityConfig as string, beginning with 'data:' -
     * @param defaultConfigurationCodes -
     * @param baseUrl - Only needs to be provided if it differs from the base url that was provided for initializing the core. -
     *
     */
    @QueueAsync()
    public async loadProduct(
        relativeEntityConfigUrlOrEntityConfig: string,
        defaultConfigurationCodes?: string[],
        baseUrl?: string,
        preventSceneFreezing?: boolean
    ): Promise<MVEntity> {
        const loadingStartTimeInMs = Date.now();

        this._entityService._productUpdateInProgress = true;

        if (this._settings.productionMode) {
            this._sceneOptimizerService.freezeHardwareScalingLevel();
            this._sceneOptimizerService.resetHardwareScalingLevel();
            this._scene.unfreezeActiveMeshes();
            this._entityService.unfreezeMaterials();
        }

        const entityBaseUrl = baseUrl ? baseUrl : this._settings.assetsBaseUrl;

        // Load the EntityConfig either by loading via JSON or by parsing the data input
        let entityConfig: MVEntityConfig;
        if (relativeEntityConfigUrlOrEntityConfig.includes('data:')) {
            console.log('############ PROD ############');
            console.log(
                relativeEntityConfigUrlOrEntityConfig.split('data:')[1]
            );
            console.log('############ PROD ############');
            entityConfig = JSON.parse(
                relativeEntityConfigUrlOrEntityConfig.split('data:')[1]
            );
        } else {
            entityConfig = await loadJson<MVEntityConfig>(
                entityBaseUrl + relativeEntityConfigUrlOrEntityConfig
            );
        }

        // Meshes and the rule engine config are loaded relative to the entity config file.
        // Therefore we need to save the base url of the entity config file (url without file name).
        entityConfig.entityConfigBaseUrl = entityBaseUrl;

        if (entityConfig.postProcessingConfiguration) {
            this._sceneOptimizerService.setupPostProcess(
                entityConfig.postProcessingConfiguration
            );
        }

        // Create new Entity and add it to the EntityService
        let entity: MVEntity = await this._entityService.addProduct(
            entityConfig,
            entityConfig.id,
            this.onLoadingProgressUpdate$
        );

        // Init entity
        await this._entityService.loadConfigs(entity);

        this._cameraService.mv_addCameraShotsFromEntity(entity);

        // Apply start configuration to entity
        const configurationLoadingStartTimeInMs = Date.now();

        const updateConfigurationPromise =
            this._configurationService.updateConfiguration(
                entity,
                defaultConfigurationCodes ? defaultConfigurationCodes : []
            );

        const loadNonConfigurableLayerWithoutUncompressingPromise =
            this._entityService.loadNonConfigurableLayerWithoutUncompressing(
                entity
            );

        const loadRigPromise = this._entityService.loadRig(entity);

        await Promise.all([loadRigPromise, updateConfigurationPromise]);

        const configurationLoadingTimeInS =
            (Date.now() - configurationLoadingStartTimeInMs) / 1000;
        MVLogger.debug(
            `ProductController: Configuration loading time in seconds: ${configurationLoadingTimeInS}`
        );

        const setupAnimationsPromise =
            this._entityService.setupAnimations(entity);

        await loadNonConfigurableLayerWithoutUncompressingPromise; // TODO disable?

        const layerLoadingStartTimeInMs = Date.now();

        const applyLayerConfigurationPromise =
            this._entityService.applyLayerConfiguration(entity);
        await Promise.all([applyLayerConfigurationPromise]);

        const layerLoadingTimeInS =
            (Date.now() - layerLoadingStartTimeInMs) / 1000;
        MVLogger.debug(
            `ProductController: Layer loading time in seconds: ${layerLoadingTimeInS}`
        );

        // Add configured entity to the scene
        this._entityService.addRigToScene(entity);
        // await this._entityService.updateLayersInScene(entity, updatedLayers);
        this._entityService.applyRigOffset(entity);

        const applyMaterialsStartTimeInMs = Date.now();

        // Apply current materials to entity
        const applyMaterialsPromise =
            this._entityService.applyMaterials(entity);

        await Promise.all([applyMaterialsPromise]);

        const applyMaterialsTimeInS =
            (Date.now() - applyMaterialsStartTimeInMs) / 1000;
        MVLogger.debug(
            `ProductController: Apply materials time in seconds: ${applyMaterialsTimeInS}`
        );

        this._cameraService.updateMeshesToBeHiddenOnCameraIntersection();
        this._cameraService.updateActiveProductEntity(entity);

        this._eventDispatcherService.publish(MVEventTypes.onProductLoaded, {
            entity
        });
        MVLogger.debug(`ProductController: Applying materials complete`);

        await Promise.all([setupAnimationsPromise]);

        const totalLoadingTimeInS = (Date.now() - loadingStartTimeInMs) / 1000;
        MVLogger.debug(
            `ProductController: Total loading time in seconds: ${totalLoadingTimeInS}`
        );

        if (
            this._settings.productionMode &&
            this._entityService.activeEnvironmentEntity &&
            !this._entityService._environmentUpdateInProgress
        ) {
            this._sceneOptimizerService.restoreHardwareScalingLevel;
            this._sceneOptimizerService.unfreezeHardwareScalingLevel();
            this._entityService
                .disposeUnusedMaterialsAndTextures(0)
                .then(async () => {
                    // if (this._cameraService.getActiveCameraShot() && !preventSceneFreezing) {
                    //   await this._entityService.freezeMaterialsAfterTimeout(0);
                    //   this._entityService.freezeMeshes(1000);
                    // }
                });
        }

        this._entityService._productUpdateInProgress = false;

        return entity;
    }

    /**
     * Update the configuration of a product
     * @param id - Id of the product -
     * @param configurationCodes - Configuration codes to apply -
     */
    @QueueAsync()
    public async updateConfiguration(
        id: string,
        configurationCodes: string[],
        preventSceneFreezing?: boolean
    ): Promise<MVEntity> {
        const loadingStartTimeInMs = Date.now();

        if (this._entityService._productUpdateInProgress) return undefined;

        this._entityService._productUpdateInProgress = true;

        let entity: MVEntity = this._entityService.getEntity(id);

        if (entity.activeConfigurationCodes == configurationCodes) {
            return entity;
        }

        if (this._settings.productionMode) {
            this._sceneOptimizerService.freezeHardwareScalingLevel();
            this._sceneOptimizerService.restoreHardwareScalingLevel();
            this._scene.unfreezeActiveMeshes();
            this._entityService.unfreezeMaterials();
        }

        const configurationLoadingStartTimeInMs = Date.now();

        entity = await this._configurationService.updateConfiguration(
            entity,
            configurationCodes
        );

        const configurationLoadingTimeInS =
            (Date.now() - configurationLoadingStartTimeInMs) / 1000;
        MVLogger.debug(
            `ProductController: Configuration loading time in seconds: ${configurationLoadingTimeInS}`
        );

        const animationUpdateStartTimeInMs = Date.now();

        await this._entityService.waitUntilAnimationsHaveFinishedPlaying(
            entity
        );

        const previousAnimations = this._entityService.cloneAnimations(entity);

        await this._entityService.resetAnimations(entity);
        this._entityService.resetRigOffset(entity);

        const animationUpdateTimeInS =
            (Date.now() - animationUpdateStartTimeInMs) / 1000;
        MVLogger.debug(
            `ProductController: Animation update time in seconds: ${animationUpdateTimeInS}`
        );

        const layerLoadingStartTimeInMs = Date.now();

        await this._entityService.applyLayerConfiguration(entity);

        const layerLoadingTimeInS =
            (Date.now() - layerLoadingStartTimeInMs) / 1000;
        MVLogger.debug(
            `ProductController: Layer loading time in seconds: ${layerLoadingTimeInS}`
        );

        this._entityService.applyRigOffset(entity);
        await this._entityService.setAnimationsToPreviousState(
            entity,
            previousAnimations
        );

        const applyMaterialsStartTimeInMs = Date.now();

        await this._entityService.applyMaterials(entity);

        const applyMaterialsTimeInS =
            (Date.now() - applyMaterialsStartTimeInMs) / 1000;
        MVLogger.debug(
            `ProductController: Apply materials time in seconds: ${applyMaterialsTimeInS}`
        );

        this._eventDispatcherService.publish(
            MVEventTypes.onProductConfigurationApplied,
            { entity }
        );
        if (
            this._settings.productionMode &&
            this._entityService.activeEnvironmentEntity &&
            !this._entityService._environmentUpdateInProgress
        ) {
            // await waitForSceneReady(this._scene);
            this._sceneOptimizerService.restoreHardwareScalingLevel();
            this._sceneOptimizerService.unfreezeHardwareScalingLevel(500);
            this._entityService
                .disposeUnusedMaterialsAndTextures(0)
                .then(async () => {
                    if (
                        this._cameraService.getActiveCameraShot() &&
                        !preventSceneFreezing
                    ) {
                        await this._entityService.freezeMaterialsAfterTimeout();
                        this._entityService.freezeMeshes();
                    }
                });
        }

        this._entityService._productUpdateInProgress = false;

        const totalLoadingTimeInS = (Date.now() - loadingStartTimeInMs) / 1000;
        MVLogger.debug(
            `ProductController: Total update time in seconds: ${totalLoadingTimeInS}`
        );

        return entity;
    }

    /**
     * Update the configuration of a product
     * @param id - Id of the product -
     */
    configuration(id: string): string[] {
        let entity: MVEntity = this._entityService.getEntity(id);
        return entity.activeConfigurationCodes;
    }
}
