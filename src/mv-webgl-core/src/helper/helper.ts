import {
    AbstractMesh,
    AssetContainer,
    BaseTexture,
    Camera,
    Color3,
    Color4,
    Light,
    Material,
    Node,
    NodeMaterial,
    PBRMaterial,
    Scene,
    Texture,
    Vector3
} from 'babylonjs';
import { MVLogger } from '..';
import { MVEntity, MVMaterialMapping } from '../models';
import { MVLayer } from '../models/entity/mv-layer';
import { MVMaterialJSON, TextureJSON } from '../models/material/interfaces';

export const TEXTURE_TYPES = [
    'albedo',
    'metallic',
    'reflection',
    'refraction',
    'microSurface',
    'bump',
    'emissive',
    'opacity',
    'ambient',
    'lightmap'
];

export const TEXTURE_PROPERTIES = [
    'albedoTexture',
    'metallicTexture',
    'reflectionTexture',
    'refractionTexture',
    'microSurfaceTexture',
    'bumpTexture',
    'emissiveTexture',
    'opacityTexture',
    'ambientTexture',
    'lightmapTexture'
];

/**
 * Check if variable is string
 * @param obj -
 *
 */
export const isString = (obj: unknown): boolean => {
    return typeof obj === 'string' || obj instanceof String;
};

/**
 * Check if variable is boolean
 * @param obj -
 *
 */
export const isBoolean = (obj: unknown): boolean => {
    return typeof obj === 'boolean';
};

/**
 * Check if variable is number
 * @param obj -
 *
 */
export const isNumber = (obj: any): boolean => {
    return !isNaN(parseFloat(obj)) && !isNaN(obj - 0);
};

/**
 * Check if a object is a Color3
 * @param obj -
 *
 */
export const isColor3 = (obj: unknown): obj is Color3 => {
    return (
        obj &&
        typeof obj === 'object' &&
        typeof obj['r'] === 'number' &&
        typeof obj['g'] === 'number' &&
        typeof obj['b'] === 'number'
    );
};

/**
 * Converts an array to Color3 object
 * @param arr -
 */
export const arrayToColor3 = (arr: number[]): Color3 => {
    if (!arr) {
        return new Color3(0, 0, 0);
    }
    return new Color3(arr[0], arr[1], arr[2]);
};

export const jsonToTextureParams = async (params: {
    json: TextureJSON;
    scene: Scene;
    baseUrl: string;
    removeFromScene?: boolean;
}): Promise<BaseTexture> => {
    const texture = await jsonToTexture(
        params.json,
        params.scene,
        params.baseUrl
    );
    if (params.removeFromScene) {
        // params.scene.removeTexture(texture);
    }
    return texture;
};

/**
 * Converts a JSON to Texture object.
 * @param json -
 * @param scene -
 * @param baseUrl -
 */
export const jsonToTexture = async (
    json: TextureJSON,
    scene: Scene,
    baseUrl: string
): Promise<BaseTexture> => {
    const fullUrl = baseUrl + json.url;
    // const allTextures: Texture[] = Object.values(scene['mv_textures']);
    const jsonTextureKey = getTextureKeyFromJson(json, baseUrl);
    let texture: BaseTexture = scene['mv_cached_textures'][jsonTextureKey];

    if (texture) {
        // const textureExistsInScene: BaseTexture = scene.textures.find((texture: BaseTexture) => {
        //   const textureKey: string = texture['mv_textureKey'];
        //   if (!textureKey) return false;
        //   return textureKey == jsonTextureKey;
        // });
        // if (!textureExistsInScene) {
        //   scene.addTexture(texture)
        // }
        return texture;
    }
    texture = await createJsonToTexturePromise(json, scene, baseUrl);
    // scene['mv_textures'][texture.uniqueId] = texture;
    return texture;
};

export const getTextureKeyFromJson = (json: TextureJSON, baseUrl): string => {
    if (!json || !json.url) return null;
    const fullUrl = baseUrl + json.url;
    const uScale = json.uScale ? json.uScale.toString() : 1;
    const vScale = json.vScale ? json.vScale.toString() : 1;
    const uOffset = json.uOffset ? json.uOffset.toString() : 0;
    const vOffset = json.vOffset ? json.vOffset.toString() : 0;
    const level = json.level ? json.level.toString() : 1;
    const getAlphaFromRGB = json.getAlphaFromRGB ? 'true' : 'false';

    return `${fullUrl}_${uScale}_${vScale}_${uOffset}_${vOffset}_${level}_${getAlphaFromRGB}`;
};

export const getTextureKeyFromTexture = (texture: BaseTexture): string => {
    const internalTexture = texture.getInternalTexture();
    if (!internalTexture) {
        return null;
    }
    const uScale = texture['uScale'] ? texture['uScale'].toString() : 1;
    const vScale = texture['vScale'] ? texture['vScale'].toString() : 1;
    const uOffset = texture['uOffset'] ? texture['uOffset'].toString() : 0;
    const vOffset = texture['vOffset'] ? texture['vOffset'].toString() : 0;
    const level = texture.level ? texture.level.toString() : 1;
    const getAlphaFromRGB = texture.getAlphaFromRGB ? 'true' : 'false';

    return `${internalTexture.url}_${uScale}_${vScale}_${uOffset}_${vOffset}_${level}_${getAlphaFromRGB}`;
};

export const getTextureKeyFromUrl = (url: string, level?: number): string => {
    if (level == undefined || level == null) {
        level = 1;
    }
    return `${url}_1_-1_0_0_${level}_false`;
};

export const createJsonToTexturePromise = (
    json: TextureJSON,
    scene: Scene,
    baseUrl: string
) => {
    return new Promise<BaseTexture>(
        (resolve: CallableFunction, reject: CallableFunction) => {
            const url = baseUrl + json.url;
            // console.log("Creating texture " + json.url);
            let texture: Texture;
            try {
                // texture = new Texture(url, scene);
                texture = new Texture(url, scene, false, true, 2, null, () => {
                    console.error('Texture not found: ' + url);
                    return null;
                });
            } catch (error) {
                console.error('Texture not found: ' + url);
                return null;
            }
            const textureKey = getTextureKeyFromJson(json, baseUrl);
            texture['mv_textureKey'] = textureKey;
            scene['mv_cached_textures'][textureKey] = texture;
            // scene.addTexture(texture);
            texture.onLoadObservable.addOnce(() => {
                texture['mv_isMaterialTexture'] = true;
                texture.url = json.url;
                texture.uOffset = json.uOffset;
                texture.vOffset = json.vOffset;
                texture.uScale = json.uScale;
                texture.vScale = json.vScale;
                texture.uRotationCenter = json.uRotationCenter;
                texture.vRotationCenter = json.vRotationCenter;
                texture.wRotationCenter = json.wRotationCenter;
                // texture.isBlocking = json.isBlocking;
                // texture.uniqueId = json.uniqueId;
                texture.name = json.name;
                texture.hasAlpha = json.hasAlpha;
                texture.getAlphaFromRGB = json.getAlphaFromRGB;
                texture.level = json.level;
                texture.wrapU = json.wrapU;
                texture.wrapV = json.wrapV;
                texture.wrapR = json.wrapR;
                texture.anisotropicFilteringLevel =
                    json.anisotropicFilteringLevel;
                (texture as any).isCube = json.isCube;
                (texture as any).is3D = json.is3D;
                (texture as any).is2DArray = json.is2DArray;
                texture.gammaSpace = json.gammaSpace;
                texture.invertZ = json.invertZ;
                texture.lodLevelInAlpha = json.lodLevelInAlpha;
                texture.lodGenerationOffset = json.lodGenerationOffset;
                texture.lodGenerationScale = json.lodGenerationScale;
                texture.linearSpecularLOD = json.linearSpecularLOD;
                texture.isRenderTarget = json.isRenderTarget;
                // texture.animations = json.animations;
                texture._invertY = json.invertY;
                texture.updateSamplingMode(json.samplingMode);
                texture.coordinatesIndex = json.coordinatesIndex;
                resolve(texture);
            });
        }
    );
};

/**
 * Check if a object is a Light Color3
 * @param arr -
 *
 */
export const isColor3Array = (arr: unknown): arr is Color3 => {
    return (
        arr &&
        Array.isArray(arr) &&
        arr.length === 3 &&
        typeof arr[0] === 'number' &&
        typeof arr[1] === 'number' &&
        typeof arr[2] === 'number'
    );
};

/**
 * Check if a object is a Color4
 * @param obj -
 *
 */
export const isColor4 = (obj: unknown): obj is Color4 => {
    return (
        obj &&
        typeof obj === 'object' &&
        typeof obj['r'] === 'number' &&
        typeof obj['g'] === 'number' &&
        typeof obj['b'] === 'number' &&
        typeof obj['a'] === 'number'
    );
};

/**
 * Check if a object is a Light Vector3
 * @param arr -
 *
 */
export const isVector3Array = (arr: unknown): arr is Vector3 => {
    return (
        arr &&
        Array.isArray(arr) &&
        arr.length === 3 &&
        typeof arr[0] === 'number' &&
        typeof arr[1] === 'number' &&
        typeof arr[2] === 'number'
    );
};

/**
 * Gets a child node by id if it exists.
 * @param node - Babylon Node
 * @param id -
 *
 */
export const getChildNodeById = (node: Node, id: string): Node => {
    if (node.id == id) {
        return node;
    }
    const children: Node[] = node.getChildren();
    if (children) {
        for (const child of children) {
            const foundNode: Node = getChildNodeById(child, id);
            if (foundNode) {
                return foundNode;
            }
        }
    }
    return null;
};

/**
 * Modulo function that gives a positive result for negative numbers
 * @param n - Modulo Dividend
 * @param m - Modulo Divisor
 *
 */
export const modulo = (n: number, m: number): number => {
    return ((n % m) + m) % m;
};

export const getChildCamera = (node: Node): Camera => {
    if (node['_isCamera']) {
        return node as Camera;
    }
    const children: Node[] = node.getChildren();
    if (children) {
        for (const child of children) {
            const foundNode: Node = getChildCamera(child);
            if (foundNode) {
                return foundNode as Camera;
            }
        }
    }
    return null;
};

/**
 * Checks if the current device is a mobile device
 */
export const detectMobileDevice = (): any => {
    if (screen.width < 1000) {
        return true;
    }
    if (window.innerWidth < 1000) {
        return true;
    }
    const toMatch = [
        /android/i,
        /webos/i,
        /iphone/i,
        /ipad/i,
        /ipod/i,
        /blackberry/i,
        /windows phone/i
    ];
    console.log(navigator.platform);
    return toMatch.some((toMatchItem: any) => {
        return navigator.userAgent.toLowerCase().match(toMatchItem);
    });
};

export const detectAndroidDevice = (): any => {
    const toMatch = [/android/i];
    console.log(navigator.platform);
    return toMatch.some((toMatchItem: any) => {
        return navigator.userAgent.toLowerCase().match(toMatchItem);
    });
};

export const removeUnreferencedLights = (scene: Scene): Promise<void> => {
    const promises = [];
    for (const light of scene.lights) {
        if (!light['entityReference']) {
            promises.push(removeLight(light, scene));
        }
    }
    return Promise.all(promises).then();
};

export const removeLight = (light: Light, scene: Scene): Promise<void> => {
    return new Promise<void>((resolve: CallableFunction) => {
        light.onDisposeObservable.addOnce(() => resolve());
        light.dispose();
    });
};

export const stringifyTextureJSON = (textureJson: TextureJSON): string => {
    return Object.keys(textureJson).reduce(
        (fullKey: string, property: string) => {
            fullKey += `${property}_${textureJson[property]}_`;
            return fullKey;
        },
        ''
    );
};

export interface AssetContainerResult {
    uncompressedAssetContainer: Promise<AssetContainer>;
}

/**
 * Removes a mesh from the scene
 * @param mesh - Mesh
 */
export const disposeMesh = async (
    mesh: AbstractMesh,
    scene: Scene,
    entity: MVEntity
): Promise<AbstractMesh> => {
    return new Promise<AbstractMesh>((resolve: CallableFunction) => {
        removeMesh(mesh, scene, entity);
        mesh.onDisposeObservable.addOnce(() => resolve(mesh));
        mesh.dispose(true, false);
    });
};

export const disposeMaterial = async (
    material: Material,
    scene: Scene,
    disposeTextures: boolean,
    lazyLoadingEnabled: boolean
) => {
    return new Promise<Material>((resolve) => {
        // scene.removeMaterial(material);
        var index = scene.materials.findIndex((e) => {
            return e.uniqueId == material.uniqueId;
        });
        if (index !== -1 && index < scene.materials.length) {
            if (index !== scene.materials.length - 1) {
                const lastMaterial =
                    scene.materials[scene.materials.length - 1];
                scene.materials[index] = lastMaterial;
                lastMaterial._indexInSceneMaterialArray = index;
            }

            material._indexInSceneMaterialArray = -1;
            scene.materials.pop();
        }

        if (lazyLoadingEnabled) {
            return resolve(null);
        }

        material.onDisposeObservable.addOnce(() => {
            // console.log("disposed material " + material.name)
            return resolve(null);
        });
        material.dispose(true, disposeTextures, false);
    });
};

export const disposeTexture = async (texture: BaseTexture, scene: Scene) => {
    return new Promise<BaseTexture>((resolve) => {
        // console.log("Disposing texture " + texture.name);
        // const textureExists = scene.textures.find((t) => t.uniqueId == texture.uniqueId);
        // if (!textureExists) {
        //   texture = scene.textures.find((t) => t.name == texture.name);
        //   if (!texture) return;
        // }
        // console.log("tex count: " + scene.textures.length);
        texture.onDisposeObservable.addOnce(() => {
            // console.log("tex count: " + scene.textures.length);
            resolve(null);
        });
        // var index = scene.textures.findIndex((t) => {
        //   return t.uniqueId == texture.uniqueId;
        // })
        // if (index !== -1) {
        //   scene.textures.splice(index, 1)
        // }
        texture.dispose();
    });
};

/**
 * Removes meshes from the scene
 * @param meshes - Meshes
 */
export const disposeMeshes = async (
    meshes: AbstractMesh[],
    scene: Scene,
    entity: MVEntity
) => {
    // force sequential order of layer disposal is required to prevent side effects
    await meshes.reduce((previousPromise, nextMesh) => {
        return previousPromise.then(() => {
            return disposeMesh(nextMesh, scene, entity);
        });
    }, Promise.resolve());
};

export const removeMeshes = (
    meshes: AbstractMesh[],
    scene: Scene,
    entity: MVEntity
) => {
    meshes.forEach((mesh) => {
        removeMesh(mesh, scene, entity);
    });
};

export const removeMesh = (
    mesh: AbstractMesh,
    scene: Scene,
    entity: MVEntity
) => {
    const materialMappingId = mesh['originalMaterialName'];
    if (materialMappingId) {
        const materialMapping: MVMaterialMapping =
            entity.getMaterialMapping(materialMappingId);
        if (materialMapping) {
            materialMapping.removeMesh(mesh);
        }
    }
    // var index = scene.meshes.findIndex((m) => {
    //   return m.uniqueId == mesh.uniqueId;
    // })
    // if (index !== -1) {
    //   scene.meshes.splice(index, 1)
    // }
    scene.removeMesh(mesh, false);
};

export const disposeLayer = async (
    layer: MVLayer,
    scene: Scene,
    entity: MVEntity,
    lazyLoadingEnabled: boolean
) => {
    if (!lazyLoadingEnabled) {
        layer.disposeAssetContainers();
    }

    const materialsOfDisposedMeshes: {
        [key: string]: Material;
    } = {};

    layer.meshes.forEach((mesh) => {
        const material = mesh.material;
        if (material) {
            materialsOfDisposedMeshes[material.uniqueId] = material;
        }
    });

    if (lazyLoadingEnabled) {
        removeMeshes(layer.meshes, scene, entity);
    } else {
        await disposeMeshes(layer.meshes, scene, entity);
    }

    layer.visibilityState = false;
    layer.previousVisibilityState = false;

    const texturesOfDisposedMaterials: {
        [key: string]: BaseTexture;
    } = {};

    const disposeMaterialPromises = [];

    for (const materialId of Object.keys(materialsOfDisposedMeshes)) {
        const material: Material = materialsOfDisposedMeshes[materialId];
        const materialStillInUse = scene.meshes.find((m) => {
            return (
                material &&
                m.material &&
                material.uniqueId == m.material.uniqueId
            );
        });

        if (material && !materialStillInUse) {
            if (material instanceof PBRMaterial) {
                TEXTURE_PROPERTIES.forEach((textureProperty: string) => {
                    const texture: BaseTexture = material[textureProperty];
                    if (texture) {
                        texturesOfDisposedMaterials[texture.uniqueId] = texture;
                    }
                });
                const detailMapTexture = material['detailMap']?.texture;
                if (detailMapTexture) {
                    texturesOfDisposedMaterials[detailMapTexture.uniqueId] =
                        detailMapTexture;
                }
            }
            if (material['isMVMaterial']) {
                // disposeMaterialPromises.push(disposeMaterial(material, scene, false));
            } else {
                // disposeMaterialPromises.push(disposeMaterial(material, scene, true));
            }
        }
    }

    await Promise.all(disposeMaterialPromises);

    for (const textureId of Object.keys(texturesOfDisposedMaterials)) {
        const texture: BaseTexture = texturesOfDisposedMaterials[textureId];
        // const textureIsUsed = checkIfTextureIsUsed(texture, scene);
        // if (!textureIsUsed) await disposeTexture(texture, scene);
    }
};

const checkIfTextureIsUsed = (texture: BaseTexture, scene) => {
    for (let material of scene.materials) {
        if (material instanceof PBRMaterial) {
            TEXTURE_PROPERTIES.forEach((textureProperty: string) => {
                const t: BaseTexture = material[textureProperty];
                if (texture && t && t.uniqueId == texture.uniqueId) {
                    return true;
                }
                return false;
            });
            const detailMapTexture = material['detailMap']?.texture;
            if (
                detailMapTexture &&
                detailMapTexture.uniqueId == texture.uniqueId
            ) {
                return true;
            }
        }
        return false;
    }
    return false;
};

export const disposeUnusedMaterialsAndTextures = async (
    scene: Scene,
    colorGradingTexture: BaseTexture,
    backdropTexture: Texture,
    environmentTextures: BaseTexture[],
    lazyLoadingEnabled: boolean
) => {
    const registry = generateUsedMaterialAndTextureRegistry(
        scene,
        colorGradingTexture,
        backdropTexture,
        environmentTextures
    );

    const textureIdsToDispose: string[] = [];
    const textureMap = {};

    for (const texture of scene.textures) {
        if (texture.uniqueId == null || texture.uniqueId == undefined) continue;
        textureMap[texture.uniqueId.toString()] = texture;
        const textureIsUsed = registry.usedTextures[texture.uniqueId]
            ? true
            : false;
        const isGlowLayerTexture =
            texture.name.startsWith('GlowLayerBlur') ||
            texture.name.startsWith('HighlightLayer');
        const isLensFlareTexture = texture['isLensFlareTexture'];
        if (!textureIsUsed && !isGlowLayerTexture && !isLensFlareTexture) {
            textureIdsToDispose.push(texture.uniqueId.toString());
        }
    }

    textureIdsToDispose.forEach((textureId) => {
        const texture: Texture = textureMap[textureId];
        var index = scene.textures.findIndex((t) => {
            return t.uniqueId == texture.uniqueId;
        });
        if (index !== -1) {
            scene.textures.splice(index, 1);
        }
        if (!lazyLoadingEnabled) {
            const textureKey = getTextureKeyFromTexture(texture);
            if (scene['mv_cached_textures'][textureKey]) {
                delete scene['mv_cached_textures'][textureKey];
            }
            texture.dispose();
        }
    });

    const disposedMaterialIds = [];
    const materialsMap = {};
    for (let material of scene.materials) {
        materialsMap[material.id] = material;
        const materialIsUsed = registry.usedMaterials[material.uniqueId]
            ? true
            : false;
        if (
            (material['isMVMaterial'] || material['isMVNodeMaterial']) &&
            !materialIsUsed
        ) {
            disposedMaterialIds.push(material.id);
        }
    }

    const disposeMaterialPromises = [];

    disposedMaterialIds.forEach((id) => {
        const material: Material = materialsMap[id];
        var index = scene.materials.findIndex((e) => {
            return e.uniqueId == material.uniqueId;
        });
        if (index !== -1 && index < scene.materials.length) {
            if (index !== scene.materials.length - 1) {
                const lastMaterial =
                    scene.materials[scene.materials.length - 1];
                scene.materials[index] = lastMaterial;
                lastMaterial._indexInSceneMaterialArray = index;
            }

            material._indexInSceneMaterialArray = -1;
            scene.materials.pop();
        }

        disposeMaterialPromises.push(
            disposeMaterial(material, scene, false, lazyLoadingEnabled)
        );
    });

    await Promise.all(disposeMaterialPromises);
};

export const generateUsedMaterialAndTextureRegistry = (
    scene: Scene,
    colorGradingTexture: BaseTexture,
    backdropTexture: Texture,
    environmentTextures: BaseTexture[]
): UsedMaterialAndTextureRegistry => {
    const registry: UsedMaterialAndTextureRegistry = {
        usedMaterials: {},
        usedTextures: {}
    };
    for (const mesh of scene.meshes) {
        if (mesh.material) {
            registry.usedMaterials[mesh.material.uniqueId] = mesh.material;
        }
    }
    for (const material of Object.values(registry.usedMaterials)) {
        for (const textureProperty of TEXTURE_PROPERTIES) {
            const texture: BaseTexture = material[textureProperty];
            if (texture) {
                registry.usedTextures[texture.uniqueId] = texture;
            }
        }
        if (material instanceof PBRMaterial) {
            const detailMapTexture = material['detailMap']?.texture;
            if (detailMapTexture) {
                registry.usedTextures[detailMapTexture.uniqueId] =
                    detailMapTexture;
            }
        }
        if (!material['isMVVCAONodeMaterial'] && material['isMVNodeMaterial']) {
            (material as NodeMaterial).getTextureBlocks().forEach((block) => {
                if (block.texture) {
                    registry.usedTextures[block.texture.uniqueId] =
                        block.texture;
                }
            });
        }
    }

    environmentTextures.forEach((environmentTexture) => {
        if (environmentTexture.uniqueId) {
            registry.usedTextures[environmentTexture.uniqueId] =
                environmentTexture;
        }
    });

    const environmentBRDFTexture = scene.environmentBRDFTexture;
    if (environmentBRDFTexture && environmentBRDFTexture.uniqueId) {
        registry.usedTextures[environmentBRDFTexture.uniqueId] =
            environmentBRDFTexture;
    }

    if (colorGradingTexture && colorGradingTexture.uniqueId) {
        registry.usedTextures[colorGradingTexture.uniqueId] =
            colorGradingTexture;
    }

    if (backdropTexture && colorGradingTexture.uniqueId) {
        registry.usedTextures[backdropTexture.uniqueId] = backdropTexture;
    }

    return registry;
};

export interface UsedMaterialAndTextureRegistry {
    usedMaterials: {
        [key: string]: Material;
    };
    usedTextures: {
        [key: string]: BaseTexture;
    };
}

export const freezeMaterials = async (scene: Scene) => {
    if (document.hidden) {
        MVLogger.info('Document hidden. Preventing material freezing');
        return;
    }
    MVLogger.debug('Freezing materials');
    scene.materials.forEach((material) => {
        if (
            (material['isMVMaterial'] || material['isMVNodeMaterial']) &&
            !material.isFrozen
        ) {
            material.freeze();
        }
    });
};

export const waitForSceneReady = async (scene: Scene) => {
    const waitForSceneReayStartTimeInMs = Date.now();

    const sceneReadyPromise = new Promise((resolve) => {
        scene.onReadyObservable.addOnce(() => {
            resolve(true);
        });
    });

    await sceneReadyPromise;

    const waitForSceneReadyTimeInS =
        (Date.now() - waitForSceneReayStartTimeInMs) / 1000;
    MVLogger.debug(
        `Wait for scene ready time in seconds: ${waitForSceneReadyTimeInS}`
    );
};

export const rebuildMaterials = (scene: Scene) => {
    scene.materials.forEach((material) => {
        if (material['isMVNodeMaterial']) {
            (material as NodeMaterial).build();
        }
    });
};

export const unfreezeMaterials = (scene: Scene) => {
    scene.materials.forEach((material) => {
        if (
            (material['isMVMaterial'] || material['isMVNodeMaterial']) &&
            material.isFrozen
        ) {
            material.unfreeze();
        }
    });
};

export const timeout = async (timeInMilliSeconds: number) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            return resolve(null);
        }, timeInMilliSeconds);
    });
};

export const isTransparentMaterial = (
    transparencyMode: number,
    alpha?: number,
    opacityTexture?: BaseTexture
): boolean => {
    if (alpha && alpha < 1) {
        return true;
    }
    return (
        (opacityTexture !== undefined && opacityTexture !== null) ||
        transparencyMode === 1 ||
        transparencyMode === 2 ||
        transparencyMode === 3
    );
};

export const isEmissiveMaterial = (materialJson: MVMaterialJSON): boolean => {
    const emissiveColor = materialJson.emissive;
    return (emissiveColor &&
        emissiveColor[0] !== 0 &&
        emissiveColor[1] !== 0 &&
        emissiveColor[2] !== 0) ||
        materialJson.emissiveTexture
        ? true
        : false;
};
