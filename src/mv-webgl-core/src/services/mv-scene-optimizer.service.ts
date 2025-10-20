import {
    AbstractEngine,
    ColorGradingTexture,
    EventState,
    Mesh,
    Scene,
    SceneOptimization,
    SceneOptimizer,
    SceneOptimizerOptions,
    Texture,
} from 'babylonjs';
import { inject, injectable } from 'inversify';
import { interval, of, Subscription } from 'rxjs';
import { bufferCount, switchMap } from 'rxjs/operators';
import { SceneSettingsService } from '.';
import { detectMobileDevice, timeout } from '../helper';
import { MVHardwareScalingOptimization } from '../helper/scene-optimizers/MVHardwareScaling.optimization';
import { MVSceneOptimizer } from '../helper/scene-optimizers/MVSceneOptimizer';
import { TYPES } from '../ioc/types';
import { MVLogger } from '../logging';
import { PostProcessingConfiguration } from '../models/entity/interfaces';
import { CoreSettings } from '../settings';
import { PlatformService } from './platform.service';

/**
 * Class for Scene Optimizations
 */
@injectable()
export class MVSceneOptimizerService {
    private readonly _engine: AbstractEngine;
    private _postProcessingConfiguration: PostProcessingConfiguration;

    private _qualityOptimizer: SceneOptimizer;
    private _performanceOptimizer: SceneOptimizer;
    private _optimizerIsRunning: boolean;
    private _optimizationCheckSubscription: Subscription;

    private _interrupted: boolean = false;
    private _optimizeOnStillIsRunning: any = null;

    private _hardwareScalingLevel: number;
    private _freezeHardwareScalingLevel: boolean = false;

    /**
     * Creates MV Scene Optimizer
     * @param _scene -
     * @param _settings -
     */
    constructor(
        @inject(TYPES.Scene) private _scene: Scene,
        @inject(TYPES.CoreSettings) private _settings: CoreSettings,
        @inject(TYPES.PlatformService) private _platformService: PlatformService,
        @inject(TYPES.SceneSettingsService) private _sceneSettingsService: SceneSettingsService,
    ) {
        this._engine = this._scene.getEngine();
        if (this._settings.useDefaultRenderingPipeline) {
            this._sceneSettingsService.initRenderPipeline();
        }
    }

    /**
     * Initializes the SceneOptimizer with default options (FXAA)
     */
    public init(): void {
        this.initAntiAliasing();
        if (this._settings.logAvgFps) {
            window.setInterval(() => {
                MVLogger.info('FPS: ' + this._engine.getFps().toFixed());
            }, 5000);
        }

        if (this._settings.productionMode) {
            setInterval(() => {
                this._scene.cleanCachedTextureBuffer();
                this.clearCachedVertexData();
            }, 3000);
        }
    }

    public clearCachedVertexData(): void {
        for (var meshIndex = 0; meshIndex < this._scene.meshes.length; meshIndex++) {
            var mesh = this._scene.meshes[meshIndex];
            var geometry = (<Mesh>mesh).geometry;

            if (geometry && !mesh['isCollisionActor']) {
                geometry._indices = [];

                for (var vbName in geometry._vertexBuffers) {
                    if (!geometry._vertexBuffers.hasOwnProperty(vbName)) {
                        continue;
                    }
                    geometry._vertexBuffers[vbName]._buffer._data = null;
                }
            }
        }
    }

    /**
     * Initializes anti aliasing parameters
     * @param samples - (Default: 8)
     * @param fxaaEnabled - (Default: true)
     */
    private initAntiAliasing(
        samples: number = this._settings.antiAliasingSettings.samplesOnStill,
        fxaaEnabled: boolean = this._settings.antiAliasingSettings.fxaaEnabled,
    ): void {
        const renderPipeline = this._sceneSettingsService.getRenderPipeline();
        if (!renderPipeline) {
            return;
        }
        renderPipeline.samples = samples;
        renderPipeline.fxaaEnabled = fxaaEnabled;
        MVLogger.info('Device pixel ratio ' + window.devicePixelRatio);

        this._hardwareScalingLevel = this._settings.antiAliasingSettings?.hardwareScaling;
        if (this._hardwareScalingLevel) {
            this.setHardwareScalingLevel(this._hardwareScalingLevel);
        }
    }

    public initFPSBasedOptimizer(targetFrameRate: number, step: number) {
        const minHSL = this._settings.antiAliasingSettings.hardwareScalingMinimum;
        const maxHSL = this._settings.antiAliasingSettings.hardwareScalingMaximum;

        const qualityOptimizerOptions = new SceneOptimizerOptions(targetFrameRate, 1000);
        qualityOptimizerOptions.addOptimization(new MVHardwareScalingOptimization(0, -1, minHSL, maxHSL, step));

        this._qualityOptimizer = new MVSceneOptimizer(this._scene, qualityOptimizerOptions, true, true);
        this._qualityOptimizer.onNewOptimizationAppliedObservable.add(this.onNewOptimizationApplied.bind(this));
        this._qualityOptimizer.onSuccessObservable.add(this.onOptimizationDone.bind(this));
        this._qualityOptimizer.onFailureObservable.add(this.onOptimizationDone.bind(this));
        this._qualityOptimizer.start();

        const performanceyOptimizerOptions = new SceneOptimizerOptions(targetFrameRate, 1000);
        performanceyOptimizerOptions.addOptimization(new MVHardwareScalingOptimization(0, 1, minHSL, maxHSL, step));

        this._performanceOptimizer = new MVSceneOptimizer(this._scene, performanceyOptimizerOptions, true, false);
        this._performanceOptimizer.onNewOptimizationAppliedObservable.add(this.onNewOptimizationApplied.bind(this));
        this._performanceOptimizer.onSuccessObservable.add(this.onOptimizationDone.bind(this));
        this._performanceOptimizer.onFailureObservable.add(this.onOptimizationDone.bind(this));
    }

    private onNewOptimizationApplied(optimization: SceneOptimization, state: EventState) {
        MVLogger.debug('OnNewOptimizationApplied: ', this._engine.getHardwareScalingLevel());
        this._optimizerIsRunning = true;
    }

    private onOptimizationDone(optimization: SceneOptimizer, state: EventState) {
        this._hardwareScalingLevel = this._engine.getHardwareScalingLevel();
        MVLogger.debug('OnOptimizationDone: ', this._hardwareScalingLevel);
        this._optimizerIsRunning = false;
    }

    public async startFPSBasedOptimizer(keepOtimizing: boolean = true, _timeout?: number) {
        if (this._qualityOptimizer || this._performanceOptimizer) return;

        let isMobileDevice = false;
        try {
            isMobileDevice = detectMobileDevice();
        } catch (error) {
            MVLogger.error('Error trying to detect device');
        }

        let averageFps = this._engine.getFps();

        if (_timeout) {
            const steps = _timeout / 500;
            let fpsValues = [];
            for (let i = 0; i <= steps; i++) {
                fpsValues.push(this._engine.getFps());
                await timeout(500);
            }
            averageFps = fpsValues.reduce((a, b) => a + b) / fpsValues.length;
        }

        const hardwareScalingTargetFrameRate = this._settings.antiAliasingSettings.optimizationTargetFrameRate;
        const glowAndLensFlareTargetFrameRate = this._settings.antiAliasingSettings.fxTargetFrameRate;
        const renderPipeline = this._sceneSettingsService.getRenderPipeline();

        if (isMobileDevice && averageFps < glowAndLensFlareTargetFrameRate) {
            renderPipeline.glowLayerEnabled = false;
            this._sceneSettingsService.disableLensFlareSystem();
        }

        if (isMobileDevice && averageFps < hardwareScalingTargetFrameRate) {
            return;
        }

        MVLogger.debug(`Starting performance optimizer. (current FPS: ${averageFps.toFixed()})!`);

        const step = this._settings.antiAliasingSettings.automaticOptimizationStep;

        if (this._qualityOptimizer === undefined) {
            this.initFPSBasedOptimizer(hardwareScalingTargetFrameRate, step);
        } else {
            this._qualityOptimizer.targetFrameRate = hardwareScalingTargetFrameRate;
            this._performanceOptimizer.targetFrameRate = hardwareScalingTargetFrameRate;
        }

        if (this._optimizationCheckSubscription !== undefined) {
            this._optimizationCheckSubscription.unsubscribe();
            this._optimizationCheckSubscription = undefined;
        }

        if (keepOtimizing) {
            this._optimizationCheckSubscription = interval(1000)
                .pipe(
                    // filter(() => !this._optimizerIsRunning),
                    switchMap(() => of(Number(this._engine.getFps().toFixed()))),
                    bufferCount(5),
                    switchMap((vals: number[]) => {
                        const average = vals.reduce((a, b) => a + b) / vals.length;
                        return of(average);
                    }),
                )
                .subscribe((fps) => {
                    if (this._freezeHardwareScalingLevel) {
                        return;
                    }

                    const currentHardwareScalingLevel = this._scene.getEngine().getHardwareScalingLevel();
                    if (fps < hardwareScalingTargetFrameRate) {
                        MVLogger.debug(`Starting performance optimizer. (average FPS: ${fps})!`);
                        this._performanceOptimizer.start();
                    } else if (
                        currentHardwareScalingLevel !== this._settings.antiAliasingSettings.hardwareScalingMinimum &&
                        fps > hardwareScalingTargetFrameRate
                    ) {
                        MVLogger.debug(`Starting quality optimizer. (average FPS: ${fps})!`);
                        this._qualityOptimizer.start();
                    }

                    if (fps < glowAndLensFlareTargetFrameRate) {
                        renderPipeline.glowLayerEnabled = false;
                        this._sceneSettingsService.disableLensFlareSystem();
                    } else {
                        renderPipeline.glowLayerEnabled = true;
                        this._sceneSettingsService.lensFlareSystemEnabled = true;
                        this._sceneSettingsService.enableLensFlareSystem();
                    }
                });
        }
    }

    public freezeHardwareScalingLevel() {
        if (!this._qualityOptimizer || !this._performanceOptimizer) return;
        this._freezeHardwareScalingLevel = true;
    }

    public async unfreezeHardwareScalingLevel(timeoutInMS?: number) {
        if (!this._qualityOptimizer || !this._performanceOptimizer) return;
        if (timeoutInMS) await timeout(timeoutInMS);
        this._freezeHardwareScalingLevel = false;
    }

    public resetHardwareScalingLevel() {
        if (!this._qualityOptimizer || !this._performanceOptimizer) return;
        this.setHardwareScalingLevel(this._settings.antiAliasingSettings.hardwareScalingMaximum);
    }

    public async restoreHardwareScalingLevel(timeoutInMs?: number) {
        if (timeout) await timeout(timeoutInMs);
        if (!this._qualityOptimizer || !this._performanceOptimizer) return;
        this.setHardwareScalingLevel(this._hardwareScalingLevel);
    }

    /**
     * Initializes Postprocess parameters
     * @param postProcessingConfiguration -
     */
    public setupPostProcess(postProcessingConfiguration: PostProcessingConfiguration): void {
        const renderPipeline = this._sceneSettingsService.getRenderPipeline();

        if (!renderPipeline) {
            return;
        }
        renderPipeline.imageProcessing.colorGradingTexture = null;
        renderPipeline.imageProcessing.colorGradingEnabled = false;
        renderPipeline.imageProcessing.toneMappingEnabled = false;
        renderPipeline.glowLayerEnabled = true;
        renderPipeline.imageProcessingEnabled = true;
        this._postProcessingConfiguration = postProcessingConfiguration;
        const colorGradingTextureUrl = postProcessingConfiguration.colorGradingTextureUrl;
        if (colorGradingTextureUrl) {
            renderPipeline.imageProcessingEnabled = true;
            renderPipeline.imageProcessing.colorGradingEnabled = postProcessingConfiguration.colorGradingTextureEnabled;
            if (colorGradingTextureUrl.endsWith('.3DL') || colorGradingTextureUrl.endsWith('.3dl')) {
                renderPipeline.imageProcessing.colorGradingTexture = new ColorGradingTexture(
                    this._settings.assetsBaseUrl + colorGradingTextureUrl,
                    this._scene,
                );
            } else {
                renderPipeline.imageProcessing.colorGradingTexture = new Texture(
                    this._settings.assetsBaseUrl + colorGradingTextureUrl,
                    this._scene,
                    true,
                    false,
                    2,
                );
                renderPipeline.imageProcessing.imageProcessingConfiguration.colorGradingWithGreenDepth = false;
            }
        }
        renderPipeline.imageProcessing.toneMappingType = postProcessingConfiguration.toneMappingType;
        renderPipeline.imageProcessing.toneMappingEnabled = postProcessingConfiguration.toneMappingEnabled;
        renderPipeline.imageProcessingEnabled = postProcessingConfiguration
            ? postProcessingConfiguration.imagePostProcessingEnabled
            : false;
    }
    /**
     * Toggle color lookup table
     */
    public toggleLUT(): void {
        const renderPipeline = this._sceneSettingsService.getRenderPipeline();

        if (renderPipeline?.imageProcessing?.colorGradingTexture) {
            renderPipeline.imageProcessingEnabled = true;
            renderPipeline.imageProcessing.colorGradingEnabled = !renderPipeline.imageProcessing.colorGradingEnabled;
            renderPipeline.imageProcessingEnabled = this._postProcessingConfiguration?.imagePostProcessingEnabled;
        }
    }

    public toggleGlowLayer(): void {
        const renderPipeline = this._sceneSettingsService.getRenderPipeline();

        if (renderPipeline?.glowLayer) {
            renderPipeline.glowLayer.isEnabled = !renderPipeline.glowLayer.isEnabled;
        }
    }

    /**
     * Change optimization settings when camera starts to move
     */
    public async optimizeOnMove(): Promise<void> {
        const renderPipeline = this._sceneSettingsService.getRenderPipeline();

        if (renderPipeline) {
            renderPipeline.samples =
                this._engine.getHardwareScalingLevel() < 1 ? 1 : this._settings.antiAliasingSettings.samplesOnRotation;
            // this._interrupted = true;
            // if (this._optimizeOnStillIsRunning) {
            //   await this._optimizeOnStillIsRunning;
            // }
            // await removeScreenshot();
            // this._interrupted = false;
        }
    }

    private timeout(ms): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Change optimization settings when camera doesn't move
     */
    public async optimizeOnStill(): Promise<void> {
        const renderPipeline = this._sceneSettingsService.getRenderPipeline();

        if (renderPipeline) {
            renderPipeline.samples =
                this._engine.getHardwareScalingLevel() < 1 ? 1 : this._settings.antiAliasingSettings.samplesOnStill;

            // this._interrupted = false;
            // const previousHardwareScalingLevel = this._scene.getEngine().getHardwareScalingLevel();
            // this._optimizeOnStillIsRunning = new Promise<void>(async (resolve) => {
            //   this._renderPipeline.samples = this._settings.antiAliasingSettings.samplesOnStill;
            //   await takeScreenshot(this._engine, this._scene.activeCamera, true);
            //   if (this._interrupted) {
            //     return resolve();
            //   }
            //   this.setHardwareScalingLevel(0.25);
            //   await this.timeout(200);
            //   if (this._interrupted) {
            //     return this.setHardwareScalingLevel(previousHardwareScalingLevel);
            //   }
            //   await removeScreenshot();
            //   if (this._interrupted) {
            //     return this.setHardwareScalingLevel(previousHardwareScalingLevel);
            //   }
            //   await takeScreenshot(this._engine, this._scene.activeCamera, true);
            //   this.setHardwareScalingLevel(previousHardwareScalingLevel);
            //   return resolve();
            // });
            // await this._optimizeOnStillIsRunning;
            // this._optimizeOnStillIsRunning = null;
        }
    }

    public setHardwareScalingLevel(value: number) {
        console.debug('setting HWS to: ' + value);
        this._scene.getEngine().setHardwareScalingLevel(value);
    }
}
