import { AbstractMesh, AnimationGroup, ArcRotateCamera, Camera, Constants, Scene, SSRRenderingPipeline, Tools, Vector3 } from 'babylonjs';
import { inject, injectable } from 'inversify';
import { Subject } from 'rxjs';
import { SceneSettingsService } from '.';
import {
    calculateCameraRadius,
    calculateCameraRadiusFromCameraZoomBehavior,
    createAndPlayCameraFovAnimation,
    createAndPlayCameraTransformAnimation,
    detectMobileDevice,
    fadeInScene,
    fadeOutScene,
    getChildCamera,
    loadJson,
    modulo,
    resetCameraRadiusLimits,
    resetCameraRotationLimits,
    timeout,
} from '../helper';
import { TYPES } from '../ioc/types';
import { CoreError, MVLogger } from '../logging';
import { MVAnimationState, PlayAnimationOptions } from '../models/animation/interfaces';
import { MVAnimation } from '../models/animation/MVAnimation';
import {
    CameraShotBehavior,
    MVCamera,
    MVCameraShot,
    MVCameraShotBehaviourType,
    MVCameraShotMetaData,
    MVCameraShotSettings,
    MVCameraShotsMetaData,
    MVCameraTransition,
} from '../models/camera';
import { CoreCanvasElement } from '../models/CoreCanvasElement';
import { MVEntity } from '../models/entity/mv-entity';
import { MVProductEntity } from '../models/entity/mv-product-entity';
import { CoreSettings } from '../settings';
import { ActionItemService } from './action-item.service';
import { AnimationService } from './animation.service';
import { AssetLoaderService } from './asset-loader.service';
import { EntityService } from './entity.service';
import { MVSceneOptimizerService } from './mv-scene-optimizer.service';

export enum CameraMovementState {
    START = 'start',
    MOVING = 'moving',
    END = 'end',
}

/**
 * Service for modifying cameras
 */
@injectable()
export class CameraService {
    private _cameraShots: Map<string, MVCameraShot> = new Map<string, MVCameraShot>();

    private _activeCameraShotId: string;
    private _mainCamera: MVCamera;
    private _animatedCamera: Camera;
    private _animatedCameraRootNode: AbstractMesh;
    private _animatedCameraAnimationGroups: AnimationGroup[];

    private _lastCameraPosition: number;

    private _cameraMoving: boolean;
    public onCameraMovement$: Subject<CameraMovementState> = new Subject();
    private _meshesToBeHiddenOnCameraIntersection: AbstractMesh[];
    private fpsAnimationDuration: number;
    private _postProcessingEnabled: boolean;
    private _activeProductEntity: MVEntity;
    private _fadeSpeedRatio: number = 1;

    /**
     * Creates a new BabylonJS based Camera Service
     * @param scene - the Babylon scene -
     * @param canvas - the canvas object the scene is rendered on -
     */
    constructor(
        @inject(TYPES.Scene) private _scene: Scene,
        @inject(TYPES.Canvas) private _canvas: CoreCanvasElement,
        @inject(TYPES.EntityService) private _entityService: EntityService,
        @inject(TYPES.AnimationService) private _animationService: AnimationService,
        @inject(TYPES.ActionItemService) private _actionItemService: ActionItemService,
        @inject(TYPES.MVSceneOptimizerService) private _sceneOptimizer: MVSceneOptimizerService,
        @inject(TYPES.SceneSettingsService) private _sceneSettingsService: SceneSettingsService,
        @inject(TYPES.CoreSettings) private _settings?: CoreSettings,
        @inject(TYPES.AssetLoaderService) private _assetLoader?: AssetLoaderService,
        @inject(TYPES.MVSceneOptimizerService) private _sceneOptimizerService?: MVSceneOptimizerService,
    ) {
        this.setupDefaultCamera();
        this.fpsAnimationDuration = 30;
        this._activeCameraShotId = null;
        this._meshesToBeHiddenOnCameraIntersection = [];
    }

    /**
     * Get camera shot by id
     * @param id -
     *
     */
    public getCameraShot(id: string): MVCameraShot {
        const isMobileDevice = detectMobileDevice();

        const engine = this._mainCamera.getScene().getEngine();

        // Get aspect radio of viewport
        const aspectRatio = engine.getAspectRatio(this._mainCamera);
        const landscapeModeActive = aspectRatio > 1;

        let cameraId = isMobileDevice && !landscapeModeActive ? `${id}_mobile` : id;

        if (!this._cameraShots.get(cameraId)) {
            cameraId = id;
        }

        let cameraShot = this._cameraShots.get(cameraId);
        if (!cameraShot) {
            cameraShot = this._cameraShots.values[0];
            if (cameraShot) {
                MVLogger.warn(
                    CoreError.InvalidParameterError,
                    `CamerShot with id: ${cameraId} not found! Trying to use ${cameraShot.id}.`,
                );
            }
        }
        if (!cameraShot) {
            MVLogger.error(CoreError.InvalidParameterError, `CamerShot with id: ${cameraId} not found!`);
        }
        return cameraShot;
    }

    /**
     * Load CameraShotSettings from json file
     * @param url -
     *
     */
    public async loadCameraShotSettings(url: string): Promise<MVCameraShotSettings> {
        const fullUrl = this._settings.assetsBaseUrl + url;
        let cameraShotSettings: MVCameraShotSettings;

        if (this._settings.useMobileAssets) {
            const fullMobileUrl = fullUrl.endsWith('_mobile.json') ? fullUrl : fullUrl.replace('.json', '_mobile.json');
            cameraShotSettings = await loadJson<MVCameraShotSettings>(fullMobileUrl);

            if (cameraShotSettings) {
                MVLogger.info(`Mobile version of camera shot ${url} found.`);
                return cameraShotSettings;
            }

            MVLogger.warn(`No mobile version of camera shot ${url} found.`);
        }

        // const regularCameraUrl = fullUrl.replace('_mobile', '');
        cameraShotSettings = await loadJson<MVCameraShotSettings>(fullUrl);

        if (cameraShotSettings) {
            MVLogger.info(`Camera shot ${url} found.`);
            return cameraShotSettings;
        }

        MVLogger.info(`Failed to load camera shot ${url}.`);
        return null;
    }

    /**
     * Get active camera shot
     *
     */
    public getActiveCameraShot(): MVCameraShot {
        if (this._activeCameraShotId) {
            return this._cameraShots.get(this._activeCameraShotId);
        }
        return null;
    }

    /**
     * Return all ids of camera shots
     *
     */
    public getAllCameraShotsIds(): string[] {
        const ids: string[] = [];
        this._cameraShots.forEach((value: MVCameraShot, key: string) => ids.push(key));
        return ids;
    }

    /**
     * Get active camera
     *
     */
    public getActiveCamera(): MVCamera {
        return this._mainCamera;
    }

    /**
     * Setup the default camera
     *
     */
    public setupDefaultCamera(): MVCamera {
        // this._scene.onBeforeRenderObservable.add(() => camera.rebuildAnglesAndRadius())
        const camera: MVCamera = new MVCamera('mainCamera', Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), this._scene);

        camera.attachControl(this._canvas, true);
        // Set default camera specs
        camera.useAutoRotationBehavior = false;
        camera.panningSensibility = 0;
        camera.minZ = 0.01;
        camera.wheelPrecision = 100;
        camera.speed = 1;
        camera.useNaturalPinchZoom = true;
        camera.radius = 7;
        camera.alpha = 0.6;
        camera.beta = 1.3;
        camera.target.x = -0.8;
        camera.target.y = 0.25;
        camera.target.z = 0;

        this._mainCamera = camera;

        // handle main camera state
        this._scene.onAfterCameraRenderObservable.add((camera: MVCamera) => {
            if (!this._lastCameraPosition) {
                this._lastCameraPosition = camera.alpha + camera.beta + camera.radius;
            } else {
                if (camera.alpha + camera.beta + camera.radius !== this._lastCameraPosition) {
                    this._lastCameraPosition = camera.alpha + camera.beta + camera.radius;
                    if (this._cameraMoving) {
                        this.onCameraMovement$.next(CameraMovementState.MOVING);
                    } else {
                        this.onCameraMovement$.next(CameraMovementState.START);
                    }
                    this._cameraMoving = true;
                } else {
                    if (this._cameraMoving) {
                        this.onCameraMovement$.next(CameraMovementState.END);
                        this._cameraMoving = false;
                    }
                }
            }
        });

        this.addCameraToRenderPipeline(this._mainCamera);

        // listen on cameraMovement states
        this.onCameraMovement$.subscribe((state: CameraMovementState) => {
            const cameraPosition = this._mainCamera.position;

            this._meshesToBeHiddenOnCameraIntersection.forEach((mesh: AbstractMesh) => {
                if (mesh) {
                    const intersect = mesh.getBoundingInfo().boundingBox.intersectsPoint(cameraPosition);
                    if (intersect) {
                        // MVLogger.info('INTERSECTION DETECTED FOR MESH ' + mesh.id);
                        mesh.visibility = 0;
                    } else {
                        mesh.visibility = 1;
                    }
                }
            });

            if (state === CameraMovementState.START) {
                this._sceneOptimizer.optimizeOnMove();
            } else if (state === CameraMovementState.END) {
                this._sceneOptimizer.optimizeOnStill();
            } else if (state === CameraMovementState.MOVING) {
                const activeBehaviors: CameraShotBehavior[] = this.getActiveCameraShot()?.getBehaviors();
                const orbitBehavior = activeBehaviors?.find(
                    (b: CameraShotBehavior) => b.settings?.type == MVCameraShotBehaviourType.ORBIT,
                );
                if (orbitBehavior) {
                    orbitBehavior.updateSettingsOnRotation(this._mainCamera);
                }
            }
        });

        return this._mainCamera;
    }

    /**
     * Add camera to render pipeline
     */
    public addCameraToRenderPipeline(camera: Camera): void {

        const ssaoPipeline = this._sceneSettingsService.getSSAORenderPipeline();
        if (ssaoPipeline && !ssaoPipeline.cameras.includes(camera)) {
            this._scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline('ssao', camera);
        }

        // new SSRRenderingPipeline(
        //     "ssr", // The name of the pipeline
        //     this._scene, // The scene to which the pipeline belongs
        //     [camera], // The list of cameras to attach the pipeline to
        //     false, // Whether or not to use the geometry buffer renderer (default: false, use the pre-pass renderer)
        //     Constants.TEXTURETYPE_UNSIGNED_BYTE, // The texture type used by the SSR effect (default: TEXTURETYPE_UNSIGNED_BYTE)
        // );

        const renderPipeline = this._sceneSettingsService.getRenderPipeline();
        if (renderPipeline && !renderPipeline.cameras.includes(camera)) {
            renderPipeline.addCamera(camera);
            renderPipeline.prepare();
            this._scene.postProcessRenderPipelineManager.update();
        }
    }

    public removeCameraFromRenderPipeline(camera: Camera): void {
        const renderPipeline = this._sceneSettingsService.getRenderPipeline();
        if (renderPipeline && renderPipeline.cameras.includes(camera)) {
            renderPipeline.removeCamera(camera);
            renderPipeline.prepare();
            this._scene.postProcessRenderPipelineManager.update();
        }
    }

    private async loadCameraShot(url: string, id: string): Promise<MVCameraShot | undefined> {
        const settings: MVCameraShotSettings = await this.loadCameraShotSettings(url);
        if (!settings) {
            return undefined
        }
        const cameraShot: MVCameraShot = new MVCameraShot(settings, id);
        this._cameraShots.set(cameraShot.id, cameraShot);
        return cameraShot;
    }

    public mv_addCameraShotsFromEntity(entity: MVEntity): MVCameraShot[] {
        if (entity.mv_cameraShotsArr) {
            return this.mv_addCameraShotsFromArrayFromArray(entity.mv_cameraShotsArr);
        } else {
            return this.mv_addCameraShotsWithMetaData(entity.entityConfig.cameraShots);
        }
    }

    /**
     * Add camera shots
     * @param cameraShotsArr -
     * @deprecated
     */
    public mv_addCameraShotsFromArrayFromArray(cameraShotsArr: MVCameraShot[]): MVCameraShot[] {
        const cameraShots = new Map<string, MVCameraShot>();

        // Instantiate camera shots
        const cams = cameraShotsArr.filter((p) => !p.id.endsWith('_mobile'));
        for (const cs of cams) {
            cameraShots.set(cs.id, cs);
        }
        const mobile = cameraShotsArr.filter((p) => !!p.id.endsWith('_mobile'));
        for (const cs of mobile) {
            cameraShots.set(cs.id, cs);
        }

        this._cameraShots = cameraShots;
        const cameraShotsArray: MVCameraShot[] = [];
        this._cameraShots.forEach((value: MVCameraShot, key: string) => cameraShotsArray.push(value));
        return cameraShotsArray;
    }

    public mv_addCameraShotsWithMetaData(cameraShotsMetaData: MVCameraShotsMetaData): MVCameraShot[] {
        let cameraShots = new Map<string, MVCameraShot>();

        if (cameraShotsMetaData) {
            cameraShots = Object.keys(cameraShotsMetaData).reduce((results, cameraShotId: string) => {
                const cameraShotMetaData: MVCameraShotMetaData = cameraShotsMetaData[cameraShotId];

                if (cameraShotMetaData.cameraShotSettings) {
                    results.set(cameraShotId, new MVCameraShot(cameraShotMetaData.cameraShotSettings, cameraShotId));
                }

                if (cameraShotMetaData.cameraShotSettingsMobile) {
                    results.set(
                        cameraShotId + '_mobile',
                        new MVCameraShot(cameraShotMetaData.cameraShotSettingsMobile, cameraShotId + '_mobile'),
                    );
                }

                return results;
            }, new Map<string, MVCameraShot>());
        }

        this._cameraShots = cameraShots;

        const productEntity = this._entityService.getActiveProductEntity();
        if (productEntity) {
            productEntity.entityConfig.cameraShots = cameraShotsMetaData;
        }

        const cameraShotsArray: MVCameraShot[] = [];
        this._cameraShots.forEach((value: MVCameraShot, key: string) => cameraShotsArray.push(value));
        return cameraShotsArray;
    }

    /**
     * Set new camera shots for camera
     * @param cameraShotUrls -
     */
    public async addCameraShotsFromMetaData(cameraShotsMetaData: MVCameraShotsMetaData): Promise<MVCameraShot[]> {
        this._cameraShots = new Map<string, MVCameraShot>();

        const promises = [];

        for (let cameraShotId of Object.keys(cameraShotsMetaData)) {
            const cameraShotMetaData: MVCameraShotMetaData = cameraShotsMetaData[cameraShotId];

            if (cameraShotMetaData.urlRelative) {
                promises.push(this.loadCameraShot(cameraShotMetaData.urlRelative, cameraShotMetaData.id));
            }

            if (cameraShotMetaData.mobileUrlRelative) {
                promises.push(
                    this.loadCameraShot(cameraShotMetaData.mobileUrlRelative, cameraShotMetaData.id + '_mobile'),
                );
            }
        }

        const loadedCameraShots = await Promise.all(promises);
        if (loadedCameraShots?.length > 0 && loadedCameraShots[0]?.id) {
            // await this.requestCameraShot(loadedCameraShots[0].id);
        }

        const productEntity = this._entityService.activeProductEntity;

        if (productEntity) {
            productEntity.entityConfig.cameraShots = cameraShotsMetaData;
        }

        const cameraShotsArray: MVCameraShot[] = [];
        this._cameraShots.forEach((value: MVCameraShot, key: string) => cameraShotsArray.push(value));

        return cameraShotsArray;
    }

    /**
     * Set new camera shots for camera
     * @param cameraShotUrls -
     * @deprecated
     */
    public async addCameraShots(cameraShotUrls: string[]): Promise<MVCameraShot[]> {
        this._cameraShots = new Map<string, MVCameraShot>();

        const promises = [];
        // Instantiate camera shots
        cameraShotUrls?.forEach((url) => {
            let id = url.replace('.json', '');
            const lastSlashIndex = id.lastIndexOf('/');
            if (lastSlashIndex > 0) {
                id = id.slice(lastSlashIndex + 1);
            }
            promises.push(this.loadCameraShot(url, id));
        });

        const loadedCameraShots = await Promise.all(promises);
        if (loadedCameraShots?.length > 0 && loadedCameraShots[0]?.id) {
            // await this.requestCameraShot(loadedCameraShots[0].id);
        }

        const cameraShotsArray: MVCameraShot[] = [];
        this._cameraShots.forEach((value: MVCameraShot, key: string) => cameraShotsArray.push(value));

        return cameraShotsArray;
    }

    findDeltaAngleRadians(A1: number, A2: number) {
        let delta = A2 - A1;

        // If change is larger than PI
        if (delta > Math.PI) {
            // Flip to negative equivalent
            delta = delta - Math.PI * 2.0;
        } else if (delta < -Math.PI) {
            // Otherwise, if change is smaller than -PI
            // Flip to positive equivalent
            delta = delta + Math.PI * 2.0;
        }

        // Return delta in [-PI,PI] range
        return delta;
    }

    /**
     * Create a new animation to transform the main camera smoothly
     * @param newCameraShot -
     */
    async createAndPlayMainCameraTransformAnimation(newCameraShot: MVCameraShot): Promise<void> {
        this._mainCamera.alpha = modulo(this._mainCamera.alpha, Math.PI * 2); // necessary to prevent too much spinning
        this._mainCamera.rebuildAnglesAndRadius();
        const newCameraTarget = new Vector3(
            newCameraShot.getSettings().target[0],
            newCameraShot.getSettings().target[1],
            newCameraShot.getSettings().target[2],
        );
        const newCameraPosition = new Vector3(
            newCameraShot.getSettings().position[0],
            newCameraShot.getSettings().position[1],
            newCameraShot.getSettings().position[2],
        );
        const tempCamera = new ArcRotateCamera('tempCamera', 1, 1, 1, newCameraTarget, this._scene);

        tempCamera.setPosition(new Vector3(...newCameraShot.getSettings().position));
        tempCamera.setTarget(new Vector3(...newCameraShot.getSettings().target), false, true);

        tempCamera.rebuildAnglesAndRadius();

        const zoomBehavior = newCameraShot
            .getBehaviors()
            .find((behavior: CameraShotBehavior) => behavior.settings.type == MVCameraShotBehaviourType.ZOOM);
        if (zoomBehavior) {
            tempCamera.radius = calculateCameraRadiusFromCameraZoomBehavior(tempCamera, zoomBehavior.settings);
        } else {
            tempCamera.radius = calculateCameraRadius(newCameraPosition, newCameraTarget);
        }

        tempCamera.rebuildAnglesAndRadius();

        resetCameraRotationLimits(this._mainCamera);
        resetCameraRadiusLimits(this._mainCamera);

        const deltaAngle = this.findDeltaAngleRadians(this._mainCamera.alpha, tempCamera.alpha);
        let targetAngle = this._mainCamera.alpha + deltaAngle;

        await createAndPlayCameraTransformAnimation(
            this._mainCamera,
            this.fpsAnimationDuration,
            this.fpsAnimationDuration,
            tempCamera.target.clone(),
            tempCamera.radius,
            targetAngle,
            tempCamera.beta,
            Tools.ToRadians(newCameraShot.getSettings().fov),
        );

        tempCamera.dispose();
    }

    /**
     * Zoom in main camera by animating fov value
     */
    createZoomInAnimation() {
        createAndPlayCameraFovAnimation(
            this._mainCamera,
            this.fpsAnimationDuration,
            this.fpsAnimationDuration,
            this._fadeSpeedRatio,
            this._mainCamera.fov / 2,
        );
    }

    /**
     * Request a camera shot by id
     * @param id -
     */
    public async requestCameraShot(
        id: string,
        forceUpdate: boolean,
        preventSceneFreezing?: boolean,
    ): Promise<MVCameraShot> {
        if (!this._mainCamera) {
            this.setupDefaultCamera();
        }

        const cameraShotIds: string[] = this.getAllCameraShotsIds();
        const nextCameraShot: MVCameraShot = this.getCameraShot(id);

        if (!nextCameraShot) {
            return null;
        }

        const previousCameraShot = this.getActiveCameraShot();

        if (forceUpdate == false && previousCameraShot == nextCameraShot) {
            return null;
        }

        let cameraTransition: MVCameraTransition = this.getCameraTransition(previousCameraShot, nextCameraShot);

        if (!cameraTransition) {
            await this.playRequiredAnimations(nextCameraShot, 100000);
            // waiting for the required animations to finish somehow takes very long
            // using a timeout is faster and gives the same result
            // await timeout(300);
        } else {
            if (cameraTransition.zoomIn) {
                this.createZoomInAnimation();
            }
            if (cameraTransition.fadeToBlack) {
                await fadeOutScene();
                await this.playRequiredAnimations(nextCameraShot, 100000);
            }
            if (cameraTransition.transformAnimation) {
                this.playRequiredAnimations(nextCameraShot);
                await this.createAndPlayMainCameraTransformAnimation(nextCameraShot);
            }
        }

        const isMobileCamera = nextCameraShot.id.includes('_mobile');

        const _waitForSceneReady = previousCameraShot ? true : false;

        await this._entityService.updateLightsAndSceneSettings(
            nextCameraShot.category,
            null,
            preventSceneFreezing,
            _waitForSceneReady,
        );

        this._mainCamera.rebuildAnglesAndRadius();

        if (this._mainCamera.currentShot) {
            this._mainCamera.previousShot = this._mainCamera.currentShot;
            this._mainCamera.previousShot.deactivate(this._mainCamera);
            this._animatedCameraAnimationGroups?.forEach((animationGroup: AnimationGroup) => {
                animationGroup.dispose();
            });
            this._animatedCameraAnimationGroups = [];
        }
        if (this._animatedCameraRootNode) {
            this.removeCameraFromRenderPipeline(this._animatedCamera);
            this._animatedCamera.dispose();
            this._animatedCameraRootNode.dispose();
        }
        this._scene.activeCamera = this._mainCamera;
        this._mainCamera.currentShot = nextCameraShot;
        this._mainCamera.freeze();
        nextCameraShot.activate(this._mainCamera);
        this._activeCameraShotId = nextCameraShot.id;

        const nextCameraShotSettings = nextCameraShot.getSettings();
        if (nextCameraShotSettings?.animationFile) {
            await this.loadAndPlayCameraAnimation(nextCameraShotSettings);
        }

        // Might be necessary for some devices to prevent showing the model too early.
        if (!previousCameraShot || (previousCameraShot && cameraTransition?.fadeToBlack)) {
            await timeout(200);
            // await waitForSceneReady(this._scene);
        }

        if (previousCameraShot && cameraTransition?.fadeToBlack) {
            fadeInScene();
        }

        this._actionItemService.updateActionItems(isMobileCamera, 500);

        const automaticOptimization = this._settings.antiAliasingSettings.automaticOptimization;
        if (automaticOptimization !== 0) {
            this._sceneOptimizerService.startFPSBasedOptimizer(automaticOptimization !== 1, 3000);
        }

        return nextCameraShot;
    }

    private getCameraTransition(previousCameraShot: MVCameraShot, nextCameraShot: MVCameraShot): MVCameraTransition {
        if (!previousCameraShot || !nextCameraShot) {
            return null;
        }

        if (nextCameraShot.getSettings().animationFile) {
            return null;
        }

        const cameraCategoryTransitions = this._activeProductEntity?.entityConfig.cameraCategoryTransitionsFromTo;

        let cameraCategoryTransition: MVCameraTransition;
        if (cameraCategoryTransitions) {
            cameraCategoryTransition = cameraCategoryTransitions[previousCameraShot.category][nextCameraShot.category];
        }

        if (cameraCategoryTransition && previousCameraShot.id == nextCameraShot.id) {
            return cameraCategoryTransition;
        }

        const cameraShotsMetaData: {
            [key: string]: MVCameraShotMetaData;
        } = this._activeProductEntity?.entityConfig.cameraShots;

        const previousCameraShotIdNonMobile = previousCameraShot.id.replace('_mobile', '');
        const previousCameraShotMetaData: MVCameraShotMetaData = cameraShotsMetaData
            ? cameraShotsMetaData[previousCameraShotIdNonMobile]
            : null;

        let previousCameraShotTransition: MVCameraTransition = previousCameraShotMetaData?.cameraTransition
            ? { ...previousCameraShotMetaData.cameraTransition }
            : null;
        if (previousCameraShotTransition?.fadeToBlackOnLeave) {
            return {
                fadeToBlack: true,
            };
        }

        const nextCameraShotIdNonMobile = nextCameraShot.id.replace('_mobile', '');
        const nextCameraShotMetaData: MVCameraShotMetaData = cameraShotsMetaData
            ? cameraShotsMetaData[nextCameraShotIdNonMobile]
            : null;

        let nextCameraShotTransition: MVCameraTransition = nextCameraShotMetaData?.cameraTransition
            ? { ...nextCameraShotMetaData.cameraTransition }
            : null;
        if (nextCameraShotTransition && cameraCategoryTransition?.zoomIn) {
            nextCameraShotTransition['zoomIn'] = true;
        }

        return nextCameraShotTransition ? nextCameraShotTransition : cameraCategoryTransition;
    }

    private async playRequiredAnimations(cameraShot: MVCameraShot, speedRatio?) {
        await this.playAnimationsAndSetActionItemState(cameraShot, speedRatio);
        await this._actionItemService.updateActionItemsVisibility(cameraShot, speedRatio);
    }

    private async playAnimationsAndSetActionItemState(
        cameraShot: MVCameraShot,
        speedRatio?: number,
        preventAutoPlay?: boolean,
    ): Promise<void> {
        const playAnimationPromises: Promise<any>[] = [];
        const productEntity = this._entityService.getActiveProductEntity();

        let cameraShotMetaData: MVCameraShotMetaData;
        if (productEntity?.entityConfig?.cameraShots) {
            const cameraShotIdNonMobile = cameraShot.id.replace('_mobile', '');
            cameraShotMetaData = productEntity.entityConfig.cameraShots[cameraShotIdNonMobile];
        }

        const animations: MVAnimation[] = productEntity?.getAnimations();

        animations?.forEach((animation: MVAnimation) => {
            const animationState = cameraShotMetaData?.animationStates?.find((state: MVAnimationState) => {
                return state.animationId == animation.id;
            });

            let targetFrame = 0;
            if (animationState?.frame) {
                targetFrame = animationState.frame;
            } else if (animationState?.setToLastFrame) {
                targetFrame = animation.endFrame;
            }

            if (!preventAutoPlay) {
                const playAnimationOptions: PlayAnimationOptions = {
                    to: targetFrame,
                };
                if (speedRatio) {
                    playAnimationOptions.speedRatio = speedRatio;
                }
                const playAnimationPromise = this._animationService
                    .play(animation.id, productEntity, playAnimationOptions)
                    .then(() => {
                        this._actionItemService.setActionItemState(animation.id, animationState?.actionItemState);
                    });
                playAnimationPromises.push(playAnimationPromise);
            }
        });
        await Promise.all(playAnimationPromises);
    }

    private async loadAndPlayCameraAnimation(cameraShotSettings: MVCameraShotSettings): Promise<void> {
        let meshes: AbstractMesh[];
        await this._assetLoader
            .loadMeshesAndAnimationGroups(this._settings.assetsBaseUrl, cameraShotSettings.animationFile)
            .then((result: { meshes: AbstractMesh[]; animationGroups: AnimationGroup[] }) => {
                meshes = result.meshes;
                this._animatedCameraAnimationGroups = result.animationGroups;
                this._animatedCameraAnimationGroups?.forEach((animationGroup: AnimationGroup) => {
                    animationGroup.name = 'Camera Animation';
                    animationGroup.loopAnimation = false;
                    animationGroup.pause();
                    animationGroup.onAnimationGroupEndObservable.clear();
                });
            });
        this._animatedCameraRootNode = meshes[0];
        this._animatedCamera = getChildCamera(this._animatedCameraRootNode);

        this.addCameraToRenderPipeline(this._animatedCamera);

        this._scene.activeCamera = this._animatedCamera;
        this._animatedCameraRootNode.name = 'animated_camera_scene';
        this._animatedCameraRootNode.id = 'animated_camera_scene';
        this._scene.addMesh(this._animatedCameraRootNode, true);

        const ag = this._animatedCameraAnimationGroups[0];

        if (cameraShotSettings.fovKeyFrames) {
            this.playAnimatedCameraShot(cameraShotSettings, 0, 0);
        }
    }

    private async playAnimatedCameraShot(
        cameraShotSettings: MVCameraShotSettings,
        previousFrame: number,
        currentKeyFrame: number,
    ) {
        const animationGroup =
            this._animatedCameraAnimationGroups.length > 0 ? this._animatedCameraAnimationGroups[0] : null;
        if (animationGroup) {
            const animation = animationGroup.targetedAnimations[0].animation;
            const keys = animation.getKeys();
            const currentFrameString = currentKeyFrame.toString();
            let currentKeyframeIndex = Object.keys(cameraShotSettings.fovKeyFrames).indexOf(currentFrameString);

            if (currentKeyframeIndex >= 0) {
                const currentKeyFrameBabylonFormat = keys[currentKeyFrame].frame;

                const fov = cameraShotSettings.fovKeyFrames[currentKeyFrame];
                this._animatedCamera.fov = Tools.ToRadians(fov);

                if ('lightCategoryKeyFrames' in cameraShotSettings) {
                    const cameraCategory = cameraShotSettings.lightCategoryKeyFrames[currentKeyFrame];
                    await this._entityService.updateLightsAndSceneSettings(
                        cameraCategory,
                        this._entityService.activeEnvironmentEntity,
                    );
                    MVLogger.debug(`camera category ${cameraCategory}`);
                }

                const nextKeyFrameString = Object.keys(cameraShotSettings.fovKeyFrames)[currentKeyframeIndex + 1];
                const targetKeyFrame = parseInt(nextKeyFrameString);
                const nextKeyFrameBabylonFormat = keys[targetKeyFrame].frame;
                animationGroup.loopAnimation = false;
                animationGroup['_from'] = currentKeyFrameBabylonFormat;
                animationGroup['_to'] = nextKeyFrameBabylonFormat;
                if (previousFrame !== currentKeyFrame) {
                    animationGroup.goToFrame(currentKeyFrameBabylonFormat);
                }

                animationGroup.animatables.forEach((animatable) => {
                    animatable.fromFrame = currentKeyFrameBabylonFormat;
                    animatable.toFrame = nextKeyFrameBabylonFormat;
                    if (previousFrame !== currentKeyFrame) {
                        animatable.goToFrame(currentKeyFrameBabylonFormat);
                    }
                });

                MVLogger.debug(`playing from frame ${currentKeyFrame} to ${targetKeyFrame}`);
                animationGroup.onAnimationGroupEndObservable.clear();

                animationGroup.onAnimationGroupEndObservable.addOnce((ag: AnimationGroup) => {
                    animationGroup.onAnimationGroupEndObservable.clear();
                    ag.onAnimationGroupEndObservable.clear();
                    const nextKeyFrame = targetKeyFrame + 1 >= keys.length ? 0 : targetKeyFrame + 1;
                    this.playAnimatedCameraShot(cameraShotSettings, targetKeyFrame, nextKeyFrame);
                });

                animationGroup.play(false);
            }
        }
    }

    /**
     * updateMeshesToBeHiddenOnCameraIntersection
     */
    public updateMeshesToBeHiddenOnCameraIntersection(): void {
        this._meshesToBeHiddenOnCameraIntersection = [];
        this._scene.meshes.forEach((mesh: AbstractMesh) => {
            if (mesh['hideOnCameraIntersect']) {
                this._meshesToBeHiddenOnCameraIntersection.push(mesh);
            }
        });
    }

    /**
     * Updates the active product entity (necessary for camera transitions)
     * @param entity -
     */
    public updateActiveProductEntity(entity: MVProductEntity): void {
        this._activeProductEntity = entity;
    }

    /**
     * Get all camera shots
     */
    public getAllCameraShots(): Map<string, MVCameraShot> {
        return this._cameraShots;
    }
}
