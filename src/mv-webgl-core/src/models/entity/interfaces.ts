import { MVMaterialMappingsJson, MVRuleEngineJson, MVRuleEngineTypes } from '../configuration/interfaces';
import { BaseTexture, Light } from 'babylonjs';
import { MVCameraShotMetaData, MVCameraCategoryTransitions, MVCameraShot, MVCameraShotsMetaData } from '../camera';
import { TextureJSON } from '../material';

export interface MVEntityConfig {
  /** Name of the Entity */
  name: string;
  /** ID of the Entity */
  id: string;
  /** CWS ID of the Entity */
  cwsId?: string;
  /** CWS Version of the Entity */
  cwsResourceVersionId?: string;
  /** Type of the Config File */
  ruleEngineType: MVRuleEngineTypes;
  /** relative url to meshes folder */
  meshesUrlRelative: string;
  /** relative url to production meshes folder */
  productionMeshesUrlRelative: string;
  /** relative url to materials folder */
  materialsUrlRelative: string;
  /** relative url to textures folder */
  texturesUrlRelative: string;
  /** relative url to mobile textures folder */
  mobileTexturesUrlRelative?: string;
  /** relative url of rule engine config file */
  ruleEngineConfigUrlRelative?: string;
  /** relative url of material mappings file */
  materialMappingsUrlRelative?: string;
  /** relative url of action item file */
  actionItemUrlRelative?: string;
  /** base url to entity config file */
  entityConfigBaseUrl?: string;
  /** relative url of rig file */
  rigUrlRelative?: string;
  /** relative urls of environment entity files */
  environmentEntityUrlsRelative: string[];
  /** relative urls of lightmap Texture files*/
  lightmapTexturesUrlRelative?: string;
  /** relative urls of mobile lightmap Texture files*/
  mobileLightmapTexturesUrlRelative?: string;
  /** relative urls of animation files */
  animations: MVAnimationMetaData[];
  /** relative urls of camera shot files */
  cameraShotUrlsRelative: string[];
  /** Camera animation settings from camera catergory to camera category*/
  cameraShots?: MVCameraShotsMetaData;
  cameraCategoryTransitionsFromTo: MVCameraCategoryTransitions;
  /** relative url of mesh settings file */
  meshSettingsRelative?: string;
  /** relative url of production mesh settings file */
  productionMeshSettingsRelative?: string;
  /** relative url of environment config file */
  environmentConfigRelative?: string;
  /** relative url of glb mapping file  */
  glbMaterialMappingUrlRelative?: string;
  /** Array of Lights of the Entity */
  lights?: EntityLights;
  /** Arry of non configurable layers (file paths) */
  nonConfigurableLayers?: string[];
  /** Names of initial materials */
  initialMaterials?: string[];
  /** List of lightmap override settings. Necessary to use the same lightmap for multiple layers. */
  lightmapOverwrites?: any;
  /** Relative Url of the environment brdf texture that should be applied to all materials of this entity*/
  environmentBRDFTextureUrl?: string;
  /** Post processing configuration */
  postProcessingConfiguration?: PostProcessingConfiguration;
  /** */
  rigOffset?: {
    x: number,
    y: number,
    z: number
  }
  /** Absolute path to the fbx files directory which are used to create the production export */
  fbxFilesDirectoryAbsolute?: string;
  /** DEPRECATED!!! 
   * Use useVCAOForPBRMaterials instead!
   * Specifies if the PBR materials used by this entity should be converted to Node Materials at runtime. 
   * Used for VCAO (Vertex Color Ambient Occlusion) support. */
  convertPBRToNodeMaterials?: boolean;
  /** Specifies if the PBR materials used by this entity should use vertex color ambient occlusion. */
  useVCAOForPBRMaterials?: boolean;
  /** Intensity of vertex color ambient occlusion
   * 0 = disabled VCAO
   * 1 = fully enabled VCAO
   * 0.5 = half intensity of VCAO
   */
  VCAOIntensity?: number;
  /**
   * Specifies a multiply factor by which the vertex color rgb values are multiplied with to brighten/darken them
   */
  VCAOMultiplyFactor?: number;
  /**
   * DEPRECATED!!!
   * Necessary for convertPBRToNodeMaterials support
   */
  defaultNodeMaterialUrlRelative?: string;
  /** Only relevant for production export */
  cameraShotsArr?: MVCameraShot[]
  /* If enabled draco compression is disabled for GLB files during production build
   * This might be necessary for the UVs of huge meshes which can break with draco compression
   */
  preventDracoCompressionDuringBuild?: boolean;
  /** If enabled vertex color delection during production build is disabled even if the entity is not using VCAO
   * Might be necessary for environments. 
   */
  preventVertexColorDeletionDuringBuild?: boolean;
  /** Only relevant for production export */
  meshSettings?: MVMeshSettings;
  /** Only relevant for production export */
  productionMeshSettings?: ProductionMeshSettings;
  /** Only relevant for production export */
  ruleEngineConfig?: MVRuleEngineJson;
  /** Only relevant for production export */
  materials?: {
    [key: string]: any
  }
  /** Only relevant for production export */
  materialMappings?: MVMaterialMappingsJson
  /** Only relevant for production export */
  lightmapTextures: string[];
  // TODO remove mobile lightmap textures
  /** Only relevant for production export */
  mobileLightmapTextures: string[];
  /** Only relevant for production export */
  environmentConfig: MVEnvironmentConfigs;
}

export interface EntityLights {
  /** Set of Environment Configs with corresponding lights */
  [key: string]: Light[];
}

export interface PostProcessingConfiguration {
  imagePostProcessingEnabled: boolean;
  /** Defines if the lookup tale is enabled */
  glowLayerEnabled: boolean;
  /** Relative Url of the color loolup table that should be applied to all materials of the scene*/
  colorGradingTextureUrl: string;
  /** Defines if the lookup tale is enabled */
  colorGradingTextureEnabled: boolean;
  /** Defines the tone mapping type */
  toneMappingType: number;
  /** Defines if tone mapping is enabled */
  toneMappingEnabled: boolean;
  /** Lightmap texture level */
  lightmapTextureLevel: number;
}

export interface MVEnvironmentConfigs {
  /** Set of Environment Configs that define scene settings like Scene-background-color */
  [key: string]: MVEnvironmentConfig;
}

export interface MVEnvironmentConfig {
  /** Background color of the scene. RGB in HEX, A 0.0 (fully transparent) and 1.0 (fully opaque) MVEnvironmentConfig */
  clearColor: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  /** Defines how strong emissive materials are glowing */
  glowLayerIntensity?: number;
  /** defines the background-image path */
  backgroundImageUrl?: string;
  /** defines the HDRI Texture of the environment which is used for lighting/reflections */
  environmentTexture?: BaseTexture;
  /** defines the brightness of the environment texture */
  environmentIntensity: number;
  /** defines if fog is enabled */
  fogEnabled: boolean;
  /** defines a fog mode (0=FOGMODE_NONE, 1=FOGMODE_EXP, 2=FOGMODE_EXP2, 3=FOGMODE_LINEAR) */
  fogMode: number;
  /** defines the fog color in HEX */
  fogColor: {
    r: number;
    g: number;
    b: number;
  };
  /** defines the fog density 0=deactivated */
  fogDensity: number;
  /** defines fog end distance */
  fogEnd: number;
  /** defines fog start distance */
  fogStart: number;
  /** Lense flare settings */
  lensFlareSystem?: LensFlareSystemSettings
}

export interface LensFlareSystemSettings {
  enabled: boolean;
  intensity: number,
  lightEmitterPosition: {
    x: number,
    y: number,
    z: number
  },
  borderLimit: number,
  lensFlares: LensFlareSettings[]
}

export interface LensFlareSettings {
  intensity?: number;
  textureUrl: string,
  size: number,
  position: number,
  color: {
    r: number;
    g: number;
    b: number;
    a: number;
  }
}

export interface MVMeshSetting {
  /** ID of the Mesh */
  id?: string;
  /** Alpha Index of the Mesh. Defines the render order of the Mesh. 0 = lowest priority. Required for transparent meshes.  */
  alphaIndex?: number;
  /** Defines if the mesh should be hidden when the main camera intersects its bounding box */
  hideOnCameraIntersect?: boolean;
  /** Scale factor of the bounding box */
  boundingBoxScale?: number;
  /** */
  originalFileName?: string;
  /** */
  mirror?: boolean;
  /** */
  mirrorSocketName?: string;
  /** */
  socketName?: string;
}

export interface MVMeshSettingsJson {
  /** List of Mesh Settings */
  meshes: MVMeshSetting[];
}

export interface MVProductionMeshSettingsJson {
  [key: string]: MVMeshSetting
}

export interface MVRegistryJson {
  /** List of files in a directory */
  files: string[];
}

export interface MVAnimationMetaData {
  id?: string;
  fileUrl: string;
  speedRatio: number;
}

export interface GlbMetaData {
  [key: string]: {
    materials: {
      [key: string]: string
    },
    lightmaps: {
      [key: string]: string
    }
  }
}

export interface EntityLoadingStatus {
  loadingProgressPercentage: number,
  totalAssetsToLoad: number,
  loadedAssetsCount: number
}

export interface TextureAndMaterialUrls {
  textureJsons: TextureJSON[],
  lightmapsUrls: string[],
  materialsUrls: string[]
}

export interface ProductionMeshSettings {
  [key: string]: MVMeshSetting;
}

export interface MVMeshSettings {
  meshes: MVMeshSetting[];
}