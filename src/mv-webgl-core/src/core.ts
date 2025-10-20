import { Engine, GizmoManager, Scene } from 'babylonjs';
import 'reflect-metadata';
import { fromEvent, Subject, Subscription } from 'rxjs';
import { debounceTime, takeUntil, tap, throttleTime } from 'rxjs/operators';
import { AnimationController, CameraController, ControlsController, LightController, SceneController } from './controllers';
import { ActionItemController } from './controllers/action-item.controller';
import { EnvironmentController } from './controllers/environment.controller';
import { ProductController } from './controllers/product.controller';
import { onDestroy$ } from './globals/events';
import { MVEventTypes } from './globals/mv-event-types';
import { removeScreenshot, takeScreenshot, toggleStats } from './helper';
import { controlers, services } from './ioc/container-modules';
import { myContainer } from './ioc/inversify.config';
import { TYPES } from './ioc/types';
import { CoreError, MVLogger } from './logging';
import { MVStartRenderOptions } from './models/camera';
import { MVMaterialMappingsJson } from './models/configuration/interfaces';
import { CoreCanvasElement, CoreWraperElement } from './models/CoreCanvasElement';
import { MVEntity } from './models/entity/mv-entity';
import { BaseResolver } from './resolvers';
import { SceneSettingsService } from './services';
import { ActionItemService } from './services/action-item.service';
import { CameraService } from './services/camera.service';
import { EntityService } from './services/entity.service';
import { EventDispatcherService } from './services/event-dispatcher.service';
import { MVSceneOptimizerService } from './services/mv-scene-optimizer.service';
import { PlatformService } from './services/platform.service';
import { CoreSettings, CoreSettingsObject } from './settings';

export type ResolverLocator = (entity: MVEntity) => BaseResolver;

/**
 * Core class that init all
 */
export class Core {
  /* Core data */
  private _engine: Engine;
  private _scene: Scene;
  private _container: HTMLElement;
  public _wrapper: HTMLDivElement;
  public _canvas: CoreCanvasElement;
  private _inspectorState: boolean;
  private _eventDispatcherService: EventDispatcherService;
  private _sceneOptimizer: MVSceneOptimizerService;
  private _sceneSettingsService: SceneSettingsService;
  private _entityService: EntityService;
  private _actionItemService: ActionItemService;
  private _cameraService: CameraService;
  private _settings: CoreSettings;
  private render$: Subject<void> = new Subject();
  private _startedRendering = false;
  private renderSubscription$: Subscription;
  /* Controllers */
  public Product: ProductController = null;
  public Environment: EnvironmentController = null;
  public ActionItem: ActionItemController = null;
  public Animation: AnimationController = null;
  public Camera: CameraController = null;
  public Controls: ControlsController = null;
  public Light: LightController = null;
  public Scene: SceneController = null;
  private _lastClickEventTime: number;
  private _multiClickEventCounter: number = 0;
  
  /**
   * Creates core class that initializes engine and exposes funcionality through controllers
   * @param containerElement - Id or HTMLElement which is container for the application
   * @param resolverLocator - 
   * @param settings -
   */
  constructor(containerElement: string | HTMLElement, resolverLocator: ResolverLocator, settings: CoreSettingsObject) {
    if (!containerElement) {
      MVLogger.fatal(CoreError.InvalidParameterError, 'No html container id or element provided in Core constructor.');
    }
    let htmlContainer: HTMLElement = null;
    if (typeof containerElement === 'string') {
      htmlContainer = document.getElementById(containerElement);
      if (!htmlContainer) {
        MVLogger.fatal(CoreError.NotFound, `No html element with the provided id (${containerElement}) found`);
      }
    } else {
      htmlContainer = containerElement as HTMLElement;
    }
    MVLogger.showDebugLogs = settings.showDebugLogs ? true : false;
    const wrapper = document.createElement('div');
    wrapper.id = 'core-wrapper';
    wrapper.style.display = 'inline-block';
    wrapper.style.position = 'relative';
    wrapper.style.overflow = 'hidden';
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.padding = '0';
    wrapper.style.margin = '0';
    wrapper.style.border = '0';
    wrapper.style.fontSize = '0';
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    wrapper.appendChild(canvas);
    htmlContainer.prepend(wrapper);
    this._container = htmlContainer;
    this._canvas = canvas;
    this._wrapper = wrapper;
    this._inspectorState = false;
    // Register instances
    this.initializeEngineAndManagers();
    myContainer.unbindAll();
    myContainer.bind<Scene>(TYPES.Scene).toConstantValue(this._scene);
    myContainer.bind<CoreWraperElement>(TYPES.CoreWraperElement).toConstantValue(this._container);
    myContainer.bind<CoreCanvasElement>(TYPES.Canvas).toConstantValue(this._canvas);
    myContainer.bind<ResolverLocator>(TYPES.ResolverLocator).toConstantValue(resolverLocator);
    myContainer.bind<CoreSettings>(TYPES.CoreSettings).toConstantValue(new CoreSettings(settings, this._scene));
    myContainer.load(services, controlers);
    this._sceneOptimizer = myContainer.get<MVSceneOptimizerService>(TYPES.MVSceneOptimizerService);
    this._sceneSettingsService = myContainer.get<SceneSettingsService>(TYPES.SceneSettingsService);
    this._eventDispatcherService = myContainer.get<EventDispatcherService>(TYPES.EventDispatcherService);
    this._settings = myContainer.get<CoreSettings>(TYPES.CoreSettings);
    this._entityService = myContainer.get<EntityService>(TYPES.EntityService);
    this._actionItemService = myContainer.get<ActionItemService>(TYPES.ActionItemService);
    this._cameraService = myContainer.get<CameraService>(TYPES.CameraService);
    this.Camera = myContainer.get<CameraController>(TYPES.CameraController);
    this.Product = myContainer.get<ProductController>(TYPES.ProductController);
    this.Environment = myContainer.get<EnvironmentController>(TYPES.EnvironmentController);
    this.Animation = myContainer.get<AnimationController>(TYPES.AnimationController);
    this.Controls = myContainer.get<ControlsController>(TYPES.ControlsController);
    this.Light = myContainer.get<LightController>(TYPES.LightController);
    this.ActionItem = myContainer.get<ActionItemController>(TYPES.ActionItemController);
    this.Scene = myContainer.get<SceneController>(TYPES.SceneController);
    const platform = myContainer.get<PlatformService>(TYPES.PlatformService);

    this._engine.doNotHandleContextLost = true;
    this._scene.autoClear = false;
    this._scene.autoClearDepthAndStencil = false;

    // setting blockMaterialDirtyMechanism seems to be not necessary anymore because all materials are already manually frozen after creation
    // if (settings.productionMode) {
    //   this._scene.blockMaterialDirtyMechanism = true;
    // }

      this._engine.enableOfflineSupport = false;


    this.renderSubscription$ = this.render$
      .pipe(
        throttleTime(this._settings.dev.throttleRenderLoop),
        tap(() => {
          this._scene.render();
        }),
      )
      .subscribe({
        error: (err: Error) => {
          MVLogger.error(`There has been a problem with render stream: ${err}`);
        },
      });

    this._sceneOptimizer.init();
    this.registerEventListeners();
    this._eventDispatcherService.publish(MVEventTypes.onEngineReady, {});
  }
  /**
   * Init Engine and managers
   * @param useNullEngine - Null Engine is used for testing purposes only
   */
  private initializeEngineAndManagers(): void {
    const babylonEngine = this.createEngine();
    const babylonScene = this.createScene(babylonEngine);

    this._engine = babylonEngine;
    this._scene = babylonScene;
    this._scene['mv_cached_textures'] = {}

    // necessary for insector to work in Babylon version > 4.2
    window['gizmoManager'] = new GizmoManager(this._scene);
    this.startRender();
  }
  /**
   * Create new Engine
   */
  private createEngine(): Engine {
    return new Engine(this._canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });
  }
  /**
   * Create new Scene
   * @param babylonEngine -
   */
  private createScene(babylonEngine: Engine): Scene {
    return new Scene(babylonEngine);
  }
  /**
   * Register all event listeners
   */
  private registerEventListeners(): void {
    const resizeEvent = fromEvent(window, 'resize');
    // Avoid multiple calls on resize
    const debouncedResizeEvent = resizeEvent.pipe(debounceTime(100), takeUntil(onDestroy$));
    debouncedResizeEvent.subscribe(() => {
      // Update engine
      this.resize();
      // Update camera
      const cs = myContainer.get<CameraService>(TYPES.CameraService);
      const camera = cs.getActiveCamera();
      const shot = cs.getActiveCameraShot();
      if (shot) {
        // shot.activate(camera);
        cs.requestCameraShot(shot.id.replace('_mobile', ''), false);
      }
      this._actionItemService.updateActionItems();
    });
    if (this._settings.openInspectorWithKey) {
      const keyDownEvent = fromEvent(window, 'keydown');
      keyDownEvent.pipe(takeUntil(onDestroy$)).subscribe((key: KeyboardEvent) => {
        switch (key.code) {
          case this._settings.openInspectorWithKey: {
            this.toggleInspector();
            break;
          }
        }
      });
    }
    document.addEventListener('visibilitychange', async (event) => {
      if (document.hidden) {
        this._sceneOptimizer.resetHardwareScalingLevel();
        MVLogger.info('Document visibility changed to hidden');
      } else {
        MVLogger.info('Document visibility changed to visible');
        this._sceneOptimizer.restoreHardwareScalingLevel();
        if (this._settings.productionMode
          && this._entityService.activeProductEntity
          && !this._entityService._productUpdateInProgress
          && this._entityService.activeEnvironmentEntity
          && !this._entityService._environmentUpdateInProgress
          && this._cameraService.getActiveCameraShot()
        ) {
          const sceneReadyPromise = new Promise((resolve) => {
            this._scene.onReadyObservable.addOnce(() => {
              resolve(true);
            })
          });
      
          await sceneReadyPromise;

          await this.startRender();
          await this._entityService.freezeMaterialsAfterTimeout();
          this._entityService.freezeMeshes(0);
        }
      }
    });

    document.addEventListener('click', async (event) => {
      this.clickEventListener();
    });

    document.addEventListener('touchend', async (event) => {
      this.clickEventListener();
    });
  }

  private clickEventListener() {
    const currentTimeInMS = Date.now();
    if (!this._lastClickEventTime || currentTimeInMS - this._lastClickEventTime < 500) {
      this._multiClickEventCounter++;
      if (this._multiClickEventCounter >= 20) {
        MVLogger.debug('TOGGLE STATS');
        toggleStats(this._engine);
        this._multiClickEventCounter = 0;
      } else {
        const clicksUntilStatsToggle = 20 - this._multiClickEventCounter;
        MVLogger.debug(clicksUntilStatsToggle + ' more clicks until stats are toggled.');
      }
    
    } else {
      this._multiClickEventCounter = 1;
    }
    this._lastClickEventTime = currentTimeInMS;
  }

  /**
   * Resize viewer to container size or defined size
   * @param width -
   * @param height -
   */
  public resize(width?: number, height?: number): void {
    this._canvas.width = width || this._container.clientWidth;
    this._canvas.height = height || this._container.clientHeight;
    this._engine.resize();
  }
  /**
   * Start the render loop
   */
  public async startRender(options?: MVStartRenderOptions): Promise<void> {
    this._startedRendering = true;

    this._engine.runRenderLoop(() => {
      this.render$.next();
    });
    if (!document.hidden) {
      await removeScreenshot(options);   
    }
  }
  /**
   * Stop the render loop
   */
  public async stopRender(): Promise<void> {
    // this._engine.stopRenderLoop();
    await takeScreenshot(this._engine, this.Camera.getActiveCamera(), this._startedRendering);
  }

  /**
   * Displays the default BabylonJS loading UI.
   */
  public displayDefaultLoadingUi(): void {
    this._engine.displayLoadingUI();
  }
  /**
   * Hides the default BabylonJS loading UI.
   */
  public hideDefaultLoadingUi(): void {
    this._engine.hideLoadingUI();
  }
  /**
   * Toggle debug inspector
   */
  public toggleInspector(): void {
    this._inspectorState ? this._scene.debugLayer.hide() : this._scene.debugLayer.show({ enablePopup: false });
    this._inspectorState = !this._inspectorState;
  }
  /**
   * Toggle color lookup table if defined in core settings
   */
  public toggleLUT(): void {
    this._sceneOptimizer.toggleLUT();
  }

  public toggleGlowLayer(): void {
    this._sceneOptimizer.toggleGlowLayer();
  }

  public toggleLensFlareSystem(): void {
    this._sceneSettingsService.toggleLensFlareSystem();
  }

  /**
   * Destroys the WebGL context and cleans up all memory
   */
  public destroy(): void {
    this._engine.stopRenderLoop();
    this._scene.dispose();
    this._engine.dispose();
    this._wrapper.parentNode.removeChild(this._wrapper);
    onDestroy$.next();
  }
  /**
   * Get the Babylon Scene
   *
   */
  public getScene(): Scene {
    return this._scene;
  }

  public async updateMaterialMapping(
    entity: MVEntity,
    updatedMaterialMappingsJson: MVMaterialMappingsJson,
    originalMaterialName: string,
    relativeTargetMaterialUrl: string,
    slotName?: string
  ) {
    return this._entityService.updateMaterialMapping(entity, updatedMaterialMappingsJson, originalMaterialName, relativeTargetMaterialUrl, slotName); 
  }

  public getHardwareScalingLevel() {
    return this._engine.getHardwareScalingLevel();
  }

  public async freezeScene() {
    if (this._entityService._productUpdateInProgress || this._entityService._environmentUpdateInProgress || !this._cameraService.getActiveCameraShot()) {
      return;
    }

    this._scene.unfreezeActiveMeshes();
    this._entityService.unfreezeMaterials();

    this._sceneOptimizer.restoreHardwareScalingLevel();

    if (this._cameraService.getActiveCameraShot()) {
      await this._entityService.freezeMaterialsAfterTimeout(0);
      await this._entityService.freezeMeshes(500);
    }
  }
}
