import {
    BaseTexture,
    Color3,
    Color4,
    DefaultRenderingPipeline,
    InspectableType,
    Layer,
    LensFlare,
    Light,
    Matrix,
    Mesh,
    PointLight,
    Scene,
    Texture,
    TransformNode,
    Vector3
} from 'babylonjs';
import { inject, injectable } from 'inversify';
import { isBoolean, isColor3, isColor4, isNumber, isString } from '../helper';
import { TYPES } from '../ioc/types';
import { CoreError, MVLogger } from '../logging';
import {
    LensFlareSettings,
    LensFlareSystemSettings,
    MVEnvironmentConfig
} from '../models';
import { MVEnvironmentEntity } from '../models/entity/mv-environment-entity';
import { MVLensFlareSystem } from '../models/lens-flare/MVLensFlareSystem';
import { CoreSettings } from '../settings';
import { EntityService } from './entity.service';
import { TextureService } from './texture.service';

/**
 * The class for all Babylon related SceneSettings functionality
 */
@injectable()
export class SceneSettingsService {
    private _renderPipeline: DefaultRenderingPipeline;

    private _activeEnvironmentEntity: MVEnvironmentEntity;
    private _backdropImageLayer: Layer;
    private _lenseFlareSystem: MVLensFlareSystem;
    private _lenseFlareSystemEmitter: Light;
    public glowLayerEnabled: boolean = false;
    public lensFlareSystemEnabled: boolean = false;

    /**
     * Creates a new SceneSettingsService
     * @param _scene -
     * @param _textureService -
     * @param _sceneOptimizerService -
     */
    constructor(
        @inject(TYPES.Scene) private _scene: Scene,
        @inject(TYPES.TextureService) private _textureService: TextureService,
        @inject(TYPES.CoreSettings) private _coreSettings: CoreSettings,
        @inject(TYPES.CoreSettings) private _entityService: EntityService
    ) {}

    /**
     * Update all scene settings based on the current camera category
     * @param cameraCategory -
     * @param entity - Optional.
     */
    public async updateSceneSettings(
        cameraCategory: string,
        entity: MVEnvironmentEntity
    ): Promise<void> {
        const environmentConfig: MVEnvironmentConfig =
            entity.mv_environmentConfigs[cameraCategory];

        if (!environmentConfig) return;
        if (entity.activeEnvironmentCode == cameraCategory) return;

        const setupBackgroundImagesPromise = this.setupBackgroundImage(
            entity,
            environmentConfig
        );
        const setupEnvironmentTexturesPromise = this.setupEnvironmentTextures(
            entity,
            environmentConfig
        );
        await Promise.all([
            setupBackgroundImagesPromise,
            setupEnvironmentTexturesPromise
        ]);

        this._activeEnvironmentEntity = entity;

        entity.activeEnvironmentSceneSetting = environmentConfig;
        entity.activeEnvironmentCode = cameraCategory;

        for (const [key, value] of Object.entries(environmentConfig)) {
            if (key == 'glowLayerIntensity') {
                if (this._renderPipeline) {
                    const glowLayer = this._renderPipeline.glowLayer;
                    if (glowLayer) {
                        glowLayer.intensity = value as number;
                    }
                }
            } else if (key.toLowerCase().includes('background')) {
                await this.loadBackgroundImage(
                    entity.entityConfig.entityConfigBaseUrl +
                        entity.entityConfig.texturesUrlRelative,
                    value as string
                );
            } else if (isString(value) || isNumber(value) || isBoolean(value)) {
                // Handle string, number and boolean
                this._scene[key] = value;
            } else if (isColor4(value)) {
                // Handle Color 4
                const color = new Color4(value.r, value.g, value.b, value.a);
                this._scene[key] = color;
            } else if (isColor3(value)) {
                // Handle Color3
                const color = new Color3(value.r, value.g, value.b);
                this._scene[key] = color;
            } else if (key == 'environmentTexture') {
                // Handle textures
            } else {
                MVLogger.warn(
                    CoreError.InvalidParameterError,
                    `Property ${key} with value: ${value} Currently not supported. Value: `,
                    value
                );
            }
        }

        // this._scene.environmentIntensity = 2; //environmentConfig.environmentIntensity;

        await this.setupLensFlares(environmentConfig);
    }

    public disableLensFlareSystem() {
        if (this._lenseFlareSystem) {
            this._lenseFlareSystem.isEnabled = false;
        }
    }

    public enableLensFlareSystem() {
        if (this._lenseFlareSystem) {
            this._lenseFlareSystem.isEnabled = true;
        }
    }

    public async setupLensFlares(environmentConfig: MVEnvironmentConfig) {
        const lensFlareSystemSettings: LensFlareSystemSettings =
            environmentConfig.lensFlareSystem;

        if (
            lensFlareSystemSettings &&
            lensFlareSystemSettings.enabled &&
            !this._coreSettings.disableLensFlares
        ) {
            this.disposeLensFlareSystem();
            this.createLensFlareSystem(lensFlareSystemSettings);

            if (!this._lenseFlareSystem) return;

            const lensFlarePromises = [];
            let index = 0;
            lensFlareSystemSettings.lensFlares.forEach(
                (flareSetting: LensFlareSettings) => {
                    lensFlarePromises.push(
                        this.addFlareToLenseFlareSystem(flareSetting, index)
                    );
                    index++;
                }
            );
            await Promise.all(lensFlarePromises);
        } else {
            this.disposeLensFlareSystem();
        }
    }

    public disposeLensFlareSystem() {
        this.lensFlareSystemEnabled = false;
        if (this._lenseFlareSystem) {
            this._lenseFlareSystem.dispose();
            this._lenseFlareSystem = null;
        }
        if (this._lenseFlareSystemEmitter) {
            this._lenseFlareSystemEmitter.dispose();
            this._lenseFlareSystemEmitter = null;
        }
    }

    public createLensFlareSystem(
        lensFlareSystemSettings: LensFlareSystemSettings
    ) {
        const lightEmitterPosition = new Vector3(
            lensFlareSystemSettings.lightEmitterPosition.x,
            lensFlareSystemSettings.lightEmitterPosition.y,
            lensFlareSystemSettings.lightEmitterPosition.z
        );

        this._lenseFlareSystemEmitter = new PointLight(
            'lensFlareSystemEmitter',
            lightEmitterPosition,
            this._scene
        );
        this._lenseFlareSystemEmitter.intensity = 0;
        this._lenseFlareSystemEmitter.shadowEnabled = false;
        this._lenseFlareSystemEmitter['lensFlareSystemIntensity'] =
            lensFlareSystemSettings.intensity;
        this._lenseFlareSystemEmitter.inspectableCustomProperties = [
            {
                label: 'Lens Flare Intensity',
                propertyName: 'lensFlareSystemIntensity',
                type: InspectableType.Slider,
                min: 0,
                max: 4
            }
        ];

        this._lenseFlareSystem = new MVLensFlareSystem(
            'lensFlareSystem',
            this._lenseFlareSystemEmitter,
            this._scene,
            lensFlareSystemSettings.intensity
        );
        this.lensFlareSystemEnabled = true;
    }

    public async addFlareToLenseFlareSystem(
        flareSetting: LensFlareSettings,
        index: number
    ) {
        const lensFlareColor = new Color3(
            flareSetting.color.r,
            flareSetting.color.g,
            flareSetting.color.b
        );
        const imgUrl =
            this._coreSettings.assetsBaseUrl + flareSetting.textureUrl;

        const lensFlare = new LensFlare(
            flareSetting.size,
            flareSetting.position,
            lensFlareColor,
            imgUrl,
            this._lenseFlareSystem
        );

        lensFlare['flareIntensity'] = flareSetting.intensity
            ? flareSetting.intensity
            : 1;

        const lensFlareHelperNode = new TransformNode(`flare_${index}`);
        lensFlareHelperNode['lensFlare'] = lensFlare;
        lensFlareHelperNode['flareIntensity'] = lensFlare['flareIntensity'];
        lensFlareHelperNode['flareSize'] = flareSetting.size;
        lensFlareHelperNode['flarePosition'] = flareSetting.position;
        lensFlareHelperNode['flareColor'] = lensFlareColor;

        lensFlareHelperNode.inspectableCustomProperties = [
            {
                label: 'Flare Intensity',
                propertyName: 'flareIntensity',
                type: InspectableType.Slider
            },
            {
                label: 'Flare Size',
                propertyName: 'flareSize',
                type: InspectableType.Slider
            },
            {
                label: 'Flare Position',
                propertyName: 'flarePosition',
                type: InspectableType.Slider
            },
            {
                label: 'Flare Color',
                propertyName: 'flareColor',
                type: InspectableType.Color3
            }
        ];

        lensFlareHelperNode.parent = this._lenseFlareSystemEmitter;

        (lensFlare.texture as any)['isLensFlareTexture'] = true;

        return lensFlare;
    }

    public toggleLensFlareSystem() {
        if (this._lenseFlareSystem) {
            this._lenseFlareSystem.isEnabled =
                !this._lenseFlareSystem.isEnabled;
        }
    }

    public async setupEnvironmentTextures(
        entity: MVEnvironmentEntity,
        environmentConfig: MVEnvironmentConfig
    ): Promise<void> {
        if (entity !== this._activeEnvironmentEntity) {
            // Remove previous environment textures and load all new ones after switching environments

            const loadEnvironmentTexturePromises: Promise<BaseTexture | null>[] =
                [];
            const environmentTextureUrls: string[] = [];
            if (entity.environmentTextures.length == 0) {
                for (const [configId, config] of Object.entries(
                    entity.mv_environmentConfigs
                )) {
                    const environmentTextureConfig = config.environmentTexture;
                    if (
                        configId !== 'undefined' &&
                        environmentTextureConfig &&
                        !environmentTextureUrls.includes(
                            environmentTextureConfig.name
                        )
                    ) {
                        environmentTextureUrls.push(
                            environmentTextureConfig.name
                        );
                        loadEnvironmentTexturePromises.push(
                            this.loadEnvironmentTexture(entity, config)
                        );
                    }
                }
                entity.environmentTextures = (await Promise.all(
                    loadEnvironmentTexturePromises
                )) as any;
            }
        }

        const environmentTexture = entity.environmentTextures.find((t) => {
            return t.name == environmentConfig.environmentTexture?.name;
        });
        if (!environmentTexture) return;

        this._scene.environmentTexture = environmentTexture;
    }

    public async loadEnvironmentTexture(
        entity: MVEnvironmentEntity,
        environmentConfig: MVEnvironmentConfig
    ): Promise<BaseTexture | null> {
        if (!environmentConfig.environmentTexture) {
            return null;
        }
        const textureBaseUrl =
            entity.entityConfig.entityConfigBaseUrl +
            entity.entityConfig.texturesUrlRelative;
        const texture: BaseTexture | null =
            await this._textureService.createOrGetTextureFromConfig(
                environmentConfig.environmentTexture,
                textureBaseUrl
            );
        (texture as any)['mv_isEnvironmentTexture'] = true;
        (texture as any).setReflectionTextureMatrix(
            Matrix.RotationY(
                (environmentConfig.environmentTexture as any).rotationY
            )
        );
        return texture;
    }

    public async setupBackgroundImage(
        entity: MVEnvironmentEntity,
        environmentConfig: MVEnvironmentConfig
    ): Promise<void> {
        // TODO preload int and ext backgrounds

        const previousBackgroundImageUrl = this._backdropImageLayer?.name;
        const nextBackgroundImageUrl = environmentConfig?.backgroundImageUrl;

        if (previousBackgroundImageUrl == nextBackgroundImageUrl) {
            return;
        }

        this.removeBackgroundImage();
        if (nextBackgroundImageUrl) {
            this._backdropImageLayer = await this.loadBackgroundImage(
                entity.entityConfig.entityConfigBaseUrl +
                    entity.entityConfig.texturesUrlRelative,
                nextBackgroundImageUrl
            );
        }
    }

    /**
     * Removes the background image
     */
    public removeBackgroundImage(): void {
        if (this._scene.layers) {
            this._scene.layers.forEach((layer: Layer) => {
                layer.dispose();
            });
        }

        this._scene.layers = [];
    }

    /**
     * Set a new background image
     * @param baseUrl -
     * @param relativeTextureUrl -
     */
    public loadBackgroundImage(
        baseUrl: string,
        relativeTextureUrl: string
    ): Promise<Layer> {
        return new Promise((resolve: any, reject: any) => {
            const backdrop = new Layer(
                'backdrop_' + relativeTextureUrl,
                baseUrl + relativeTextureUrl,
                this._scene
            );
            (backdrop.texture as Texture).onLoadObservable.addOnce(() => {
                backdrop.name = relativeTextureUrl;
                backdrop.isBackground = true;
                if (backdrop.texture) {
                    backdrop.texture.level = 0;
                }
                (backdrop.texture as any)['mv_isBackdrop'] = true;
                resolve(backdrop);
            });
        });
    }

    public getBackdropImageLayer() {
        return this._backdropImageLayer;
    }

    public updateLensFlareSystemIntensity(intensity: number) {
        if (this._lenseFlareSystem) {
            this._lenseFlareSystem.lensFlareInstensity = intensity;
        }
    }

    public getRenderPipeline() {
        return this._renderPipeline;
    }

    public initRenderPipeline() {
        this._renderPipeline = new DefaultRenderingPipeline(
            'DefaultRenderingPipeline',
            true,
            this._scene
        );
        this._renderPipeline.glowLayerEnabled = true;
    }

    public addMeshToGlowLayer(mesh: Mesh) {
        this._renderPipeline.glowLayer?.addIncludedOnlyMesh(mesh);
    }
}
