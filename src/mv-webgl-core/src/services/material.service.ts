import {
    Scene,
    Material,
    BaseTexture,
    NodeMaterial,
    Color3,
    InspectableType,
    ClearCoatBlock,
    PBRMetallicRoughnessBlock,
    Texture,
    TextureBlock,
    InputBlock,
    SceneLoader,
    PBRMaterial
} from 'babylonjs';
import { Subject } from 'rxjs';
import { MVMaterial, MVMaterialJSON } from '../models/material';
import { injectable, inject } from 'inversify';
import { TYPES } from '../ioc/types';
import { MVLogger } from '../logging';
import {
    getTextureKeyFromTexture,
    isEmissiveMaterial,
    isTransparentMaterial,
    jsonToTexture,
    loadJson,
    TEXTURE_PROPERTIES
} from '../helper';
import { MVEntity } from '../models/entity/mv-entity';
import { CoreSettings } from '../settings';
import { timeout } from 'rxjs/operators';

/**
 * Material Class
 */
@injectable()
export class MaterialService {
    private materialsInLoading: string[] = [];
    private materialsInLoadingChange$: Subject<void> = new Subject<void>();
    private baseVCAONodeMaterial: NodeMaterial;

    public materialsLoaded$: Subject<void> = new Subject<void>();

    /**
     * Create new Material-Service
     * @param _scene - Current Scene
     * @param _jsonLoader - JsonService for loading missing assets
     */
    constructor(
        @inject(TYPES.Scene) private _scene: Scene,
        @inject(TYPES.CoreSettings) private _coreSettings: CoreSettings
    ) {
        this.materialsInLoadingChange$.subscribe(() => {
            if (this.materialsInLoading.length === 0)
                this.materialsLoaded$.next();
        });
    }

    /**
     * Get material from scene with id
     * @param id - ID of the material
     */
    public getMaterial(id: string): Material {
        // return this._scene['mv_materials'][id];
        return this._scene.materials.find(
            (material: Material) => material.id === id
        );
    }

    public async mv_createMaterial(
        entity: MVEntity,
        materialsBaseUrl: string,
        textureBaseUrl: string,
        url: string,
        environmentBRDFTextureUrl?: string
    ): Promise<MVMaterial | NodeMaterial> {
        const material = this.getMaterial(url);

        if (material) {
            return this.getMaterial(url) as MVMaterial;
        }

        if (url.includes('.glb')) {
            const result = await SceneLoader.ImportMeshAsync(
                null,
                materialsBaseUrl,
                url,
                this._scene
            );
            // Remove imported meshes, keep only materials
            result.meshes.forEach((mesh) => mesh.dispose());

            const glb_name = url.split('/').pop().split('.')[0];
            const loadedMaterial = this.getMaterial(glb_name);
            if (loadedMaterial) {
                const pbrMaterial = loadedMaterial as PBRMaterial;

                if (false && pbrMaterial instanceof PBRMaterial) {
                    try {
                        const materialConfig =
                            pbrMaterial.serialize() as MVMaterialJSON;
                        const materialConfigWithoutTextures: any = {
                            ...materialConfig
                        };
                        for (const textureProperty of TEXTURE_PROPERTIES) {
                            delete materialConfigWithoutTextures[
                                textureProperty
                            ];
                        }
                        delete materialConfigWithoutTextures.detailMap;
                        delete materialConfigWithoutTextures.environmentBRDFTexture;

                        const VCAOIntensity =
                            entity.entityConfig.VCAOIntensity !== undefined
                                ? entity.entityConfig.VCAOIntensity
                                : 1;
                        const useVCAO =
                            entity.entityConfig.useVCAOForPBRMaterials;
                        const material = new MVMaterial(
                            url,
                            url,
                            this._scene,
                            materialConfigWithoutTextures,
                            textureBaseUrl,
                            useVCAO,
                            0.1
                        );
                        await material.parseMaterialFromConfig(
                            url,
                            materialConfigWithoutTextures,
                            this._scene,
                            textureBaseUrl,
                            environmentBRDFTextureUrl
                        );

                        for (const textureProperty of TEXTURE_PROPERTIES) {
                            const texture = (pbrMaterial as any)[
                                textureProperty
                            ] as BaseTexture;
                            if (texture) {
                                (material as any)[textureProperty] = texture;
                            }
                        }

                        if (pbrMaterial.environmentBRDFTexture) {
                            material.environmentBRDFTexture =
                                pbrMaterial.environmentBRDFTexture;
                        }

                        const pbrDetailMap = (pbrMaterial as any).detailMap;
                        const materialDetailMap = (material as any).detailMap;
                        if (pbrDetailMap && materialDetailMap) {
                            materialDetailMap.texture = pbrDetailMap.texture;
                            materialDetailMap.isEnabled =
                                pbrDetailMap.isEnabled;
                            materialDetailMap.bumpLevel =
                                pbrDetailMap.bumpLevel;
                            materialDetailMap.normalBlendMethod =
                                pbrDetailMap.normalBlendMethod;
                            materialDetailMap.roughnessBlendLevel =
                                pbrDetailMap.roughnessBlendLevel;
                            materialDetailMap.diffuseBlendLevel =
                                pbrDetailMap.diffuseBlendLevel;
                        }

                        material.id = url;
                        material.name = url;
                        material['url'] = url;
                        material['childMaterialNames'] = [];

                        pbrMaterial.dispose(false, false);
                        return material;
                    } catch (error) {
                        MVLogger.error(
                            `Failed to upgrade imported PBR material to MVMaterial: ${error}`
                        );
                    }
                }

                loadedMaterial.id = url;
                loadedMaterial.name = url;
                loadedMaterial['url'] = url;
                return loadedMaterial as MVMaterial;
            }
            return null;
        }

        try {
            const materialConfig = entity.mv_materials[url];
            if (materialConfig.customType == 'BABYLON.NodeMaterial') {
                const nodeMaterial = NodeMaterial.Parse(
                    materialConfig,
                    this._scene,
                    textureBaseUrl
                );
                const texturePromises = [];
                const textureBlocks = nodeMaterial.getTextureBlocks();
                for (let textureBlock of textureBlocks) {
                    if (textureBlock instanceof TextureBlock) {
                        const texture = textureBlock.texture as Texture;

                        if (texture && texture.onLoadObservable) {
                            const textureLoadedPromise = new Promise(
                                (resolve) => {
                                    texture.onLoadObservable.add(() => {
                                        const textureKey =
                                            getTextureKeyFromTexture(texture);
                                        texture['mv_textureKey'] = textureKey;
                                        this._scene['mv_cached_textures'][
                                            textureKey
                                        ] = texture;
                                        texture['mv_isMaterialTexture'] = true;
                                        return resolve(true);
                                    });
                                }
                            );
                            texturePromises.push(textureLoadedPromise);
                        }
                    }
                }
                (await Promise.all(texturePromises),
                    (nodeMaterial['isMVNodeMaterial'] = true)); // necessary to display save button inside of scene explorer
                nodeMaterial.id = url;
                nodeMaterial.name = url;
                nodeMaterial['url'] = url;
                nodeMaterial['childMaterialNames'] = [];
                // this._scene.addMaterial(nodeMaterial);
                nodeMaterial.build();
                return nodeMaterial;
            } else if (
                materialConfig.customType == 'BABYLON.PBRMaterial' &&
                entity.entityConfig.convertPBRToNodeMaterials &&
                entity.entityConfig.defaultNodeMaterialUrlRelative &&
                !isTransparentMaterial(
                    materialConfig.transparencyMode,
                    materialConfig.alpha,
                    materialConfig.opacityTexture
                ) &&
                !isEmissiveMaterial(materialConfig) &&
                !materialConfig.unlit
            ) {
                return await this.createVCAONodeMaterialFromPBRMaterial(
                    entity,
                    url,
                    materialConfig,
                    textureBaseUrl
                );
            } else if (materialConfig.customType == 'BABYLON.PBRMaterial') {
                const VCAOIntensity =
                    entity.entityConfig.VCAOIntensity !== undefined
                        ? entity.entityConfig.VCAOIntensity
                        : 1;
                const useVCAO = entity.entityConfig.useVCAOForPBRMaterials;
                const material = new MVMaterial(
                    url,
                    url,
                    this._scene,
                    materialConfig,
                    textureBaseUrl,
                    useVCAO,
                    VCAOIntensity
                );
                await material.parseMaterialFromConfig(
                    url,
                    materialConfig,
                    this._scene,
                    textureBaseUrl,
                    environmentBRDFTextureUrl
                );
                material.id = url;
                material.name = url;
                material['url'] = url;
                material['childMaterialNames'] = [];

                return material;
            }
        } catch (error) {
            MVLogger.error(error);
        }
        return null;
    }

    /**
     * Creates a new material from a json file which was created by using the SerializationHelper from Babylon JS.
     * The material json file can either contain data of a PBRMaterial or a Node Material.
     * If the passed material json is a PBRMaterial this function created a new MVMaterial (extends PBRMaterial) and returns it.
     * @param materialsBaseUrl - url to the materials directory relative to the current entity config file
     * @param textureBaseUrl - url to the textures directory relative to the current entity config file
     * @param url -url to the material json file relative to the materials base url
     * @param environmentBRDFTextureUrl -
     */
    public async createActionItemMaterial(
        materialsBaseUrl: string,
        textureBaseUrl: string,
        url: string,
        environmentBRDFTextureUrl?: string
    ): Promise<MVMaterial | NodeMaterial> {
        const material = this.getMaterial(url);

        if (material) {
            return this.getMaterial(url) as MVMaterial;
        }

        if (this.createMaterialInLoadingQue(url)) {
            const fullMaterialJsonUrl = materialsBaseUrl + url;
            try {
                const materialConfig = await loadJson<any>(fullMaterialJsonUrl);
                if (materialConfig.customType == 'BABYLON.NodeMaterial') {
                    const nodeMaterial = NodeMaterial.Parse(
                        materialConfig,
                        this._scene,
                        textureBaseUrl
                    );
                    nodeMaterial['isMVMaterial'] = true; // necessary to display save button inside of scene explorer
                    nodeMaterial.id = url;
                    nodeMaterial.name = url;
                    nodeMaterial['url'] = fullMaterialJsonUrl;
                    nodeMaterial['childMaterialNames'] = [];
                    return nodeMaterial;
                } else {
                    const material = new MVMaterial(
                        url,
                        url,
                        this._scene,
                        materialConfig,
                        textureBaseUrl
                    );
                    await material.parseMaterialFromConfig(
                        url,
                        materialConfig,
                        this._scene,
                        textureBaseUrl,
                        environmentBRDFTextureUrl
                    );
                    material.id = url;
                    material.name = url;
                    material['url'] = fullMaterialJsonUrl;
                    material['childMaterialNames'] = [];
                    this.removeMaterialInLoadingQue(url);
                    return material;
                }
            } catch (error) {
                MVLogger.error(error);
            }
        }
        return null;
    }

    private createMaterialInLoadingQue(materialName: string): boolean {
        const i = this.materialsInLoading.indexOf(materialName);
        if (i !== -1) return false;
        this.materialsInLoading.push(materialName);
        this.materialsInLoadingChange$.next();
        return true;
    }

    private removeMaterialInLoadingQue(materialName: string): void {
        const i = this.materialsInLoading.indexOf(materialName);
        if (i !== -1) {
            this.materialsInLoading.splice(i, 1);
            this.materialsInLoadingChange$.next();
        }
    }

    /**
     * Deletes a material from the BabylonJS scene based on its ID.
     * @param id - ID of the material
     */
    public deleteMaterial(id: string): void {
        this.getMaterial(id)?.dispose();
    }

    public setInpectableCustomPropertiesForNodeMaterial(
        material: NodeMaterial
    ) {
        material.inspectableCustomProperties = [
            {
                label: 'Environment Intensity',
                propertyName: 'mv_environmentIntensity',
                type: InspectableType.Slider,
                min: 0,
                max: 10
            },
            {
                label: 'Direct Intensity',
                propertyName: 'mv_directIntensity',
                type: InspectableType.Slider,
                min: 0,
                max: 10
            },
            {
                label: 'Specular Intensity',
                propertyName: 'mv_specularIntensity',
                type: InspectableType.Slider,
                min: 0,
                max: 10
            },
            {
                label: 'Unlit',
                propertyName: 'mv_unlit',
                type: InspectableType.Checkbox
            },
            {
                label: 'Metallic F0 Factor',
                propertyName: '_metallicF0Factor',
                type: InspectableType.Slider,
                min: 0,
                max: 5
            }
        ];
    }

    public async createVCAONodeMaterialFromPBRMaterial(
        entity: MVEntity,
        url: string,
        materialConfig: MVMaterialJSON,
        textureBaseUrl: string
    ): Promise<NodeMaterial> {
        if (!this.baseVCAONodeMaterial) {
            try {
                const vcaoBaseMaterialUrlRelative =
                    entity.entityConfig.materialsUrlRelative +
                    entity.entityConfig.defaultNodeMaterialUrlRelative;
                const vcaoBaseMaterialJSON =
                    entity.mv_materials[vcaoBaseMaterialUrlRelative];
                this.baseVCAONodeMaterial = NodeMaterial.Parse(
                    vcaoBaseMaterialJSON,
                    this._scene,
                    textureBaseUrl
                ) as NodeMaterial;
            } catch (error) {
                this.baseVCAONodeMaterial = null;
                MVLogger.error(
                    `Failed to load base vcao node material. Fallback to PBRMaterials.`,
                    error
                );
                return null;
            }
        }

        const vcaoNodeMaterial: NodeMaterial = this.baseVCAONodeMaterial.clone(
            url
        ) as NodeMaterial;
        vcaoNodeMaterial['isMVNodeMaterial'] = true;
        vcaoNodeMaterial['isMVVCAONodeMaterial'] = true;
        vcaoNodeMaterial.id = url;
        vcaoNodeMaterial.name = url;
        const pbrMetallicRoughnessBlock = vcaoNodeMaterial.getBlockByName(
            'PBRMetallicRoughness'
        ) as PBRMetallicRoughnessBlock;
        const perturbNormalBlock =
            vcaoNodeMaterial.getBlockByName('Perturb normal');
        const iorBlock = vcaoNodeMaterial.getBlockByName(
            'Index of Refraction'
        ) as InputBlock;
        const bumpIntensityBlock = vcaoNodeMaterial.getBlockByName(
            'Bump intensity'
        ) as InputBlock;

        pbrMetallicRoughnessBlock['_metallicF0Factor'] =
            materialConfig.metallicF0Factor === undefined
                ? pbrMetallicRoughnessBlock['_metallicF0Factor']
                : materialConfig.metallicF0Factor + 1;
        pbrMetallicRoughnessBlock.enableSpecularAntiAliasing =
            materialConfig.enableSpecularAntiAliasing === undefined
                ? false
                : materialConfig.enableSpecularAntiAliasing;
        pbrMetallicRoughnessBlock.forceNormalForward =
            materialConfig.forceNormalForward === undefined
                ? false
                : materialConfig.forceNormalForward;
        pbrMetallicRoughnessBlock.useHorizonOcclusion =
            materialConfig.useHorizonOcclusion === undefined
                ? true
                : materialConfig.useHorizonOcclusion;
        pbrMetallicRoughnessBlock.useRadianceOcclusion =
            materialConfig.useRadianceOcclusion === undefined
                ? true
                : materialConfig.useRadianceOcclusion;
        pbrMetallicRoughnessBlock.useSpecularOverAlpha =
            materialConfig.useSpecularOverAlpha === undefined
                ? false
                : materialConfig.useSpecularOverAlpha;
        pbrMetallicRoughnessBlock.useRadianceOverAlpha =
            materialConfig.useRadianceOverAlpha === undefined
                ? false
                : materialConfig.useRadianceOverAlpha;

        vcaoNodeMaterial['_metallicF0Factor'] =
            pbrMetallicRoughnessBlock['_metallicF0Factor'];

        if (materialConfig.clearCoat.isEnabled) {
            const clearCoatBlock =
                vcaoNodeMaterial.getBlockByName('ClearCoatBlock');
            clearCoatBlock.connectTo(pbrMetallicRoughnessBlock, {
                input: 'clearcoat',
                output: 'clearcoat'
            });
        }

        if (materialConfig.albedoTexture) {
            const albedoTextureBlock = vcaoNodeMaterial.getBlockByName(
                'Albedo Texture'
            ) as TextureBlock;
            albedoTextureBlock.texture = (await jsonToTexture(
                materialConfig.albedoTexture,
                this._scene,
                textureBaseUrl
            )) as Texture;
            vcaoNodeMaterial['albedoTexture'] = albedoTextureBlock.texture;
            const albedoTextureEnabledBlock = vcaoNodeMaterial.getBlockByName(
                'Albedo Texture Enabled'
            ) as InputBlock;
            albedoTextureEnabledBlock.value.r = 1;
            albedoTextureEnabledBlock.value.g = 1;
            albedoTextureEnabledBlock.value.b = 1;

            const albedoTextureLevelBlock = vcaoNodeMaterial.getBlockByName(
                'Albedo Texture Level'
            ) as InputBlock;
            if (albedoTextureLevelBlock) {
                // this is necessary. setting the level in the texture causes artifacts
                albedoTextureBlock.texture.level = 1;
                albedoTextureLevelBlock.value =
                    materialConfig.albedoTexture.level;
            }
        }

        if (materialConfig.indexOfRefraction !== undefined) {
            iorBlock.value = materialConfig.indexOfRefraction;
        }

        if (materialConfig.bumpTexture) {
            const bumpTextureBlock = vcaoNodeMaterial.getBlockByName(
                'Bump Texture'
            ) as TextureBlock;
            bumpTextureBlock.texture = (await jsonToTexture(
                (materialConfig as MVMaterialJSON).bumpTexture,
                this._scene,
                textureBaseUrl
            )) as Texture;
            vcaoNodeMaterial['bumpTexture'] = bumpTextureBlock.texture;
            bumpTextureBlock.texture.level = 1;
            // for some reason the normal intensity of the production meshes needs to divided by 100
            const bumpIntensityFactor = entity.mv_glbMetaData ? 0.01 : 1;
            bumpIntensityBlock.value =
                materialConfig.bumpTexture.level * bumpIntensityFactor;
            perturbNormalBlock.connectTo(pbrMetallicRoughnessBlock, {
                input: 'perturbedNormal',
                output: 'output'
            });
        }

        if (materialConfig.ambientTexture) {
            const ambientTextureBlock = vcaoNodeMaterial.getBlockByName(
                'Ambient Texture'
            ) as TextureBlock;
            ambientTextureBlock.texture = (await jsonToTexture(
                (materialConfig as MVMaterialJSON).ambientTexture,
                this._scene,
                textureBaseUrl
            )) as Texture;
            vcaoNodeMaterial['ambientTexture'] = ambientTextureBlock.texture;
            ambientTextureBlock.connectTo(pbrMetallicRoughnessBlock, {
                input: 'ambientColor',
                output: 'rgb'
            });
        }

        const metallicRoughnessTextureBlock = vcaoNodeMaterial.getBlockByName(
            'Metallic Roughness Texture'
        ) as TextureBlock;
        if (metallicRoughnessTextureBlock && materialConfig.metallicTexture) {
            metallicRoughnessTextureBlock.texture = (await jsonToTexture(
                (materialConfig as MVMaterialJSON).metallicTexture,
                this._scene,
                textureBaseUrl
            )) as Texture;
            vcaoNodeMaterial['metallicTexture'] =
                metallicRoughnessTextureBlock.texture;

            // if ((materialConfig as MVMaterialJSON).useRoughnessFromMetallicTextureAlpha) {
            //   metallicRoughnessTextureBlock.connectTo(pbrMetallicRoughnessBlock, {input: 'roughness', output: 'a'})
            // }

            if (
                (materialConfig as MVMaterialJSON)
                    .useRoughnessFromMetallicTextureGreen
            ) {
                metallicRoughnessTextureBlock.connectTo(
                    pbrMetallicRoughnessBlock,
                    { input: 'roughness', output: 'g' }
                );
            }

            if (
                (materialConfig as MVMaterialJSON)
                    .useMetallnessFromMetallicTextureBlue
            ) {
                metallicRoughnessTextureBlock.connectTo(
                    pbrMetallicRoughnessBlock,
                    { input: 'metallic', output: 'b' }
                );
            }

            if (
                (materialConfig as MVMaterialJSON)
                    .useAmbientOcclusionFromMetallicTextureRed
            ) {
                metallicRoughnessTextureBlock.connectTo(
                    pbrMetallicRoughnessBlock,
                    { input: 'ambientOcc', output: 'r' }
                );
            }
        }

        const metallicReflectanceColor =
            materialConfig.metallicReflectanceColor;
        if (metallicReflectanceColor) {
            pbrMetallicRoughnessBlock['_metallicReflectanceColor'] = new Color3(
                metallicReflectanceColor[0],
                metallicReflectanceColor[1],
                metallicReflectanceColor[2]
            );
        }

        if (materialConfig.microSurfaceTexture) {
            const microSurfaceLerpBlock =
                vcaoNodeMaterial.getBlockByName('MicroSurfaceLerp');
            const microSurfaceTextureBlock = vcaoNodeMaterial.getBlockByName(
                'Micro Surface Texture'
            ) as TextureBlock;
            const roughnessBlock = vcaoNodeMaterial.getBlockByName(
                'Roughness'
            ) as InputBlock;

            microSurfaceTextureBlock.texture = (await jsonToTexture(
                (materialConfig as MVMaterialJSON).microSurfaceTexture,
                this._scene,
                textureBaseUrl
            )) as Texture;
            vcaoNodeMaterial['microSurfaceTexture'] =
                microSurfaceTextureBlock.texture;
            microSurfaceLerpBlock.connectTo(pbrMetallicRoughnessBlock, {
                input: 'roughness'
            });
        }

        vcaoNodeMaterial['mv_environmentIntensity'] = 1;
        if (materialConfig.environmentIntensity !== undefined) {
            pbrMetallicRoughnessBlock.environmentIntensity =
                materialConfig.environmentIntensity;
            vcaoNodeMaterial['mv_environmentIntensity'] =
                materialConfig.environmentIntensity;
        }

        vcaoNodeMaterial['mv_directIntensity'] = 1;
        if (materialConfig.directIntensity !== undefined) {
            pbrMetallicRoughnessBlock.directIntensity =
                materialConfig.directIntensity;
            vcaoNodeMaterial['mv_directIntensity'] =
                materialConfig.directIntensity;
        }

        vcaoNodeMaterial['mv_directIntensity'] = 1;
        if (materialConfig.specularIntensity !== undefined) {
            pbrMetallicRoughnessBlock.specularIntensity =
                materialConfig.specularIntensity;
            vcaoNodeMaterial['mv_specularIntensity'] =
                materialConfig.specularIntensity;
        }

        vcaoNodeMaterial['mv_unlit'] = false;
        if (materialConfig.unlit !== undefined) {
            vcaoNodeMaterial['mv_unlit'] = materialConfig.unlit;
        }

        const clearCoatBlock = vcaoNodeMaterial.getBlockByName(
            'ClearCoatBlock'
        ) as ClearCoatBlock;
        const clearCoatIntensityBlock = vcaoNodeMaterial.getBlockByName(
            'ClearCoat intensity'
        ) as InputBlock;

        if (materialConfig.clearCoat?.isEnabled && clearCoatBlock) {
            clearCoatIntensityBlock.value = materialConfig.clearCoat.intensity;

            const clearCoatRoughnessBlock = vcaoNodeMaterial.getBlockByName(
                'ClearCoat roughness'
            ) as InputBlock;
            clearCoatRoughnessBlock.value = materialConfig.clearCoat.roughness;

            const clearCoatIORBlock = vcaoNodeMaterial.getBlockByName(
                'ClearCoat IOR'
            ) as InputBlock;
            clearCoatIORBlock.value =
                materialConfig.clearCoat.indexOfRefraction;

            if (materialConfig.clearCoat.isTintEnabled) {
                if (materialConfig.clearCoat.tintColor) {
                    const clearCoatTintColorBlock =
                        vcaoNodeMaterial.getBlockByName(
                            'ClearCoat tintColor'
                        ) as InputBlock;
                    const tintColor = materialConfig.clearCoat.tintColor;
                    clearCoatTintColorBlock.value = tintColor
                        ? new Color3(
                              tintColor[0],
                              tintColor[1],
                              tintColor[2]
                          ).toGammaSpace()
                        : new Color3(0, 0, 0);
                    clearCoatTintColorBlock.connectTo(clearCoatBlock, {
                        input: 'tintColor'
                    });
                }

                if (
                    materialConfig.clearCoat.tintColorAtDistance !== undefined
                ) {
                    const clearCoatTintAtDistanceBlock =
                        vcaoNodeMaterial.getBlockByName(
                            'ClearCoat tintAtDistance'
                        ) as InputBlock;
                    clearCoatTintAtDistanceBlock.value =
                        materialConfig.clearCoat.tintColorAtDistance;
                    clearCoatTintAtDistanceBlock.connectTo(clearCoatBlock, {
                        input: 'tintAtDistance'
                    });
                }

                if (materialConfig.clearCoat.tintThickness !== undefined) {
                    const clearCoatTintThicknessBlock =
                        vcaoNodeMaterial.getBlockByName(
                            'ClearCoat tintThickness'
                        ) as InputBlock;
                    clearCoatTintThicknessBlock.value =
                        materialConfig.clearCoat.tintThickness;
                    clearCoatTintThicknessBlock.connectTo(clearCoatBlock, {
                        input: 'tintThickness'
                    });
                }
            }
        } else {
            clearCoatIntensityBlock.value = 0;
        }

        if (materialConfig.albedo) {
            const albedoColorBlock = vcaoNodeMaterial.getBlockByName(
                'Base Color'
            ) as InputBlock;
            const albedoColor = materialConfig.albedo;
            albedoColorBlock.value = albedoColor
                ? new Color3(
                      albedoColor[0],
                      albedoColor[1],
                      albedoColor[2]
                  ).toGammaSpace()
                : new Color3(0, 0, 0);
        }

        if (materialConfig.roughness !== undefined) {
            const roughnessBlock = vcaoNodeMaterial.getBlockByName(
                'Roughness'
            ) as InputBlock;
            roughnessBlock.value = materialConfig.roughness;
        }

        if (materialConfig.metallic !== undefined) {
            const metallicBlock = vcaoNodeMaterial.getBlockByName(
                'Metallic'
            ) as InputBlock;
            metallicBlock.value = materialConfig.metallic;
        }

        // const VCAOMultiplyBlock = vcaoNodeMaterial.getBlockByName('VCAO Multiply') as InputBlock;
        // if (VCAOMultiplyBlock) {
        //   VCAOMultiplyBlock.value = 1.5;
        // }

        const VCAOIntensityBlock = vcaoNodeMaterial.getBlockByName(
            'VCAO Intensity'
        ) as InputBlock;
        if (VCAOIntensityBlock) {
            VCAOIntensityBlock.value = 1;
            if (materialConfig.mv_vcao_intensity !== undefined) {
                VCAOIntensityBlock.value = materialConfig.mv_vcao_intensity;
            }
        }

        if (materialConfig.zOffset !== undefined) {
            vcaoNodeMaterial.zOffset = materialConfig.zOffset;
        }

        if (materialConfig.backFaceCulling !== undefined) {
            vcaoNodeMaterial.backFaceCulling = materialConfig.backFaceCulling;
        }

        this.setInpectableCustomPropertiesForNodeMaterial(vcaoNodeMaterial);

        vcaoNodeMaterial.build();

        return vcaoNodeMaterial as NodeMaterial;
    }
}
