import { EntityService, SceneSettingsService, ConfigurationService, CameraService } from '../services';
import { MVEntityConfig } from '../models/entity/interfaces';
import { MVEntity } from '../models/entity/mv-entity';
import { MVLayer } from '../models/entity/mv-layer';
import { MVCameraShot } from '../models/camera';
import { MVEnvironmentEntity } from '../models/entity/mv-environment-entity';
import { injectable, inject } from 'inversify';
import { TYPES } from '../ioc/types';
import { EventDispatcherService } from '../services/event-dispatcher.service';
import { MVEventTypes } from '../globals/mv-event-types';
import { Scene } from 'babylonjs';
import { loadJson } from '../helper';
import { CoreSettings } from '../settings';
import { MVLogger } from '../logging';
import { QueueAsync } from '../globals/queue-async.decorator';
import { Subject } from 'rxjs';
import { MVSceneOptimizerService } from '../services/mv-scene-optimizer.service';

/**
 * The EnvironmentController is responsible for loading, updating and removing EnvironmentEntities
 */
@injectable()
export class EnvironmentController {
  public onLoadingProgressUpdate$: Subject<number> = new Subject();

  /**
   * Creates a new EnvironmentController
   */
  constructor(
    @inject(TYPES.ConfigurationService) private _configurationService?: ConfigurationService,
    @inject(TYPES.EntityService) private _entityService?: EntityService,
    @inject(TYPES.SceneSettingsService) private _sceneSettingsService?: SceneSettingsService,
    @inject(TYPES.MVSceneOptimizerService) private _sceneOptimizerService?: MVSceneOptimizerService,
    @inject(TYPES.EventDispatcherService) private _eventDispatcherService?: EventDispatcherService,
    @inject(TYPES.CameraService) private _cameraService?: CameraService,
    @inject(TYPES.Scene) private _scene?: Scene,
    @inject(TYPES.CoreSettings) private _settings?: CoreSettings
  ) {}

  /**
   * Load an environment into the scene.
   * @param relativeEntityConfigUrlOrEntityConfig - Either the relative config Url of the product or the EntityConfig as string, beginning with 'data:' -
   * @param tmpCameraCategory - e.g. 'ext', 'int' will be pulled from camera service in the future -
   * @param baseUrl - Only needs to be provided if it differs from the base url that was provided for initializing the core. -
   */
  @QueueAsync()
  public async loadEnvironment(
    relativeEntityConfigUrlOrEntityConfig: string,
    tmpCameraCategory: string,
    baseUrl?: string,
    preloadOnly?: boolean,
    preventSceneFreezing?: boolean
  ): Promise<MVEnvironmentEntity> {

    if (!preloadOnly) {
      this._entityService._environmentUpdateInProgress = true;
    }

    const entityBaseUrl = baseUrl ? baseUrl : this._settings.assetsBaseUrl;

    // Load the EntityConfig either by loading via JSON or by parsing the data input
    let entityConfig: MVEntityConfig;
    if (relativeEntityConfigUrlOrEntityConfig.includes('data:')) {
      entityConfig = JSON.parse(relativeEntityConfigUrlOrEntityConfig.split('data:')[1]);
    } else {
      entityConfig = await loadJson<MVEntityConfig>(
        entityBaseUrl + relativeEntityConfigUrlOrEntityConfig,
      );
    }

    const existingEntity: MVEnvironmentEntity = this._entityService.getEnvironmentEntity(entityConfig.id);
    if (existingEntity) {
      if (existingEntity !== this._entityService.activeEnvironmentEntity) {
        this._entityService.dispose(this._entityService.activeEnvironmentEntity);
      }
      this._entityService.activeEnvironmentEntity = existingEntity;
      return this.updateConfiguration(existingEntity.uuid, [tmpCameraCategory], preventSceneFreezing);
    }

    if (this._settings.productionMode && !preloadOnly) {
      this._sceneOptimizerService.freezeHardwareScalingLevel();
      this._sceneOptimizerService.resetHardwareScalingLevel();
      this._scene.unfreezeActiveMeshes();
      this._entityService.unfreezeMaterials();
    }

    // Meshes and the rule engine config are loaded relative to the entity config file.
    // Therefore we need to save the base url of the entity config file (url without file name).
    entityConfig.entityConfigBaseUrl = entityBaseUrl;

    // Create new Entity and add it to the EntityService
    let entity: MVEnvironmentEntity = await this._entityService.addEnvironment(entityConfig, entityConfig.id, this.onLoadingProgressUpdate$, preloadOnly);
    if (!preloadOnly) {
      this._entityService.activeEnvironmentEntity = entity;
    }

    // Init entity
    this._entityService.mv_loadConfigs(entity);

    const loadRigPromise = this._entityService.loadRig(entity);

    // Apply start configuration to entity
    const updateConfigurationPromise = this._configurationService.updateConfiguration(entity, []);

    if (preloadOnly) {
      await loadRigPromise;
      await updateConfigurationPromise;
      this._configurationService.disableAllLayers(entity);
      await this._entityService.lazyLoadRemainingLayersAndTextures(entity);
      return entity;
    }

    // Update Lights
    const updateLightsAndSceneSettingsPromise = this._entityService.updateLightsAndSceneSettings(
      tmpCameraCategory,
      entity,
    );

    await Promise.all([
      updateConfigurationPromise,
      loadRigPromise
    ]);

    await this._entityService.applyLayerConfiguration(entity);

    const applyMaterialsPromise = this._entityService.applyMaterials(entity);

    await Promise.all([
      updateLightsAndSceneSettingsPromise,
      applyMaterialsPromise
    ]);

    this._cameraService.updateMeshesToBeHiddenOnCameraIntersection();
    this._scene.resetCachedMaterial();

    this._eventDispatcherService.publish(MVEventTypes.onEnvironmentLoaded, { entity });
    MVLogger.debug(`EnvironmentController: Environment loaded`);

    if (this._settings.productionMode && this._entityService.activeProductEntity &&!this._entityService._productUpdateInProgress) {
      this._sceneOptimizerService.restoreHardwareScalingLevel();
      this._sceneOptimizerService.unfreezeHardwareScalingLevel();
      this._entityService.disposeUnusedMaterialsAndTextures(0).then(async () => {
        // if (this._cameraService.getActiveCameraShot() && !preventSceneFreezing) {
        //   await this._entityService.freezeMaterialsAfterTimeout();
        //   await this._entityService.freezeMeshes();
        // }
      })
    }

    this._entityService._environmentUpdateInProgress = false;

    return entity;
  }

  /**
   * Update the configuration of a environment
   * @param id - Id of the environment -
   * @param configurationCodes - Configuration codes to apply -
   */
  @QueueAsync()
  public async updateConfiguration(id: string, configurationCodes: string[], preventSceneFreezing?: boolean): Promise<MVEnvironmentEntity> {

    this._entityService._environmentUpdateInProgress = true;

    const entity: MVEnvironmentEntity = this._entityService.getEnvironmentEntity(id);

    if (entity.activeConfigurationCodes == configurationCodes) {
      return entity;
    }

    if (this._settings.productionMode) {
      this._sceneOptimizerService.freezeHardwareScalingLevel();
      this._sceneOptimizerService.resetHardwareScalingLevel();
      this._scene.unfreezeActiveMeshes();
      this._entityService.unfreezeMaterials();
    }

    await this._configurationService.updateConfiguration(entity, configurationCodes);

    await this._entityService.applyLayerConfiguration(entity);

    const currentCameraShot: MVCameraShot = this._cameraService.getActiveCameraShot();
    const cameraCategory: string = currentCameraShot?.category;

    // Update Lights
    const updateLightsAndSceneSettingsPromise = this._entityService.updateLightsAndSceneSettings(
      cameraCategory,
      entity,
    );
    const applyMaterialsPromise = this._entityService.applyMaterials(entity);
    await Promise.all([
      updateLightsAndSceneSettingsPromise,
      applyMaterialsPromise
    ]);

    this._cameraService.updateMeshesToBeHiddenOnCameraIntersection();
    this._scene.resetCachedMaterial();

    if (this._settings.productionMode && this._entityService.activeProductEntity && !this._entityService._productUpdateInProgress) {
      this._sceneOptimizerService.restoreHardwareScalingLevel();
      this._sceneOptimizerService.unfreezeHardwareScalingLevel(500);
      this._entityService.disposeUnusedMaterialsAndTextures(0).then(async () => {
        if (this._cameraService.getActiveCameraShot() && !preventSceneFreezing) {
          await this._entityService.freezeMaterialsAfterTimeout();
          await this._entityService.freezeMeshes();
        }
      })
    }
  

    this._entityService._environmentUpdateInProgress = false;

    return entity;
  }

  public updateLensFlareIntensity(intensity: number) {
    this._sceneSettingsService.updateLensFlareSystemIntensity(intensity);
  }
}
