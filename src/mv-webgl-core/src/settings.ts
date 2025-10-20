import { Scene } from 'babylonjs';
import { detectMobileDevice } from './helper';
import { CoreError, MVLogger } from './logging';

/**
 * Class that contains Core settings
 */
export class CoreSettings {
    public logAvgFps: boolean;
    public assetsBaseUrl: string;
    public productionMode: boolean = false;
    public dev: {
        throttleRenderLoop: number;
    } = {
        throttleRenderLoop: 0,
    };
    public antiAliasingSettings: AntiAliasingSettings = {
        fxaaEnabled: true,
        samplesOnStill: 8,
        samplesOnRotation: 1,
        hardwareScaling: 1,
        hardwareScalingMinimum: 0.33,
        hardwareScalingMaximum: 1,
        automaticOptimization: 0,
        automaticOptimizationStep: 0.1,
        optimizationTargetFrameRate: 20,
        fxTargetFrameRate: -1,
    };

    public openInspectorWithKey?: string;
    public useMobileAssets: boolean = false;
    public useDefaultRenderingPipeline: boolean = true;
    public disableLightmaps: boolean = false;
    public enableLazyLoading: boolean = false;
    public disableLensFlares: boolean = false;

    /**
     * Initialize new CoreSettings
     * @param obj - Object that defines core instance setup -
     */
    constructor(obj: CoreSettingsObject, scene: Scene) {
        if (!obj?.assetsBaseUrl) {
            throw new Error(CoreError.InvalidParameterError);
        }

        if (obj?.disableLightmaps) {
            this.disableLightmaps = obj.disableLightmaps;
        }

        if (obj?.disableLensFlares) {
            this.disableLensFlares = true;
        }

        this.logAvgFps = obj.logAvgFps ? obj.logAvgFps : false;
        this.assetsBaseUrl = obj.assetsBaseUrl;
        if (obj.productionMode) {
            MVLogger.info('Production mode enabled');
            this.productionMode = true;
        }

        this.antiAliasingSettings.fxaaEnabled =
            obj.antiAliasingSettings && obj.antiAliasingSettings.fxaaEnabled
                ? obj.antiAliasingSettings.fxaaEnabled
                : this.antiAliasingSettings.fxaaEnabled;
        this.antiAliasingSettings.samplesOnRotation =
            obj.antiAliasingSettings && obj.antiAliasingSettings.samplesOnRotation
                ? obj.antiAliasingSettings.samplesOnRotation
                : this.antiAliasingSettings.samplesOnRotation;
        this.antiAliasingSettings.samplesOnStill =
            obj.antiAliasingSettings && obj.antiAliasingSettings.samplesOnStill
                ? obj.antiAliasingSettings.samplesOnStill
                : this.antiAliasingSettings.samplesOnStill;
        this.antiAliasingSettings.hardwareScaling =
            obj.antiAliasingSettings && obj.antiAliasingSettings.hardwareScaling
                ? obj.antiAliasingSettings.hardwareScaling
                : this.antiAliasingSettings.hardwareScaling;
        this.antiAliasingSettings.hardwareScalingMinimum =
            obj.antiAliasingSettings && obj.antiAliasingSettings.hardwareScalingMinimum
                ? obj.antiAliasingSettings.hardwareScalingMinimum
                : this.antiAliasingSettings.hardwareScalingMinimum;
        this.antiAliasingSettings.hardwareScalingMaximum =
            obj.antiAliasingSettings && obj.antiAliasingSettings.hardwareScalingMaximum
                ? obj.antiAliasingSettings.hardwareScalingMaximum
                : this.antiAliasingSettings.hardwareScalingMaximum;
        this.antiAliasingSettings.automaticOptimization =
            obj.antiAliasingSettings && obj.antiAliasingSettings.automaticOptimization
                ? obj.antiAliasingSettings.automaticOptimization
                : this.antiAliasingSettings.automaticOptimization;
        this.antiAliasingSettings.automaticOptimizationStep =
            obj.antiAliasingSettings && obj.antiAliasingSettings.automaticOptimizationStep
                ? obj.antiAliasingSettings.automaticOptimizationStep
                : this.antiAliasingSettings.automaticOptimizationStep;
        this.antiAliasingSettings.optimizationTargetFrameRate =
            obj.antiAliasingSettings && obj.antiAliasingSettings.optimizationTargetFrameRate
                ? obj.antiAliasingSettings.optimizationTargetFrameRate
                : this.antiAliasingSettings.optimizationTargetFrameRate;
        this.antiAliasingSettings.fxTargetFrameRate =
            obj.antiAliasingSettings && obj.antiAliasingSettings.fxTargetFrameRate
                ? obj.antiAliasingSettings.fxTargetFrameRate
                : this.antiAliasingSettings.fxTargetFrameRate;

        if (obj.openInspectorWithKey) {
            this.openInspectorWithKey = obj.openInspectorWithKey;
        }

        if (obj.useDefaultRenderingPipeline == false) {
            this.useDefaultRenderingPipeline = false;
        }

        let isMobileDevice = false;
        try {
            isMobileDevice = detectMobileDevice();
        } catch (error) {
            MVLogger.error('Error trying to detect device');
        }
        if (isMobileDevice) {
            MVLogger.info('Mobile device detected');

            if (obj.enableLazyLoadingOnMobile) {
                MVLogger.info('Lazy loading enabled');
                this.enableLazyLoading = true;
            }
        } else {
            MVLogger.info('Non-mobile device detected');

            if (obj.enableLazyLoadingOnDesktop) {
                MVLogger.info('Lazy loading enabled');
                this.enableLazyLoading = true;
            }
        }
        let webGLVersion = 1;
        const engine = scene.getEngine(); // Get your Babylon engine instance
        const gl = (engine as any)._gl; // Access the private raw WebGL context

        if (gl instanceof WebGL2RenderingContext) {
            webGLVersion = 2;
        }
        if (obj.useMobileAssets || isMobileDevice || webGLVersion < 2) {
            this.useMobileAssets = true;

            const devicePixelRatio = window?.devicePixelRatio ? window.devicePixelRatio : 1;
            let hardwareScalingMultiplyFactor = obj?.mobileAntiAliasingSettings?.hardwareScalingMultiplyFactor
                ? obj.mobileAntiAliasingSettings.hardwareScalingMultiplyFactor
                : 1;

            let hardwareScalingLevel = 1 / devicePixelRatio;

            MVLogger.info('Using mobile assets');
            this.antiAliasingSettings.fxaaEnabled = obj.mobileAntiAliasingSettings
                ? obj.mobileAntiAliasingSettings.fxaaEnabled
                : this.antiAliasingSettings.fxaaEnabled;
            this.antiAliasingSettings.samplesOnRotation = obj.mobileAntiAliasingSettings
                ? obj.mobileAntiAliasingSettings.samplesOnRotation
                : this.antiAliasingSettings.samplesOnRotation;
            this.antiAliasingSettings.samplesOnStill = obj.mobileAntiAliasingSettings
                ? obj.mobileAntiAliasingSettings.samplesOnStill
                : 4;
            this.antiAliasingSettings.samplesOnStill = obj.mobileAntiAliasingSettings
                ? obj.mobileAntiAliasingSettings.samplesOnStill
                : this.antiAliasingSettings.samplesOnStill;

            this.antiAliasingSettings.hardwareScalingMinimum = hardwareScalingLevel;

            this.antiAliasingSettings.hardwareScalingMaximum = hardwareScalingMultiplyFactor * hardwareScalingLevel;

            if (obj.mobileAntiAliasingSettings?.hardwareScalingMaximum) {
                this.antiAliasingSettings.hardwareScalingMaximum = Math.max(
                    this.antiAliasingSettings.hardwareScalingMaximum,
                    obj.mobileAntiAliasingSettings.hardwareScalingMaximum,
                );
            }

            if (obj.mobileAntiAliasingSettings?.hardwareScalingMultiplyFactorMax) {
                this.antiAliasingSettings.hardwareScalingMaximum =
                    hardwareScalingLevel *
                    hardwareScalingMultiplyFactor *
                    obj.mobileAntiAliasingSettings.hardwareScalingMultiplyFactorMax;
            }

            if (obj.mobileAntiAliasingSettings?.hardwareScalingMulitplyFactorMin) {
                this.antiAliasingSettings.hardwareScalingMinimum =
                    hardwareScalingLevel *
                    hardwareScalingMultiplyFactor *
                    obj.mobileAntiAliasingSettings.hardwareScalingMulitplyFactorMin;
            }

            this.antiAliasingSettings.optimizationTargetFrameRate =
                obj.mobileAntiAliasingSettings && obj.mobileAntiAliasingSettings.optimizationTargetFrameRate
                    ? obj.mobileAntiAliasingSettings.optimizationTargetFrameRate
                    : this.antiAliasingSettings.optimizationTargetFrameRate;

            this.antiAliasingSettings.fxTargetFrameRate =
                obj.mobileAntiAliasingSettings && obj.mobileAntiAliasingSettings.fxTargetFrameRate
                    ? obj.mobileAntiAliasingSettings.fxTargetFrameRate
                    : this.antiAliasingSettings.fxTargetFrameRate;

            this.antiAliasingSettings.automaticOptimization =
                obj.mobileAntiAliasingSettings && obj.mobileAntiAliasingSettings.automaticOptimization !== undefined
                    ? obj.mobileAntiAliasingSettings.automaticOptimization
                    : this.antiAliasingSettings.automaticOptimization;

            this.antiAliasingSettings.automaticOptimizationStep =
                obj.mobileAntiAliasingSettings && obj.mobileAntiAliasingSettings.automaticOptimizationStep !== undefined
                    ? obj.mobileAntiAliasingSettings.automaticOptimizationStep
                    : this.antiAliasingSettings.automaticOptimizationStep;

            if (obj.mobileAntiAliasingSettings?.adaptToDevicePixelRatio) {
                this.antiAliasingSettings.hardwareScaling = this.antiAliasingSettings.hardwareScalingMaximum;
            } else {
                this.antiAliasingSettings.hardwareScaling = obj.mobileAntiAliasingSettings?.hardwareScaling
                    ? obj.mobileAntiAliasingSettings.hardwareScaling
                    : 0.8;
            }

            if (obj.useDefaultRenderingPipelineOnMobile == false) {
                this.useDefaultRenderingPipeline = false;
            }

            if (obj.disableLensFlaresOnMobile) {
                this.disableLensFlares = true;
            }
        }
    }
}

export interface CoreSettingsObject {
    // Defines if FPS should be logged to the browser console
    logAvgFps?: boolean;
    // Base Url where all WebGL assets are supposed to be loaded from
    assetsBaseUrl: string;
    // Enabeling production mode activates multiple optimizations and faster loading times.
    // E.g. freezing meshes and materials after the initial load is enabled.
    // doc.babylonjs.com/divingDeeper/scene/optimize_your_scene
    productionMode?: boolean;
    // Defines if debug logs should be displayed in the console. False by default.
    // Development related properties
    dev?: {
        // Throttle in milliseconds, defaults to 0ms
        throttleRenderLoop: number;
    };
    showDebugLogs?: boolean;
    // post processing options for non mobile devices
    postProcessingOptions?: PostProcessingOptions;
    // post processing options for mobile devices
    mobilePostProcessingOptions?: PostProcessingOptions;
    // anti aliasing settings for non mobile devices
    antiAliasingSettings?: AntiAliasingSettings;
    // mobile anti aliasing settings for mobile devices
    mobileAntiAliasingSettings?: AntiAliasingSettings;
    // Key used to open the inspector with
    openInspectorWithKey?: string;
    // if true the mobile version of the textures is loaded if it exists
    useMobileAssets?: boolean;
    // if false default rendering pipeline will not be used
    useDefaultRenderingPipeline?: boolean;
    // if false default rendering pipeline will not be used on mobile devices
    useDefaultRenderingPipelineOnMobile?: boolean;
    // Deprecated workflow. The WebGL Core supports loading AO textures (= lightmaps) if these exist.
    // Enabling this option disalbles loading existing lightmaps/AO maps.
    disableLightmaps?: boolean;
    // Enableling this option loads all assets of an entity during the initial load.
    // The default option is to only fetch the current configuration and to load additional assets only if requests during a configuration update.
    // Lazy loading/ pre-loading has the benefit of faster configuration updates.
    enableLazyLoadingOnDesktop?: boolean;
    // Enableling this option loads all assets of an entity during the initial load on mobile devices.
    // The default option is to only fetch the current configuration and to load additional assets only if requests during a configuration update.
    // Lazy loading/ pre-loading has the benefit of faster configuration updates.
    enableLazyLoadingOnMobile?: boolean;
    // This option disabled lens flares.
    // Even if this flat is not used lens flares only show up if they are defined in the environment_config.json file of the active environment.
    disableLensFlares?: boolean;
    // This option disabled lens flares on mobile devices (useful to save performance).
    // Even if this flat is not used lens flares only show up if they are defined in the environment_config.json file of the active environment.
    disableLensFlaresOnMobile?: boolean;
}

export interface AntiAliasingSettings {
    fxaaEnabled: boolean;
    /**
     * Render samples when the camera is standing still
     */
    samplesOnStill: number;
    /**
     * Render samples when the camera is rotating
     */
    samplesOnRotation: number;
    /**
     * Hardware Scaling is used to increase the render resolution.
     * This is mainly needed for mobile devices because the css canvas resolution can be smaller than the actual device resolution if the devices as a device pixel ratio different to 1.
     * A hardware scaling value of 0.5 doubles the render resolution.
     * A hardware scaling value of 2 cuts the render resolution by half.
     */
    hardwareScaling?: number;
    /**
     * Defines if the application should adapt the hardware scaling value depending on the pixel ratio of the current device.
     * This is useful for better render quality on mobile devices.
     * If the device pixel ratio is 2 the hardware scaling is automatically set to 0.5.
     * hardwareScalingValue = (1 / devicePixelRatio) * hardwareScalingMultiplyFactor
     */
    adaptToDevicePixelRatio?: boolean;
    /**
     * Value multiplied to the calculated hardware scaling value.
     * Defaults to 1.
     */
    hardwareScalingMultiplyFactor?: number;
    /*
     * Tries to automatically optimize the hardware scaling value for best performance and/or quality
     * 2: Optimization on product load with continuous optimization afterwards (Default)
     * 1: One time optimization on product load
     * 0: No automatic optimization at all (default)
     */
    automaticOptimization?: 2 | 1 | 0;
    /**
     * Hardware Scaling is sequentially decreased or increased by this step value if automatic optimization is active.
     * Default is 0.1
     */
    automaticOptimizationStep?: number;
    /**
     * This value is only relevant if automatic optimization is active.
     * The Max Factor is used for the initial hardware optimization value which is sequentially increased if the frame rate is high enough.
     */
    hardwareScalingMultiplyFactorMax?: number;
    /**
     * This value is only relevant if automatic optimization is active.
     * The Min Factor defines the limit of the hardware scaling value used by automatic optimization.
     */
    hardwareScalingMulitplyFactorMin?: number;
    /**
     * Minimum hardware scaling value to prevent crashes if automatic optimization is active.
     */
    hardwareScalingMinimum?: number;
    /**
     * Maximum hardware scaling value to ensure minimal quality if automatic optimization is active.
     */
    hardwareScalingMaximum?: number;
    /**
     * Target frame rate used to increse render settings if automatic optimization is active.
     */
    optimizationTargetFrameRate?: number;
    /**
     * Target frame rate for lens flares and glow layer effects. Default is 10.
     */
    fxTargetFrameRate?: number;
}

export interface PostProcessingOptions {
    imagePostProcessingEnabled: boolean;
    glowLayerEnabled: boolean;
    colorGradingTextureUrl: string;
    colorGradingTextureEnabled: boolean;
    toneMappingType: number;
    toneMappingEnabled: boolean;
}
