import {
    AbstractMesh,
    AnimationGroup,
    AssetContainer,
    BaseTexture,
    InspectableType,
    Material,
    Mesh,
    Node,
    NodeMaterial,
    Scene,
    Texture,
    TransformNode,
    VertexBuffer
} from 'babylonjs';
import { inject, injectable } from 'inversify';
import { Subject } from 'rxjs';
import {
    AssetContainerResult,
    disposeLayer,
    disposeUnusedMaterialsAndTextures,
    freezeMaterials,
    getChildNodeById,
    getTextureKeyFromJson,
    getTextureKeyFromUrl,
    isTransparentMaterial,
    jsonToTexture,
    jsonToTextureParams,
    loadJson,
    rebuildMaterials,
    removeLight,
    TEXTURE_PROPERTIES,
    timeout,
    unfreezeMaterials,
    waitForSceneReady
} from '../helper';
import { FileType } from '../helper/file-types.helper';
import { TYPES } from '../ioc/types';
import { CoreError, MVLogger } from '../logging';
import { PlayAnimationOptions, TextureAndMaterialUrls } from '../models';
import { MVAnimation } from '../models/animation/MVAnimation';
import {
    MVMaterialMappingsJson,
    MVRuleEngineTypes
} from '../models/configuration/interfaces';
import {
    MVAnimationMetaData,
    MVEntityConfig,
    MVMeshSetting,
    MVMeshSettingsJson,
    MVProductionMeshSettingsJson
} from '../models/entity/interfaces';
import { MVEntity } from '../models/entity/mv-entity';
import { MVEnvironmentEntity } from '../models/entity/mv-environment-entity';
import { MVLayer } from '../models/entity/mv-layer';
import { MVProductEntity } from '../models/entity/mv-product-entity';
import { MVMaterial, TextureJSON } from '../models/material';
import { MVMaterialMapping } from '../models/material/mv-material-mapping';
import { CoreSettings } from '../settings';
import { AssetLoaderService } from './asset-loader.service';
import { ConfigurationService } from './configuration.service';
import { LightService } from './light.service';
import { MaterialService } from './material.service';
import { MeshService } from './mesh.service';
import { SceneSettingsService } from './scene-settings.service';
import { TextureService } from './texture.service';
// import asyncPool from "tiny-async-pool";

/**
 * The class for all Babylon related Entity functionality
 */

@injectable()
export class EntityService {
    public _entities: MVEntity[] = [];
    public activeEnvironmentEntity: MVEnvironmentEntity;
    public activeProductEntity: MVProductEntity;
    public _productUpdateInProgress = true;
    public _environmentUpdateInProgress = true;

    /**
     * Creates a new EntityService
     * @param scene -
     */
    constructor(
        @inject(TYPES.Scene) private _scene: Scene,
        @inject(TYPES.ConfigurationService)
        private _configurationService: ConfigurationService,
        @inject(TYPES.MeshService) private _meshService: MeshService,
        @inject(TYPES.AssetLoaderService)
        private _assetLoader: AssetLoaderService,
        @inject(TYPES.LightService) private _lightService: LightService,
        @inject(TYPES.MaterialService)
        private _materialService: MaterialService,
        @inject(TYPES.SceneSettingsService)
        private _sceneSettingsService: SceneSettingsService,
        @inject(TYPES.CoreSettings) private _coreSettings: CoreSettings,
        @inject(TYPES.TextureService) private _textureService: TextureService
    ) {}

    public async loadAnimation(
        entity: MVEntity,
        animationMetaData: MVAnimationMetaData
    ): Promise<void> {
        const animationsPath = entity.entityConfig.entityConfigBaseUrl;
        let animationGroups: AnimationGroup[];
        try {
            animationGroups = await this._assetLoader.loadAnimationGroups(
                animationsPath,
                animationMetaData.fileUrl,
                entity
            );
        } catch (error) {
            MVLogger.error(`Failed loading animation ${animationMetaData.id}`);
        }
        animationGroups?.forEach((animationGroup: AnimationGroup) => {
            let animationId = animationGroup.name.split('|')[0];
            if (animationMetaData.id) {
                animationId = animationMetaData.id;
            }
            const clonedAnimationGroup = animationGroup.clone(
                animationId,
                (oldTarget: any) => {
                    let targetNode;
                    if (oldTarget?.id) {
                        targetNode = getChildNodeById(
                            entity.rootNode,
                            oldTarget.id
                        );
                    }
                    return targetNode;
                }
            );
            // By default animations should not loop
            clonedAnimationGroup.loopAnimation = false;
            entity.addAnimation(
                new MVAnimation(
                    clonedAnimationGroup,
                    animationMetaData.speedRatio
                )
            );
            animationGroup.dispose();
        });
    }

    public async setupAnimations(entity: MVEntity): Promise<void> {
        const promises = [];
        if (
            entity.entityConfig.animations &&
            entity.entityConfig.animations.length > 0
        ) {
            entity.entityConfig?.animations?.forEach(
                (animationMetaData: MVAnimationMetaData) => {
                    promises.push(
                        this.loadAnimation(entity, animationMetaData)
                    );
                }
            );
        }
        await Promise.all(promises);
    }

    /**
     * Load the rig of the entity
     */
    public async loadRig(entity: MVEntity): Promise<void> {
        // Load Rig
        if (!entity.entityConfig.rigUrlRelative) {
            entity.rootNode = new Mesh(entity.name);
            entity.rig = [entity.rootNode];
        } else {
            try {
                entity.rig = await this._assetLoader.loadRig(
                    entity.entityConfig.entityConfigBaseUrl,
                    entity.entityConfig.rigUrlRelative
                );
                entity.rig.forEach((node: Node) => {
                    if (node.id === '__root__') {
                        // Set entity rootNode and rename to entity uuid.
                        node.id = entity.uuid;
                        node.name = entity.uuid;
                        entity.rootNode = node;
                        entity.rig = [entity.rootNode];
                    }
                });
            } catch (error) {
                MVLogger.error(
                    `Failed loading rig ${entity.entityConfig.entityConfigBaseUrl}${entity.entityConfig.rigUrlRelative}`
                );
            }
        }
    }

    public mv_loadConfigs(entity: MVEntity): void {
        entity.texturesBaseUrl =
            entity.entityConfig.entityConfigBaseUrl +
            entity.entityConfig.texturesUrlRelative;
        if (
            this._coreSettings.useMobileAssets &&
            entity.entityConfig.mobileTexturesUrlRelative
        ) {
            entity.texturesBaseUrl =
                entity.entityConfig.entityConfigBaseUrl +
                entity.entityConfig.mobileTexturesUrlRelative;
        }
        entity.meshesUrlRelative = entity.entityConfig.meshesUrlRelative;
        if (
            this._coreSettings.productionMode &&
            entity.entityConfig.productionMeshesUrlRelative
        ) {
            entity.meshesUrlRelative =
                entity.entityConfig.productionMeshesUrlRelative;
        }
        entity.meshesBaseUrl =
            entity.entityConfig.entityConfigBaseUrl + entity.meshesUrlRelative;

        if (entity.entityConfig.lightmapTexturesUrlRelative) {
            entity.lightmapTexturesUrlRelative =
                entity.entityConfig.lightmapTexturesUrlRelative;
            if (
                this._coreSettings.useMobileAssets &&
                entity.entityConfig.mobileLightmapTexturesUrlRelative
            ) {
                entity.lightmapTexturesUrlRelative =
                    entity.entityConfig.mobileLightmapTexturesUrlRelative;
            }

            entity.lightmapArrayJSON =
                this._coreSettings.useMobileAssets &&
                entity.entityConfig.mobileLightmapTexturesUrlRelative
                    ? entity.mv_mobileLightmapTextures
                    : entity.mv_lightmapTextures;
        }
    }

    /**
     * Load config files for the entity (rule engine, mesh settings, materialMappings)
     */
    public async loadConfigs(entity: MVEntity): Promise<void> {
        entity.texturesBaseUrl =
            entity.entityConfig.entityConfigBaseUrl +
            entity.entityConfig.texturesUrlRelative;
        if (
            this._coreSettings.useMobileAssets &&
            entity.entityConfig.mobileTexturesUrlRelative
        ) {
            entity.texturesBaseUrl =
                entity.entityConfig.entityConfigBaseUrl +
                entity.entityConfig.mobileTexturesUrlRelative;
        }
        entity.meshesUrlRelative = entity.entityConfig.meshesUrlRelative;
        if (
            this._coreSettings.productionMode &&
            entity.entityConfig.productionMeshesUrlRelative
        ) {
            entity.meshesUrlRelative =
                entity.entityConfig.productionMeshesUrlRelative;
        }
        entity.meshesBaseUrl =
            entity.entityConfig.entityConfigBaseUrl + entity.meshesUrlRelative;

        if (entity.entityConfig.ruleEngineType == MVRuleEngineTypes.JSON) {
            if (!entity.entityConfig.ruleEngineConfigUrlRelative) {
                MVLogger.fatal(
                    CoreError.InvalidConfigurationError,
                    `No entityConfigUrlRelative defined for ${entity.name}`
                );
            }
            const ruleEngineJsonUrl =
                entity.entityConfig.entityConfigBaseUrl +
                entity.entityConfig.ruleEngineConfigUrlRelative;
            entity.ruleEngineJson = await loadJson(ruleEngineJsonUrl);
        }

        if (
            this._coreSettings.productionMode &&
            entity.entityConfig.productionMeshSettingsRelative
        ) {
            const productionMeshSettingsJsonUrl =
                entity.entityConfig.entityConfigBaseUrl +
                entity.entityConfig.productionMeshSettingsRelative;
            entity.productionMeshSettingsJson =
                await loadJson<MVProductionMeshSettingsJson>(
                    productionMeshSettingsJsonUrl
                );
        } else if (entity.entityConfig.meshSettingsRelative) {
            const meshSettingsJsonUrl =
                entity.entityConfig.entityConfigBaseUrl +
                entity.entityConfig.meshSettingsRelative;
            entity.meshSettingsJson =
                await loadJson<MVMeshSettingsJson>(meshSettingsJsonUrl);
        }

        if (entity.entityConfig.lightmapTexturesUrlRelative) {
            entity.lightmapTexturesUrlRelative =
                entity.entityConfig.lightmapTexturesUrlRelative;
            if (
                this._coreSettings.useMobileAssets &&
                entity.entityConfig.mobileLightmapTexturesUrlRelative
            ) {
                entity.lightmapTexturesUrlRelative =
                    entity.entityConfig.mobileLightmapTexturesUrlRelative;
            }
            const lightmapTexturesRegistryUrl =
                entity.entityConfig.entityConfigBaseUrl +
                entity.lightmapTexturesUrlRelative +
                'registry.json';
            const lightmapTexturesRegistryResponse = await loadJson<any>(
                lightmapTexturesRegistryUrl
            );
            entity.lightmapArrayJSON = lightmapTexturesRegistryResponse?.files;
        }

        if (entity.entityConfig.materialMappingsUrlRelative) {
            const materialMappingsJsonUrl =
                entity.entityConfig.entityConfigBaseUrl +
                entity.entityConfig.materialMappingsUrlRelative;
            entity.materialMappingsJson = await loadJson(
                materialMappingsJsonUrl
            );
        }

        if (entity.entityConfig.glbMaterialMappingUrlRelative) {
            const glbMaterialMappingUrl =
                entity.entityConfig.entityConfigBaseUrl +
                entity.entityConfig.glbMaterialMappingUrlRelative;
            entity.glbMaterialMapping = await loadJson(glbMaterialMappingUrl);
        }
    }

    public async loadNonConfigurableLayerWithoutUncompressing(
        entity: MVEntity
    ): Promise<AssetContainerResult | undefined> {
        if (!entity.mv_ruleEngineConfig?.nonConfigurableFileName) {
            return undefined;
        }
        const nonConfigurableFileName = `${entity.mv_ruleEngineConfig?.nonConfigurableFileName}.glb`;
        if (!nonConfigurableFileName) return undefined;
        const uncompressedPromise =
            this._assetLoader.loadAssetContainerWithoutUncompressing(
                entity.meshesBaseUrl,
                nonConfigurableFileName,
                this._scene
            );
        entity.loadNonConfigurableAssetContainerWithoutUncompressingPromise =
            uncompressedPromise;
        return uncompressedPromise;
    }

    /**
     * Applies the current configuration to the Babylon Scene.
     * Loads / unloads meshes and materials.
     * @param entity -
     *
     */
    public async applyLayerConfiguration(entity: MVEntity) {
        this.resetLoadingStatus(entity);

        const updatedHiddenLayers = entity.layers.filter(
            (layer) =>
                layer.previousVisibilityState == true &&
                layer.visibilityState == false
        );

        // If you are disposing a large number of meshes in a row,
        // you can save unnecessary computation by turning the scene property
        // blockfreeActiveMeshesAndRenderingGroups to true just before disposing
        // the meshes, and set it back to false just after
        this._scene.blockfreeActiveMeshesAndRenderingGroups = true;

        // force sequential order of layer disposal is required to prevent side effects
        for (const updatedHiddenLayer of updatedHiddenLayers) {
            updatedHiddenLayer.previousVisibilityState = false;
            updatedHiddenLayer.visibilityState = false;
            // console.log('Disposing layer ' + updatedHiddenLayer.name)
            await disposeLayer(
                updatedHiddenLayer,
                this._scene,
                entity,
                this._coreSettings.enableLazyLoading
            );
        }

        this._scene.blockfreeActiveMeshesAndRenderingGroups = false;

        const updatedVisibleLayers = entity.layers.filter(
            (layer) =>
                layer.previousVisibilityState == false &&
                layer.visibilityState == true
        );

        const layersWithTexturesToLoad = this._coreSettings.enableLazyLoading
            ? entity.layers
            : updatedVisibleLayers;

        const textureAndMaterialUrls = this.getTextureAndMaterialUrls(
            entity,
            layersWithTexturesToLoad
        );

        entity.loadingStatus.totalAssetsToLoad +=
            textureAndMaterialUrls.textureJsons.length +
            textureAndMaterialUrls.lightmapsUrls.length;

        const loadMeshesWithoutUncompressingPromises = [];
        const loadMeshesWithUncompressingPromises = [];

        for (const layer of entity.layers) {
            const isUpdatedVisibleLayer =
                layer.previousVisibilityState == false &&
                layer.visibilityState == true;

            for (const layerPath of layer.layerPaths) {
                const layerWasLazyLoaded = layer.assetContainers.length > 0;

                if (isUpdatedVisibleLayer && layerWasLazyLoaded) {
                    for (const assetContainer of layer.assetContainers) {
                        await this.processMeshes(
                            entity,
                            layerPath,
                            layer,
                            assetContainer.meshes
                        );
                    }
                    continue;
                }

                if (
                    isUpdatedVisibleLayer ||
                    (this._coreSettings.enableLazyLoading &&
                        !layerWasLazyLoaded)
                ) {
                    entity.loadingStatus.totalAssetsToLoad++;
                    let loadMeshesWithoutUncompressingPromise: Promise<AssetContainerResult>;

                    const nonConfigurableFileName =
                        entity.mv_ruleEngineConfig.nonConfigurableFileName;
                    if (
                        entity.loadNonConfigurableAssetContainerWithoutUncompressingPromise &&
                        nonConfigurableFileName &&
                        layerPath == nonConfigurableFileName + '.glb'
                    ) {
                        loadMeshesWithoutUncompressingPromise =
                            entity.loadNonConfigurableAssetContainerWithoutUncompressingPromise;
                    } else {
                        loadMeshesWithoutUncompressingPromise =
                            this._assetLoader.loadAssetContainerWithoutUncompressing(
                                entity.meshesBaseUrl,
                                layerPath,
                                this._scene
                            );
                    }

                    loadMeshesWithoutUncompressingPromises.push(
                        loadMeshesWithoutUncompressingPromise
                    );
                    loadMeshesWithUncompressingPromises.push(
                        loadMeshesWithoutUncompressingPromise.then(
                            async (
                                assetContainerResult: AssetContainerResult
                            ) => {
                                const assetContainer: AssetContainer =
                                    await assetContainerResult.uncompressedAssetContainer;

                                if (assetContainer) {
                                    layer.assetContainers.push(assetContainer);

                                    if (isUpdatedVisibleLayer) {
                                        await this.processMeshes(
                                            entity,
                                            layerPath,
                                            layer,
                                            assetContainer.meshes
                                        );
                                    }
                                }

                                this.incrementLoadedAssetCount(entity);
                            }
                        )
                    );
                }
            }
            if (isUpdatedVisibleLayer) {
                layer.previousVisibilityState = true;
                layer.visibilityState = true;
            }
        }

        await Promise.all(loadMeshesWithoutUncompressingPromises);

        let preloadTexturesPromise;

        // if (!this._coreSettings.enableLazyLoading) {
        preloadTexturesPromise = this.preloadMaterials(
            entity,
            textureAndMaterialUrls.textureJsons,
            textureAndMaterialUrls.lightmapsUrls,
            textureAndMaterialUrls.materialsUrls
        );
        // } else {
        //   preloadTexturesPromise = this.preloadRemainingTextures(entity);
        // }

        await Promise.all([
            ...loadMeshesWithUncompressingPromises,
            preloadTexturesPromise
        ]);
    }

    public async lazyLoadRemainingLayersAndTextures(
        entity: MVEntity
    ): Promise<any> {
        if (!this._coreSettings.enableLazyLoading) return;

        const lazyLoadingStartTimeInMs = Date.now();

        const loadLayersPromise = this.preloadHiddenLayers(entity).then(() => {
            const layerLazyLoadingTimeInS =
                (Date.now() - lazyLoadingStartTimeInMs) / 1000;
            MVLogger.debug(
                `Entity Service: Layer lazy loading time in seconds: ${layerLazyLoadingTimeInS}`
            );
        });

        const textureLazyLoadingStartTimeInMs = Date.now();
        const loadTexturesPromise = this.preloadRemainingTextures(
            entity,
            false
        ).then(() => {
            const textureLazyLoadingTimeInS =
                (Date.now() - textureLazyLoadingStartTimeInMs) / 1000;
            MVLogger.debug(
                `Entity Service: Texture lazy loading time in seconds: ${textureLazyLoadingTimeInS}`
            );
        });

        await Promise.all([loadTexturesPromise, loadLayersPromise]);

        const lazyLoadingTimeInS =
            (Date.now() - lazyLoadingStartTimeInMs) / 1000;
        MVLogger.debug(
            `Entity Service: Total lazy loading time in seconds: ${lazyLoadingTimeInS}`
        );
    }

    private async preloadHiddenLayersWithAsyncPool(entity: MVEntity) {
        const hiddenLayers = entity.layers.filter(
            (layer) => layer.visibilityState == false
        );

        const layerLoadingParams = [];

        for (const layer of hiddenLayers) {
            for (const layerPath of layer.layerPaths) {
                layerLoadingParams.push({
                    url: entity.meshesBaseUrl,
                    fileName: layerPath,
                    layer: layer
                });
            }
        }

        // await asyncPool(2, layerLoadingParams, this._assetLoader.loadAssetContainerParams.bind(this._assetLoader));
    }

    private async preloadHiddenLayers(entity: MVEntity) {
        const hiddenLayers = entity.layers.filter(
            (layer) => layer.visibilityState == false
        );

        const loadLayerPromises: Promise<any>[] = [];

        for (const layer of hiddenLayers) {
            for (const layerPath of layer.layerPaths) {
                const loadLayerPromise = this._assetLoader
                    .loadAssetContainer(entity.meshesBaseUrl, layerPath)
                    .then((assetContainer: AssetContainer) => {
                        layer.assetContainers.push(assetContainer);
                    });
                // await loadLayerPromise;
                loadLayerPromises.push(loadLayerPromise);
            }
        }

        await Promise.all(loadLayerPromises);
    }

    /**
     * Applies the current configuration to a layer.
     * Loads / unloads meshes.
     * @param layer -
     *
     */
    private async applyMeshesToLayer(
        entity: MVEntity,
        layer: MVLayer
    ): Promise<MVLayer> {
        // Load .glb file with all meshes for this layer
        const loadMeshesPromises: Promise<any>[] = [];
        for (const layerPath of layer.layerPaths) {
            const loadMeshesPromise = this.loadMeshes(entity, layerPath, layer);
            loadMeshesPromises.push(loadMeshesPromise);
        }

        layer.previousVisibilityState = true;
        layer.visibilityState = true;
        await Promise.all(loadMeshesPromises);
        return layer;
    }

    public getTextureAndMaterialUrls(
        entity: MVEntity,
        layers: MVLayer[]
    ): TextureAndMaterialUrls {
        const lightmapUrlsMap = {};
        const materialUrlsMap = {};

        if (!entity.mv_glbMetaData || !this._coreSettings.productionMode)
            return {
                textureJsons: [],
                lightmapsUrls: [],
                materialsUrls: []
            };

        layers.forEach((layer: MVLayer) => {
            const lightmapFileNames = entity.entityConfig
                .lightmapTexturesUrlRelative
                ? entity.mv_glbMetaData[layer.name]?.lightmaps
                : [];
            if (lightmapFileNames) {
                for (let lightmapFileName in lightmapFileNames) {
                    lightmapUrlsMap[lightmapFileName] = lightmapFileName;
                }
            }
            const materialNames = entity.mv_glbMetaData[layer.name]?.materials;
            if (materialNames) {
                for (let materialName in materialNames) {
                    const materialMapping: MVMaterialMapping =
                        entity.materialMappings.get(materialName);
                    if (materialMapping && materialMapping.mapping) {
                        materialUrlsMap[materialMapping.mapping] =
                            materialMapping.mapping;
                    }
                }
            }
        });

        const materialUrls: string[] = Object.keys(materialUrlsMap);

        const textureUrlsToTextureJsonMapping =
            this.materialUrlsToTextureJsonMapping(entity, materialUrls);

        return {
            textureJsons: Object.values(textureUrlsToTextureJsonMapping),
            lightmapsUrls: Object.keys(lightmapUrlsMap),
            materialsUrls: materialUrls
        };
    }

    public materialUrlsToTextureJsonMapping(
        entity: MVEntity,
        materialUrls: string[]
    ): {
        [key: string]: TextureJSON;
    } {
        const textureUrlsToTextureJsonMapping: {
            [key: string]: TextureJSON;
        } = {};

        materialUrls.forEach((materialUrlRelative: string) => {
            const materialJson = entity.mv_materials[materialUrlRelative];
            TEXTURE_PROPERTIES.forEach((textureProperty: string) => {
                const textureJson: TextureJSON = materialJson
                    ? materialJson[textureProperty]
                    : null;
                const textureKey = getTextureKeyFromJson(
                    textureJson,
                    entity.entityConfig.entityConfigBaseUrl
                );
                if (textureKey) {
                    textureUrlsToTextureJsonMapping[textureKey] = textureJson;
                }
            });
            const detailMapJson = materialJson?.detailMap?.texture;
            if (detailMapJson) {
                const textureUrl = detailMapJson?.url;
                if (textureUrl) {
                    textureUrlsToTextureJsonMapping[textureUrl] = detailMapJson;
                }
            }
        });

        return textureUrlsToTextureJsonMapping;
    }

    /**
     * Loads all required lightmaps and materials for the passed layers.
     * Only works in prodction mode with an existing glbMetaData entry which maps the required lightmaps
     * and materials to a glb file.
     * Using this function allows to start loading materials and lightmaps before or during the loading process of
     * glb files which optimized the overall initial loading time by about 25%.
     * @param entity -
     * @param layers -
     */
    public async preloadMaterials(
        entity: MVEntity,
        textureJsons: TextureJSON[],
        lightmapUrls: string[],
        materialUrls: string[]
    ): Promise<any> {
        const loadLightmapPromises: Promise<any>[] = lightmapUrls.map(
            (lightmapUrl) => {
                return this.createLightmapTexture({
                    entity: entity,
                    lightmapFileName: lightmapUrl
                }).then((texture) => {
                    this.incrementLoadedAssetCount(entity);
                    return texture;
                });
            }
        );

        const loadTexturePromises: Promise<any>[] = textureJsons.map(
            (textureJson) => {
                return jsonToTexture(
                    textureJson,
                    this._scene,
                    entity.texturesBaseUrl
                ).then((texture) => {
                    this.incrementLoadedAssetCount(entity);
                    return texture;
                });
            }
        );

        await Promise.all(loadTexturePromises);

        const loadMaterialPromises = materialUrls.map((materialUrlRelative) => {
            return this.getTargetMaterial(entity, materialUrlRelative);
        });

        await Promise.all([...loadLightmapPromises, ...loadMaterialPromises]);
    }

    public async preloadRemainingTexturesWithAsyncPool(
        entity: MVEntity
    ): Promise<any> {
        const maxParallelLoadingCount = 1;

        const lightmapPromiseParams = [];

        if (entity.lightmapArrayJSON) {
            for (const lightmapUrl of entity.lightmapArrayJSON) {
                lightmapPromiseParams.push({
                    entity: entity,
                    lightmapFileName: lightmapUrl,
                    removeFromScene: true
                });
            }
        }

        // await asyncPool(maxParallelLoadingCount, lightmapPromiseParams, this.createLightmapTexture.bind(this));

        const allMaterialUrls = Object.keys(entity.mv_materials);
        const textureJsons = Object.values(
            this.materialUrlsToTextureJsonMapping(entity, allMaterialUrls)
        );

        const texturePromiseParams = [];

        for (const textureJson of textureJsons) {
            texturePromiseParams.push({
                json: textureJson,
                scene: this._scene,
                baseUrl: entity.texturesBaseUrl,
                removeFromScene: true
            });
        }

        // await asyncPool(maxParallelLoadingCount, texturePromiseParams, jsonToTextureParams);
    }

    public async preloadRemainingTextures(
        entity: MVEntity,
        forceSequentialExecution: boolean
    ): Promise<any> {
        const createLightmapTexturePromises: Promise<any>[] = [];

        if (entity.lightmapArrayJSON) {
            for (const lightmapUrl of entity.lightmapArrayJSON) {
                const createLightmapTexturePromise = this.createLightmapTexture(
                    {
                        entity: entity,
                        lightmapFileName: lightmapUrl
                    }
                ).then((texture) => {
                    // this._scene.removeTexture(texture);
                });
                if (forceSequentialExecution)
                    await createLightmapTexturePromise;
                createLightmapTexturePromises.push(
                    createLightmapTexturePromise
                );
            }
        }

        const allMaterialUrls = Object.keys(entity.mv_materials);
        const textureJsons = Object.values(
            this.materialUrlsToTextureJsonMapping(entity, allMaterialUrls)
        );

        const loadTexturePromises: Promise<any>[] = [];

        for (const textureJson of textureJsons) {
            const loadTexturePromise = jsonToTextureParams({
                json: textureJson,
                scene: this._scene,
                baseUrl: entity.texturesBaseUrl
            }).then((texture) => {
                // this._scene.removeTexture(texture);
            });
            if (forceSequentialExecution) await loadTexturePromise;
            loadTexturePromises.push(loadTexturePromise);
        }

        await Promise.all([
            ...createLightmapTexturePromises,
            ...loadTexturePromises
        ]);
    }

    private getlightmapFileName(
        entity: MVEntity,
        layerName,
        glbFileName: string
    ) {
        let lightmapFileName = entity.lightmapArrayJSON?.find(
            (fileName: string) => {
                return fileName.startsWith(layerName + '.');
            }
        );
        if (
            entity.entityConfig.lightmapOverwrites &&
            entity.entityConfig.lightmapOverwrites[glbFileName]
        ) {
            lightmapFileName =
                entity.entityConfig.lightmapOverwrites[glbFileName];
        }
        return lightmapFileName;
    }

    /**
     * Loads all meshes from a glb file and adds them to a layer.
     * If the meshes of the file are part of a socket they are attached to the correct socket of the previously imported rig.
     * @param layerPath -
     * @param layer -
     *
     */
    private async loadMeshes(
        entity: MVEntity,
        layerPath: string,
        layer: MVLayer
    ): Promise<AbstractMesh[]> {
        let meshes: AbstractMesh[];

        try {
            meshes = await this._assetLoader.loadMeshes(
                entity.meshesBaseUrl,
                layerPath,
                layer
            );
        } catch (error) {
            MVLogger.error(
                `Failed loading file ${entity.meshesBaseUrl}${layerPath}`
            );
        }
        return meshes;
    }

    public async processMeshes(
        entity: MVEntity,
        layerPath: string,
        layer: MVLayer,
        meshes: AbstractMesh[]
    ): Promise<AbstractMesh[]> {
        // Setup mesh hierarchy
        if (!meshes && meshes.length <= 0) {
            return meshes;
        }
        for (const mesh of meshes) {
            if (this._coreSettings.productionMode) {
                mesh.doNotSyncBoundingInfo = true;
            }

            if (mesh.id !== entity.uuid) {
                mesh.hasVertexAlpha = false;

                const isSocket = layerPath.includes('_socket_');
                let socket;
                if (isSocket) {
                    const socketName = layerPath
                        .split('_socket_')[1]
                        .replace('.glb', '');
                    socket = getChildNodeById(entity.rootNode, socketName);
                }
                if (!isSocket || !socket) {
                    mesh.setParent(entity.rootNode);
                } else {
                    mesh.setParent(socket);
                }

                const meshAndInstances = await this.applyMeshSettingsFromJson(
                    entity,
                    mesh,
                    layer,
                    layerPath
                );
                for (let m of meshAndInstances) {
                    // not sure why this is not working but it could save performance if we get it to work in the future
                    // https://doc.babylonjs.com/divingDeeper/scene/optimize_your_scene
                    // if (!m.isAnInstance && m instanceof Mesh && m.getIndices().length > 1 && !m['parentSocket']) {
                    //   m = m.convertToUnIndexedMesh();
                    // }
                    this.setInspectableCustomProperties(m, layerPath, layer);
                    this.processOriginalMaterial(entity, m, layer);
                    layer.addMesh(m);
                    if (m.material) {
                        this._scene.addMaterial(m.material);
                    }
                    this._scene.addMesh(m);
                }
            }
        }
        return meshes;
    }

    public setInspectableCustomProperties(
        mesh: AbstractMesh,
        layerPath: string,
        layer: MVLayer
    ) {
        if (mesh.inspectableCustomProperties?.length > 0) {
            return;
        }

        if (!mesh.inspectableCustomProperties) {
            mesh.inspectableCustomProperties = [];
        }

        mesh['fileName'] = mesh['fileName'] ? mesh['fileName'] : layerPath;
        mesh.inspectableCustomProperties.push({
            label: 'File Name',
            propertyName: 'fileName',
            type: InspectableType.String
        });

        if (mesh['originalFileName']) {
            mesh.inspectableCustomProperties.push({
                label: 'Original File Name',
                propertyName: 'originalFileName',
                type: InspectableType.String
            });
        }

        if (mesh['originalMeshId']) {
            mesh.inspectableCustomProperties.push({
                label: 'Original Mesh Id',
                propertyName: 'originalMeshId',
                type: InspectableType.String
            });
        }

        mesh['layerName'] = layer.name;
        mesh.inspectableCustomProperties.push({
            label: 'Layer Name',
            propertyName: 'layerName',
            type: InspectableType.String
        });

        mesh.inspectableCustomProperties.push({
            label: 'is clone',
            propertyName: 'isClone',
            type: InspectableType.String
        });

        const lightmapFileName = mesh['lightmapFileName'];
        if (lightmapFileName) {
            mesh['lightmapFileName'] = lightmapFileName;
            mesh.inspectableCustomProperties.push({
                label: 'Lightmap',
                propertyName: 'lightmapFileName',
                type: InspectableType.String
            });
        }

        mesh['hideOnCameraIntersect'] = mesh['hideOnCameraIntersect']
            ? mesh['hideOnCameraIntersect']
            : false;
        mesh.inspectableCustomProperties.push({
            label: 'Hide On Camera Intersect',
            propertyName: 'hideOnCameraIntersect',
            type: InspectableType.Checkbox
        });

        mesh['boundingBoxScale'] = mesh['boundingBoxScale']
            ? mesh['boundingBoxScale']
            : 1.0;
        mesh.inspectableCustomProperties.push({
            label: 'Bounding Box Scale',
            propertyName: 'boundingBoxScale',
            type: InspectableType.Slider,
            min: 0.0,
            max: 10.0,
            step: 0.1
        });
    }

    /**
     * Returns all active entities
     *
     */
    public getEntities(): MVEntity[] {
        return this._entities;
    }

    /**
     * Creates a new entity
     * @param entityConfig -
     * @param id -
     * @param allowMultiple - Load Product without removing other products. Default: false
     *
     */
    public async addProduct(
        entityConfig: MVEntityConfig,
        id: string,
        onLoadingProgressUpdate$: Subject<number>
    ): Promise<MVEntity> {
        const entity = new MVProductEntity(
            entityConfig,
            id,
            onLoadingProgressUpdate$
        );
        const cleanupPromises = this._entities
            .filter((p) => p instanceof MVProductEntity)
            .map((p) => this.dispose(p));

        await Promise.all(cleanupPromises);

        this._entities.push(entity);

        this.activeProductEntity = entity;

        return entity;
    }

    public getActiveProductEntity(): MVProductEntity {
        return this._entities.find((entity: MVEntity) => {
            return entity instanceof MVProductEntity;
        });
    }

    /**
     * Creates a new environment entity
     * @param entityConfig -
     * @param id -
     */
    public async addEnvironment(
        entityConfig: MVEntityConfig,
        id: string,
        onLoadingProgressUpdate$: Subject<number>,
        preloadOnly: boolean
    ): Promise<MVEnvironmentEntity> {
        const entity = new MVEnvironmentEntity(
            entityConfig,
            id,
            onLoadingProgressUpdate$
        );

        if (!preloadOnly) {
            const cleanupPromises = this._entities
                .filter((p) => p instanceof MVEnvironmentEntity)
                .map(async (environmentEntity) => {
                    return Promise.all([
                        this.dispose(environmentEntity),
                        this.removeLightsOfEntity(environmentEntity)
                    ]);
                });

            await Promise.all(cleanupPromises);
        }

        this._entities.push(entity);
        return entity;
    }

    public getEnvironmentEntityById(entityId): MVEnvironmentEntity {
        return this._entities.find((entity) => {
            return (
                entity.mv_id == entityId &&
                entity instanceof MVEnvironmentEntity
            );
        }) as MVEnvironmentEntity;
    }

    async dispose(entity: MVEntity): Promise<MVEntity | undefined> {
        const entityToDispose = this._entities.find((p) => p == entity);
        if (!entityToDispose) return undefined;
        if (!entityToDispose.rootNode) return undefined;
        if (entityToDispose.rootNode.isDisposed()) return undefined;

        const disposeRootNodePromise = new Promise(
            (resolve: any, reject: any) => {
                entityToDispose.rootNode.onDisposeObservable.addOnce(() => {
                    resolve(entityToDispose);
                });
            }
        );

        if (!this._coreSettings.enableLazyLoading) {
            entityToDispose.rootNode.dispose(false, false);
            await disposeRootNodePromise;
        } else {
            // this._scene.removeMesh(entityToDispose.rootNode as AbstractMesh, true)
        }

        this.removeLightsOfEntity(entityToDispose);

        if (entity instanceof MVEnvironmentEntity) {
            entity.activeEnvironmentCode = null;
            if (!this._coreSettings.enableLazyLoading) {
                entity.environmentTextures.forEach((texture) => {
                    texture.dispose();
                });
            }
        }

        for (const layer of entity.layers) {
            await disposeLayer(
                layer,
                this._scene,
                entity,
                this._coreSettings.enableLazyLoading
            );
        }

        if (!this._coreSettings.enableLazyLoading) {
            this._entities = this._entities.filter((p) => p != entityToDispose);
        }
        return entityToDispose;
    }

    /**
     * Get an existing Entity
     * @param uuid - The unique id of the entitiy -
     */
    public getEntity(uuid: string): MVEntity {
        return this._entities.find((entity: MVEntity) => entity.uuid === uuid);
    }

    /**
     * Get an existing Environment Entity
     * @param uuid - The unique id of the entitiy -
     *
     */
    public getEnvironmentEntity(uuid: string): MVEnvironmentEntity {
        let environmetEntity: MVEnvironmentEntity;
        this._entities.forEach((entity: MVEntity) => {
            if (entity.uuid === uuid && entity instanceof MVEnvironmentEntity) {
                environmetEntity = entity;
            }
        });
        return environmetEntity;
    }

    /**
     * Adds the rig of an entity to the scene
     * @param entity -
     */
    public addRigToScene(entity: MVEntity): void {
        entity.rig.forEach((mesh: AbstractMesh) => {
            this._scene.addMesh(mesh);
        });
    }

    public applyRigOffset(entity: MVEntity): void {
        const rigOffset = entity.entityConfig.rigOffset;
        if (rigOffset) {
            entity.rig.forEach((mesh: AbstractMesh) => {
                mesh.position.x = rigOffset.x;
                mesh.position.y = rigOffset.y;
                mesh.position.z = rigOffset.z;
            });
        }
    }

    public resetRigOffset(entity: MVEntity): void {
        entity.rig.forEach((mesh: AbstractMesh) => {
            mesh.position.x = 0;
            mesh.position.y = 0;
            mesh.position.z = 0;
        });
    }

    public cloneAnimations(entity: MVEntity) {
        const animations = entity.getAnimations();
        let clonedAnimations: MVAnimation[] = [];
        if (animations) {
            clonedAnimations = entity
                .getAnimations()
                ?.map((animation: MVAnimation) => {
                    return animation.clone(animation.id);
                });
        }
        return clonedAnimations;
    }

    public async resetAnimations(entity: MVEntity): Promise<void> {
        const animations = entity.getAnimations();
        const resetAnimationPromises: Promise<MVAnimation>[] = [];
        animations.forEach((animation: MVAnimation) => {
            resetAnimationPromises.push(animation.reset());
        });
        await Promise.all(resetAnimationPromises);
    }

    public async setAnimationsToPreviousState(
        entity: MVEntity,
        previousAnimations: MVAnimation[]
    ): Promise<void> {
        const animations = entity.getAnimations();
        const setAnimationPromises: Promise<MVAnimation>[] = [];
        animations.forEach((animation: MVAnimation) => {
            const previousAnimation: MVAnimation = previousAnimations?.find(
                (anim: MVAnimation) => {
                    return anim.id == animation.id;
                }
            );
            if (previousAnimation) {
                const playAnimationOptions: PlayAnimationOptions = {
                    to: previousAnimation.getCurrentFrame(),
                    speedRatio: 1000
                };
                const setAnimationPromise =
                    animation.play(playAnimationOptions);
                setAnimationPromises.push(setAnimationPromise);
            }
        });
        await Promise.all(setAnimationPromises);
    }

    public async waitUntilAnimationsHaveFinishedPlaying(entity): Promise<void> {
        const animations = entity.getAnimations();
        const animationFinishedPromises = [];
        animations.forEach((animation: MVAnimation) => {
            animationFinishedPromises.push(
                animation.waitUntilFinishedPlaying()
            );
        });
        await Promise.all(animationFinishedPromises);
    }

    /**
     * Update both light and settings of entities based on the current camera category
     * @param cameraCategory -
     * @param entity - If no entity is provided, changes will be applied to all active entities
     */
    public async updateLightsAndSceneSettings(
        cameraCategory: string,
        entity?: MVEntity,
        preventSceneFreezing?: boolean,
        _waitForSceneReady?: boolean
    ): Promise<void> {
        const entities = entity ? [entity] : this._entities;

        const entitiesToUpdate: MVEntity[] = entities.filter((ent) => {
            if (
                ent instanceof MVEnvironmentEntity &&
                ent == this.activeEnvironmentEntity &&
                ent.activeEnvironmentCode !== cameraCategory
            ) {
                return true;
            }
            return false;
        });

        if (entitiesToUpdate.length == 0) return;

        if (
            this._coreSettings.productionMode &&
            !this._environmentUpdateInProgress &&
            !this._productUpdateInProgress
        ) {
            this._scene.unfreezeActiveMeshes();
            this.unfreezeMaterials();
        }

        for (let ent of entitiesToUpdate) {
            await this.updateLights(cameraCategory, ent);
            await this._sceneSettingsService.updateSceneSettings(
                cameraCategory,
                ent as MVEnvironmentEntity
            );
        }

        // Waiting for scene ready takes a long time and is only required after the light setup changes.

        let waitForSceneReadyPromise = Promise.resolve();
        if (_waitForSceneReady) {
            waitForSceneReadyPromise = waitForSceneReady(this._scene);
        }
        // waiting for scene ready can take a long time. That's why this promise is not awaited.
        waitForSceneReady(this._scene).then(async () => {
            rebuildMaterials(this._scene);

            if (
                this._coreSettings.productionMode &&
                !this._environmentUpdateInProgress &&
                !this._productUpdateInProgress &&
                !preventSceneFreezing
            ) {
                await this.freezeMaterialsAfterTimeout();
                this.freezeMeshes();
            }
        });
    }

    public async removeLightsOfEntity(entity: MVEntity): Promise<void> {
        const lightsToRemove = [];
        // Clean up old lights
        for (const light of this._scene.lights) {
            if (light['entityReference'] == entity.uuid) {
                lightsToRemove.push(light);
            }
        }
        const promises = [];
        for (const light of lightsToRemove) {
            promises.push(removeLight(light, this._scene));
        }
        await Promise.all(promises);
    }

    /**
     * Update all lights for the entity
     * @param cameraCategory -
     * @param entity - If no entity is provided, changes will be applied to all active entities
     */
    public async updateLights(
        cameraCategory: string,
        entity?: MVEntity
    ): Promise<void> {
        const entities = entity ? [entity] : this._entities;

        for (const _entity of entities) {
            if (_entity.entityConfig && _entity.entityConfig.lights) {
                await this.removeLightsOfEntity(_entity);
                const lights = _entity.entityConfig.lights[cameraCategory];

                // Add new lights
                lights?.forEach((light: any) => {
                    if (!this._scene.getLightByUniqueID(light.uniqueId)) {
                        this._lightService.parseLight(light, entity.uuid);
                    }
                });
            }
        }
    }

    /**
     * Apply mesh settings from JSON file if it exists.
     * @param entity -
     * @param mesh -
     */
    private async applyMeshSettingsFromJson(
        entity: MVEntity,
        mesh: AbstractMesh,
        layer: MVLayer,
        glbFileName: string
    ): Promise<AbstractMesh[]> {
        const meshAndInstances = [mesh];
        mesh['isClone'] = 'false';

        let lightmapFileName;

        let meshSetting: MVMeshSetting;
        if (entity.mv_productionMeshSettings) {
            meshSetting = entity.mv_productionMeshSettings[mesh.id];
            lightmapFileName = meshSetting
                ? meshSetting['lightmapFileName']
                : null;
        } else if (entity.mv_meshSettings) {
            meshSetting = entity.mv_meshSettings.meshes.find(
                (meshSetting: MVMeshSetting) => {
                    return meshSetting.id == mesh.id;
                }
            );
            lightmapFileName = this.getlightmapFileName(
                entity,
                layer.name,
                glbFileName
            );
        }

        if (lightmapFileName) {
            mesh['lightmapFileName'] = lightmapFileName;
            // await this.createLightmapTexture(entity, lightmapFileName);
        }

        if (glbFileName && glbFileName.includes('_part_mirror')) {
            let parentNode = mesh.parent;
            // if (meshSetting.mirrorSocketName) {
            //   const socket = getChildNodeById(entity.rootNode, meshSetting.mirrorSocketName);
            //   if (socket) {
            //     parentNode = socket;
            //   }
            // }

            let mirrorNode = parentNode
                .getChildren()
                ?.find((c) => c.id == 'mirror') as TransformNode;
            if (!mirrorNode) {
                mirrorNode = new TransformNode('mirror', this._scene);
                mirrorNode.setParent(parentNode);
                mirrorNode.resetLocalMatrix();
                mirrorNode.scaling.x = -1;
            }
            const clone = mesh.clone(mesh.name, mirrorNode, true);
            clone['isClone'] = 'true';
            meshAndInstances.push(clone);
        }

        if (meshSetting) {
            if (meshSetting.socketName) {
                const socket = getChildNodeById(
                    entity.rootNode,
                    meshSetting.socketName
                );
                if (socket) {
                    mesh['parentSocket'] = socket;
                    mesh.setParent(socket);
                }
            }

            for (const property in meshSetting) {
                for (const m of meshAndInstances) {
                    const value = meshSetting[property];
                    if (m[property] !== undefined) {
                        m[property] = value;
                    } else if (property == 'materialName') {
                        m[property] = value;
                    } else if (property == 'originalFileName') {
                        m[property] = value;
                    } else if (property == 'originalMeshId') {
                        m[property] = value;
                    } else if (property == 'boundingBoxScale') {
                        m.getBoundingInfo().boundingBox.scale(
                            meshSetting[property]
                        );
                        m[property] = value;
                    } else if (property == 'hideOnCameraIntersect') {
                        m['hideOnCameraIntersect'] = value;
                    }
                }
            }
        }
        return meshAndInstances;
    }
    /**
     * Processes the original material of a mesh that was imported into the application.
     * Imported materials are always mapped to target material (material allocator or target material).
     * If the material is a material allocator is is directly mapped to a target material and added to the scene. If the material is a switch material the mesh is only linked to the correconding switch material. After all materials have been processed the switch materials are assigned to the meshes and added to the scene.
     * @param entity -
     * @param mesh -
     * @param layer -
     */
    private processOriginalMaterial(
        entity: MVEntity,
        mesh: AbstractMesh,
        layer: MVLayer
    ): void {
        if (mesh.material || mesh['materialName']) {
            mesh.useVertexColors = false;

            if (
                entity.entityConfig.useVCAOForPBRMaterials &&
                mesh['getVertexBuffer']
            ) {
                mesh.useVertexColors = true;
                const colorVertexBuffer = (mesh as Mesh).getVertexBuffer(
                    VertexBuffer.ColorKind
                );
                if (colorVertexBuffer) {
                    const vertexColorArray = colorVertexBuffer._buffer
                        ._data as number[];

                    const VCAOMultiplyFactor =
                        entity.entityConfig.VCAOMultiplyFactor !== undefined
                            ? entity.entityConfig.VCAOMultiplyFactor
                            : 3;
                    const VCAOPower = 1;

                    if (vertexColorArray) {
                        for (
                            let i = 0;
                            i < vertexColorArray.length;
                            i = i + 4
                        ) {
                            const multiplied =
                                vertexColorArray[i] * VCAOMultiplyFactor;
                            vertexColorArray[i] = Math.min(
                                Math.pow(multiplied, VCAOPower),
                                1
                            );
                            const redValue = vertexColorArray[i];
                            vertexColorArray[i + 1] = redValue;
                            vertexColorArray[i + 2] = redValue;
                            // vertexColorArray[i + 3] = redValue;
                        }
                        colorVertexBuffer._rebuild();
                        mesh._rebuild();
                        (mesh as Mesh)._updateCache();
                    }
                }
            }

            const lastDotIndex = mesh.material.name.lastIndexOf('.');
            let originalMaterialName: string;
            if (mesh['materialName']) {
                originalMaterialName = mesh['materialName'];
            } else {
                originalMaterialName = mesh.material.name.substring(
                    0,
                    lastDotIndex > 0 ? lastDotIndex : mesh.material.name.length
                );
            }

            if (!mesh.inspectableCustomProperties) {
                mesh.inspectableCustomProperties = [];
            }

            if (!mesh['originalMaterialName']) {
                mesh['originalMaterialName'] = originalMaterialName;
                mesh.inspectableCustomProperties.push({
                    label: 'Original Material Name',
                    propertyName: 'originalMaterialName',
                    type: InspectableType.String
                });
            }

            let materialMapping: MVMaterialMapping =
                entity.getMaterialMapping(originalMaterialName);
            if (!materialMapping) {
                materialMapping = new MVMaterialMapping(
                    originalMaterialName,
                    null
                );
                entity.addMaterialMapping(materialMapping);
            }
            materialMapping.addMesh(mesh);
        }
    }

    /**
     *  Gets the target material from a material mapping.
     * @param entity -
     * @param materialMappingUrl -
     */
    private async getTargetMaterial(
        entity: MVEntity,
        materialMappingUrl: string
    ): Promise<Material> {
        const targetMaterialUrl = materialMappingUrl;
        let targetMaterial =
            this._materialService.getMaterial(targetMaterialUrl);

        if (!targetMaterial) {
            targetMaterial = await this._materialService.mv_createMaterial(
                entity,
                entity.materialsBaseUrl,
                entity.texturesBaseUrl,
                targetMaterialUrl,
                entity.entityConfig.environmentBRDFTextureUrl
            );
            // this._scene['mv_materials'][targetMaterial.id] = targetMaterial;
        }

        return targetMaterial;
    }

    /**
     * Updates all switch materials. Assigns the correct target materials to objects that use switch materials.
     * Before this function is called the switchMaterials property must already have been updated by calling the
     * updateConfiguration Function on the configurationService.
     * @param entity -
     */
    public async applyMaterials(entity: MVEntity): Promise<void> {
        const promises: Promise<any>[] = [];

        const meshesMappedByMaterialUrls: {
            [key: string]: AbstractMesh[];
        } = {};

        entity.materialMappings.forEach(
            (materialMapping: MVMaterialMapping, key: string) => {
                const materialUrl = materialMapping.mapping;
                if (!materialUrl) return;
                let meshesOfMaterialUrl: AbstractMesh[] =
                    meshesMappedByMaterialUrls[materialUrl];
                meshesOfMaterialUrl = meshesOfMaterialUrl
                    ? [...meshesOfMaterialUrl, ...materialMapping.meshes]
                    : materialMapping.meshes;
                meshesMappedByMaterialUrls[materialUrl] = meshesOfMaterialUrl;
            }
        );

        for (let materialUrl of Object.keys(meshesMappedByMaterialUrls)) {
            // meshesMappedByMaterialUrls.forEach((meshes: AbstractMesh[], materialUrl: string) => {
            const meshes = meshesMappedByMaterialUrls[materialUrl];
            if (materialUrl && meshes && meshes.length > 0) {
                await this.applyMaterial(entity, materialUrl, meshes);
            }
        }

        // return Promise.all(promises);
    }

    /**
     * Updates a switch material. Assigns the correct target material to the objects that use the passed switch material.
     * Before this function is called the passed switchMaterial property must already have been updated by calling the updateConfiguration Function on the configurationService.
     * @param entity -
     * @param materialUrl -
     * @param meshes -
     */
    private async applyMaterial(
        entity: MVEntity,
        materialUrl: string,
        meshes: AbstractMesh[]
    ): Promise<Material[]> {
        const targetMaterial: Material = await this.getTargetMaterial(
            entity,
            materialUrl
        );
        const isNodeMaterial = targetMaterial instanceof NodeMaterial;
        if (!targetMaterial) return [];

        // const glowEnabled = targetMaterial['glowEnabled'];

        let promises: Promise<Material>[] = [];
        for (let mesh of meshes) {
            const hasLightMap = mesh['lightmapFileName'];
            let materialPromise: Promise<Material>;
            if (hasLightMap) {
                const targetMVMaterial = targetMaterial as MVMaterial;
                materialPromise = this.getLightMapMaterial(
                    entity,
                    mesh,
                    targetMVMaterial
                );
            } else {
                materialPromise = Promise.resolve(targetMaterial);
            }

            // if (glowEnabled) {
            //   this._sceneOptimizerService.addMeshToGlowLayer(mesh);
            // }

            const applyMaterialPromise = materialPromise.then(
                async (material) => {
                    let isTransparent = false;
                    if (
                        material instanceof MVMaterial &&
                        isTransparentMaterial(
                            material.transparencyMode,
                            material.alpha,
                            material.opacityTexture
                        )
                    ) {
                        isTransparent = true;
                    }
                    const useVertexColors =
                        isNodeMaterial ||
                        (entity.entityConfig.useVCAOForPBRMaterials &&
                            !isTransparent);
                    mesh.useVertexColors = useVertexColors;
                    mesh['vertexColorInUse'] = useVertexColors;

                    if (!mesh.isAnInstance) {
                        mesh.useVertexColors = useVertexColors;
                        mesh.material = material;
                    }

                    if (mesh['clones']) {
                        mesh['clones'].forEach((clone) => {
                            clone.useVertexColors = useVertexColors;
                            clone.material = material;
                        });
                    }
                    return material;
                }
            );

            await applyMaterialPromise;
            promises.push(applyMaterialPromise);
        }

        return Promise.all(promises);
    }

    /**
     * Apply a lightmap material to a mesh
     * @param entity -
     * @param mesh -
     * @param material -
     */
    private async getLightMapMaterial(
        entity: MVEntity,
        mesh: AbstractMesh,
        material: MVMaterial
    ): Promise<MVMaterial> {
        const isUnlitMaterial = material.unlit;

        if (
            isTransparentMaterial(
                material.transparencyMode,
                material.alpha,
                material.opacityTexture
            ) ||
            isUnlitMaterial
        )
            return material;

        const lightmapFileName = mesh['lightmapFileName'];
        const newMaterialName = material.name.replace(
            FileType.JSON,
            `_LIGHTMAP_${lightmapFileName}${FileType.JSON}`
        );

        let newMaterial = this._materialService.getMaterial(
            newMaterialName
        ) as MVMaterial;
        if (newMaterial) return newMaterial;

        try {
            newMaterial = await material._clone(newMaterialName, this._scene);
            newMaterial['parentMaterialName'] = material.id;
            newMaterial = await this.materialToLightMapMaterial(
                entity,
                newMaterial,
                lightmapFileName,
                mesh['layerName']
            );
        } catch (error) {
            MVLogger.error(
                `Failed to create lightmap material ${newMaterialName}`
            );
            console.error(error);
            return material;
        }

        return newMaterial;
    }

    private async createLightmapTexture(params: {
        entity: MVEntity;
        lightmapFileName: string;
        removeFromScene?: boolean;
    }): Promise<BaseTexture | null> {
        const entity = params.entity;
        const lightmapFileName = params.lightmapFileName;

        if (!lightmapFileName) {
            return null;
        }

        const lightmapTextureUrl =
            entity.entityConfig.entityConfigBaseUrl +
            entity.lightmapTexturesUrlRelative +
            lightmapFileName;
        // const allTextures: Texture[] = Object.values(this._scene['mv_textures']);
        const lightmapTextureKey = getTextureKeyFromUrl(
            lightmapTextureUrl,
            entity.entityConfig.postProcessingConfiguration
                ?.lightmapTextureLevel
        );
        // let texture: BaseTexture = allTextures.find((texture: BaseTexture) => {
        //   const textureKey: string = texture['mv_textureKey'];
        //   if (!textureKey) return false;
        //   return textureKey == lightmapTextureKey;
        // });

        // let lightMapTexture: any = this._scene.textures.find((texture: BaseTexture) => {
        //   const textureKey: string = texture['mv_textureKey'];
        //   if (!textureKey) return false;
        //   return lightmapTextureKey == textureKey;
        // });
        let lightMapTexture: BaseTexture =
            this._scene['mv_cached_textures'][lightmapTextureKey];

        if (lightMapTexture) {
            return lightMapTexture;
        }

        // console.log("Creating texture " + entity.lightmapTexturesUrlRelative + lightmapFileName);
        lightMapTexture = await this._textureService.createTexture(
            entity,
            lightmapTextureUrl
        );

        if (!lightMapTexture) return null;

        // this._scene['mv_textures'][(lightMapTexture as Texture).uniqueId] = lightMapTexture;
        // lightMapTexture = new Texture(lightmapTextureUrl, this._scene);
        lightMapTexture['isLightmapTexture'] = true;
        lightMapTexture.name =
            entity.lightmapTexturesUrlRelative + lightmapFileName;
        lightMapTexture['vScale'] = -1;
        lightMapTexture.coordinatesIndex = 1;
        if (
            entity.entityConfig.postProcessingConfiguration
                ?.lightmapTextureLevel
        ) {
            lightMapTexture.level =
                entity.entityConfig.postProcessingConfiguration?.lightmapTextureLevel;
        }

        if (params.removeFromScene) {
            this._scene.removeTexture(lightMapTexture);
        }

        return lightMapTexture;
    }

    /**
     * Adjust the material settings for an lightmap material
     * @param entity -
     * @param lightMapMaterial -
     * @param lightmapFileName -
     * @param layerName -
     */
    private async materialToLightMapMaterial(
        entity: MVEntity,
        lightMapMaterial: MVMaterial,
        lightmapFileName: string,
        layerName: string
    ): Promise<MVMaterial> {
        // lightMapMaterial.id = lightMapMaterial.name;

        const lightMapTexture = await this.createLightmapTexture({
            entity: entity,
            lightmapFileName: lightmapFileName
        });

        lightMapMaterial['isLightmapMaterial'] = true;
        lightMapMaterial.lightmapTexture = lightMapTexture;
        lightMapMaterial.useLightmapAsShadowmap = true;
        return lightMapMaterial;
    }

    public disposeAssetContainers(entity: MVEntity) {
        entity.assetContainers.forEach((assetContainer: AssetContainer) => {
            assetContainer.dispose();
        });
        entity.assetContainers = [];
    }

    public async updateMaterialMapping(
        entity: MVEntity,
        updatedMaterialMappingsJson: MVMaterialMappingsJson,
        originalMaterialName: string,
        relativeTargetMaterialUrl: string,
        slotName?: string
    ) {
        entity.mv_materialMappings = updatedMaterialMappingsJson;

        const fullRelativeTargetMaterialUrl =
            entity.entityConfig.materialsUrlRelative +
            relativeTargetMaterialUrl;
        let targetMaterialJson =
            entity.mv_materials[fullRelativeTargetMaterialUrl];

        if (!targetMaterialJson) {
            const baseUrl = entity.entityConfig.entityConfigBaseUrl;
            const targetMaterialUrl =
                baseUrl +
                entity.entityConfig.materialsUrlRelative +
                relativeTargetMaterialUrl;
            targetMaterialJson = await loadJson(targetMaterialUrl);
            entity.mv_materials[fullRelativeTargetMaterialUrl] =
                targetMaterialJson;
        }

        const targetMaterial: Material = await this.getTargetMaterial(
            entity,
            entity.entityConfig.materialsUrlRelative + relativeTargetMaterialUrl
        );

        const materialMapping: MVMaterialMapping =
            entity.materialMappings.get(originalMaterialName);

        if (!slotName) {
            materialMapping.mapping = relativeTargetMaterialUrl;
            materialMapping.meshes.forEach((mesh) => {
                if (!mesh.isAnInstance) {
                    mesh.material = targetMaterial;
                }
            });
        } else {
            entity = await this._configurationService.updateConfiguration(
                entity,
                entity.activeConfigurationCodes
            );
            await this.applyMaterials(entity);
        }
    }

    public async freezeMeshes(timeoutInMS?: number) {
        if (document.hidden) {
            MVLogger.info('Document hidden. Preventing mesh freezing');
            return;
        }
        if (timeoutInMS) await timeout(timeoutInMS);
        MVLogger.debug('Freezing meshes');
        this._scene.meshes.forEach((mesh: Mesh) => {
            if (mesh.id == '__root__') {
                mesh.dispose();
            }
            mesh._freeze();
        });
    }

    public async freezeMaterialsAfterTimeout(timeoutInMS?: number) {
        if (document.hidden) {
            MVLogger.info('Document hidden. Preventing material freezing');
            return;
        }
        if (timeoutInMS) await timeout(timeoutInMS);
        return freezeMaterials(this._scene);
    }

    public unfreezeMaterials() {
        unfreezeMaterials(this._scene);
    }

    public async disposeUnusedMaterialsAndTextures(timeoutInMS: number) {
        await timeout(timeoutInMS);
        const colorGradingTexture: BaseTexture =
            this._sceneSettingsService.getRenderPipeline().imageProcessing
                ?.colorGradingTexture;
        const backdropTexture =
            this._sceneSettingsService.getBackdropImageLayer()?.texture;
        const environmentTextures =
            this.activeEnvironmentEntity.environmentTextures;
        return disposeUnusedMaterialsAndTextures(
            this._scene,
            colorGradingTexture,
            backdropTexture as Texture,
            environmentTextures,
            this._coreSettings.enableLazyLoading
        );
    }

    public resetLoadingStatus(entity: MVEntity) {
        entity.loadingStatus.totalAssetsToLoad = 0;
        entity.loadingStatus.loadedAssetsCount = 0;
        entity.loadingStatus.loadingProgressPercentage = 0;
        entity.onLoadingProgressUpdate$.next(
            entity.loadingStatus.loadingProgressPercentage
        );
    }

    public incrementLoadedAssetCount(entity: MVEntity) {
        entity.loadingStatus.loadedAssetsCount++;
        entity.loadingStatus.loadingProgressPercentage =
            (entity.loadingStatus.loadedAssetsCount /
                entity.loadingStatus.totalAssetsToLoad) *
            100;
        entity.onLoadingProgressUpdate$.next(
            entity.loadingStatus.loadingProgressPercentage
        );
    }
}
