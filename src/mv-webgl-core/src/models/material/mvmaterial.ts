import {
    BaseTexture,
    InspectableType,
    Scene,
    SerializationHelper
} from 'babylonjs';
import { PBRCustomMaterial } from 'babylonjs-materials';
import {
    disposeTexture,
    jsonToTexture,
    TEXTURE_PROPERTIES
} from '../../helper';
import { MVMaterialJSON, TextureJSON } from './interfaces';

/**
 * MVMaterial for a customized material which extending the PBRMaterial from babylonjs
 */
export class MVMaterial extends PBRCustomMaterial {
    /** Always set to true. Only necessary for editor. */
    public isMVMaterial: boolean;
    public useVCAO: boolean;
    private mv_materialConfig: MVMaterialJSON;
    private mv_texturesBaseUrl: string;

    /**
     * Create a new MVMaterial
     * @param name -
     * @param id -
     * @param scene -
     * @param materialConfig -
     * @param texturesBaseUrl -
     */
    constructor(
        name: string,
        id: string,
        scene: Scene,
        materialConfig?: any,
        texturesBaseUrl?: string,
        useVCAO?: boolean,
        _vcaoIntensity?: number
    ) {
        const vcaoIntensity = _vcaoIntensity !== undefined ? _vcaoIntensity : 1;

        super(name, scene);
        this.isMVMaterial = true;
        this.mv_materialConfig = materialConfig;
        this.mv_texturesBaseUrl = texturesBaseUrl;
        MVMaterial.setInspectableCustomProperties(this);

        if (useVCAO) {
            this.useVCAO = true;
            // VCAO Implementation. Reduce lighting intensity with VCAOs.
            // this.Fragment_Custom_MetallicRoughness(
            //     `
            //     #ifdef VERTEXCOLOR
                
            //     float vc = pow(vColor.r, 1.0 / 2.2) * 2.0;
            //     float ao = (0.5 * (1.0 - vc));
            //     metallicRoughness.g *= ao;
                

            //     #endif

            // `
            // );

        //     this.Fragment_Custom_Albedo(
        //          `
        //         #ifdef VERTEXCOLOR
                
        //         float vc = pow(vColor.r, 1.0 / 2.2) * 2.0;
        //         float ao = 1.0 - (1.0 * (1.0 - vc));
        //         surfaceAlbedo *= ao;
                

        //         #endif

        //  `
        //     )

            this.Fragment_Before_Lights

            // this.Fragment_Before_Lights(`
            //     baseColor = vec4(.0, .0, .83, 1.);
            // `);
            this.Fragment_Before_FragColor(
                `
                #ifdef VERTEXCOLOR
                
                float vc = pow(vColor.r, 1.0 / 1.0) * 3.0;
                float ao = 1.0 - (0.5 * (1.0 - vc));
                finalColor.rgb *= ao;
                //finalColor.rgb = vec3(ao, ao, ao);

                #endif

         `
            );
            /**
             *  #ifdef VERTEXCOLOR
                finalColor -= (vec4(1, 1, 1, 1) - vec4(vColor.r, vColor.g, vColor.b, 1) * vec4(1.8,1.8,1.8,1));
                #endif
                float curved = pow(vc, 2.2);

                finalColor = vec4(vColor.r * 2.0, vColor.r * 2.0, vColor.r * 2.0, 1.0);

     #ifdef VERTEXCOLOR
        float ao = 1.0 - (${vcaoIntensity.toString()} * (1.0 - vColor.r));
        finalColor.rgb *= ao;       
        #endif

             */
        }
    }

    /**
     * Get Class Name
     *
     */
    public static getClassName(): string {
        return 'MVMaterial';
    }

    /**
     * parse material from config
     * @param url -
     * @param materialConfig -
     * @param scene -
     * @param texturesBaseUrl -
     *
     */
    public async parseMaterialFromConfig(
        url: string,
        materialConfig: MVMaterialJSON,
        scene: Scene,
        texturesBaseUrl: string = '',
        environmentBrdfTextureUrl?: string
    ): Promise<void> {
        this.mv_materialConfig = materialConfig;
        const materialConfigWithoutTextures = { ...materialConfig };
        // remove all textures
        delete materialConfigWithoutTextures.albedoTexture;
        delete materialConfigWithoutTextures.metallicTexture;
        delete materialConfigWithoutTextures.opacityTexture;
        delete materialConfigWithoutTextures.ambientTexture;
        delete materialConfigWithoutTextures.bumpTexture;
        delete materialConfigWithoutTextures.lightmapTexture;
        delete materialConfigWithoutTextures._imageProcessingConfiguration;
        delete materialConfigWithoutTextures.environmentBRDFTexture;
        delete materialConfigWithoutTextures.detailMap;
        delete materialConfigWithoutTextures.invertNormalMapY;
        delete materialConfigWithoutTextures.invertNormalMapX;

        const material = SerializationHelper.Parse<MVMaterial>(
            () => {
                this.environmentBRDFTexture = scene.environmentBRDFTexture;
                return this;
            },
            materialConfigWithoutTextures,
            scene,
            texturesBaseUrl
        );
        this.isMVMaterial = true;
        this.name = url;
        this.id = url;

        // TODO test performance (helps to fix z fighting)
        // this.useLogarithmicDepth = true;

        if (materialConfig.clearCoat) {
            this.clearCoat.parse(
                materialConfig.clearCoat,
                scene,
                texturesBaseUrl
            );
        }

        if (materialConfig.anisotropy) {
            this.anisotropy.parse(
                materialConfig.anisotropy,
                scene,
                texturesBaseUrl
            );
        }

        if (materialConfig.sheen) {
            this.sheen.parse(materialConfig.sheen, scene, texturesBaseUrl);
        }

        if (materialConfig.subSurface) {
            this.subSurface.parse(
                materialConfig.subSurface,
                scene,
                texturesBaseUrl
            );
        }

        const textures: {
            [key: string]: Promise<BaseTexture>;
        } = {};

        for (const textureProperty of TEXTURE_PROPERTIES) {
            const textureJson: TextureJSON = materialConfig[textureProperty];
            if (textureJson) {
                this[textureProperty] = await jsonToTexture(
                    textureJson,
                    scene,
                    texturesBaseUrl
                );
            }
        }

        if (materialConfig.opacityTexture) {
            // this.transparencyMode = 2;
        }

        let webGLVersion = 1;
        const engine = scene.getEngine(); // Get your Babylon engine instance
        const gl = (engine as any)._gl; // Access the private raw WebGL context

        if (gl instanceof WebGL2RenderingContext) {
            webGLVersion = 2;
        }

        if (materialConfig.detailMap?.texture && webGLVersion > 1) {
            this['detailMap'].texture = await jsonToTexture(
                materialConfig.detailMap.texture,
                scene,
                texturesBaseUrl
            );
            this['detailMap'].isEnabled = materialConfig.detailMap?.isEnabled;
            this['detailMap'].bumpLevel = materialConfig.detailMap?.bumpLevel;
            this['detailMap'].normalBlendMethod =
                materialConfig.detailMap?.normalBlendMethod;
            this['detailMap'].roughnessBlendLevel =
                materialConfig.detailMap?.roughnessBlendLevel;
            this['detailMap'].diffuseBlendLevel =
                materialConfig.detailMap?.diffuseBlendLevel;
        }

        // if ((this.emissiveColor.r !== 0 && this.emissiveColor.g !== 0 && this.emissiveColor.b !== 0) || this.emissiveTexture) {
        //   this['glowEnabled'] = true;
        // }

        // necessary to display materials that were serialized with babylon 4.1 inside of babylon 4.2
        // metallicF0Factor was increasd by 0.5 in babylon 4.2
        if (!materialConfig['metallicReflectanceColor']) {
            this.metallicF0Factor = materialConfig.metallicF0Factor + 1.0;
        }
        if (
            materialConfig.indexOfRefraction == undefined ||
            materialConfig.indexOfRefraction == null
        ) {
            this.indexOfRefraction = 1.3;
        } else {
            this.indexOfRefraction = materialConfig.indexOfRefraction;
        }

        /*const webgl2Detected = scene.getEngine().webGLVersion > 1;
    if (isTransparentMaterial(this.transparencyMode, this.alpha, this.opacityTexture) && webgl2Detected) {

      this.disableDepthWrite = true;
    }*/
    }

    /**
     * Sets inspectable custom properties on the material
     */
    public static setInspectableCustomProperties(material: MVMaterial): void {
        material.inspectableCustomProperties = [
            {
                label: 'Environment Intensity',
                propertyName: 'environmentIntensity',
                type: InspectableType.Slider,
                min: 0,
                max: 20,
                step: 0.05
            },
            {
                label: 'Direct Intensity',
                propertyName: 'directIntensity',
                type: InspectableType.Slider,
                min: 0,
                max: 20,
                step: 0.05
            },
            {
                label: 'Emissive Intensity',
                propertyName: 'emissiveIntensity',
                type: InspectableType.Slider,
                min: 0,
                max: 20,
                step: 0.05
            },
            {
                label: 'Max Simultaneous Lights',
                propertyName: 'maxSimultaneousLights',
                type: InspectableType.Slider,
                min: 0,
                max: 20,
                step: 1
            },
            {
                label: 'Use Alpha From Albedo Texture',
                propertyName: 'useAlphaFromAlbedoTexture',
                type: InspectableType.Checkbox
            },
            {
                label: 'Use Specular Over Alpha',
                propertyName: 'useSpecularOverAlpha',
                type: InspectableType.Checkbox
            },
            {
                label: 'Use Roughness From Metallic Texture Alpha',
                propertyName: 'useRoughnessFromMetallicTextureAlpha',
                type: InspectableType.Checkbox
            },
            {
                label: 'Use Roughness From Metallic Texture Green',
                propertyName: 'useRoughnessFromMetallicTextureGreen',
                type: InspectableType.Checkbox
            },
            {
                label: 'Use Metallness From Metallic Texture Blue',
                propertyName: 'useMetallnessFromMetallicTextureBlue',
                type: InspectableType.Checkbox
            },
            {
                label: 'Use Ambient Occlusion From Metallic Texture Red',
                propertyName: 'useAmbientOcclusionFromMetallicTextureRed',
                type: InspectableType.Checkbox
            },
            {
                label: 'Disable Lighting',
                propertyName: 'disableLighting',
                type: InspectableType.Checkbox
            },
            {
                label: 'Invert NormalMap X',
                propertyName: 'invertNormalMapX',
                type: InspectableType.Checkbox
            },
            {
                label: 'Invert NormalMap Y',
                propertyName: 'invertNormalMapY',
                type: InspectableType.Checkbox
            },
            {
                label: 'TwoSided Lighting',
                propertyName: 'twoSidedLighting',
                type: InspectableType.Checkbox
            },
            {
                label: 'Use Alpha Fresnel',
                propertyName: 'useAlphaFresnel',
                type: InspectableType.Checkbox
            },
            {
                label: 'Use Linear Alpha Fresnel',
                propertyName: 'useLinearAlphaFresnel',
                type: InspectableType.Checkbox
            },
            {
                label: 'Use Lightmap as Shadowmap',
                propertyName: 'useLightmapAsShadowmap',
                type: InspectableType.Checkbox
            }
        ];
    }

    public async _clone(name: string, scene: Scene): Promise<MVMaterial> {
        const material = super.clone(name) as MVMaterial;
        if (
            this.environmentBRDFTexture &&
            material.environmentBRDFTexture !== this.environmentBRDFTexture
        ) {
            material.environmentBRDFTexture.dispose();
            material.environmentBRDFTexture = this.environmentBRDFTexture;
        }

        for (const textureProperty of TEXTURE_PROPERTIES) {
            const texture = material[textureProperty];
            if (texture) {
                await disposeTexture(texture, scene);
                material[textureProperty] = this[textureProperty];
            }
        }

        const detailMapTexture = material['detailMap']?.texture;
        if (detailMapTexture) {
            await disposeTexture(detailMapTexture, scene);
            material['detailMap'].texture = this['detailMap'].texture;
        }
        material.id = name;
        material.name = name;
        material['isMVMaterial'] = true;
        MVMaterial.setInspectableCustomProperties(material);

        return material as MVMaterial;
    }

    public async mv_clone(
        name: string,
        scene: Scene,
        texturesBaseUrl: string
    ): Promise<MVMaterial> {
        const clonedMaterial = new MVMaterial(name, name, scene);
        await clonedMaterial.parseMaterialFromConfig(
            this.id,
            this.mv_materialConfig,
            scene,
            texturesBaseUrl
        );
        return clonedMaterial;
    }
}
