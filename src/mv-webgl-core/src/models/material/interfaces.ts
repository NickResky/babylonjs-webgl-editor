import { ImageProcessingConfiguration } from 'babylonjs';
import { DetailMapConfiguration } from 'babylonjs/Materials/material.detailMapConfiguration';

export interface MVMaterialJSON {
  //  tags: null,
  directIntensity: number;
  emissiveIntensity: number;
  environmentIntensity: number;
  specularIntensity: number;
  disableBumpMap: boolean;
  ambientTextureStrength: number;
  ambientTextureImpactOnAnalyticalLights: number;
  metallic: number;
  roughness: number;
  metallicF0Factor: number;
  metallicReflectanceColor: number[];
  useMetallicF0FactorFromMetallicTexture: boolean;
  lightmapTexture: TextureJSON;
  ambient: number[];
  albedo: number[];
  reflectivity: number[];
  reflection: number[];
  emissive: number[];
  microSurface: number;
  useLightmapAsShadowmap: boolean;
  useAlphaFromAlbedoTexture: boolean;
  forceAlphaTest: boolean;
  alphaCutOff: number;
  useSpecularOverAlpha: boolean;
  useMicroSurfaceFromReflectivityMapAlpha: boolean;
  useRoughnessFromMetallicTextureAlpha: boolean;
  useRoughnessFromMetallicTextureGreen: boolean;
  useMetallnessFromMetallicTextureBlue: boolean;
  useAmbientOcclusionFromMetallicTextureRed: boolean;
  useAmbientInGrayScale: boolean;
  useAutoMicroSurfaceFromReflectivityMap: boolean;
  usePhysicalLightFalloff: boolean;
  useGLTFLightFalloff: boolean;
  useRadianceOverAlpha: boolean;
  useObjectSpaceNormalMap: boolean;
  useParallax: boolean;
  useParallaxOcclusion: boolean;
  parallaxScaleBias: number;
  disableLighting: boolean;
  forceIrradianceInFragment: boolean;
  maxSimultaneousLights: number;
  invertNormalMapX: boolean;
  invertNormalMapY: boolean;
  twoSidedLighting: boolean;
  useAlphaFresnel: boolean;
  useLinearAlphaFresnel: boolean;
  environmentBRDFTexture: TextureJSON;
  forceNormalForward: boolean;
  enableSpecularAntiAliasing: boolean;
  useHorizonOcclusion: boolean;
  useRadianceOcclusion: boolean;
  unlit: boolean;
  _imageProcessingConfiguration: ImageProcessingConfigurationJSON;
  useLogarithmicDepth: boolean;
  id: string;
  uniqueId: number;
  name: string;
  checkReadyOnEveryCall: boolean;
  checkReadyOnlyOnce: boolean;
  state: string;
  alpha: number;
  backFaceCulling: boolean;
  sideOrientation: number;
  alphaMode: number;
  _needDepthPrePass: boolean;
  disableDepthWrite: boolean;
  forceDepthWrite: boolean;
  depthFunction: number;
  separateCullingPass: boolean;
  fogEnabled: boolean;
  pointSize: number;
  zOffset: number;
  wireframe: boolean;
  pointsCloud: boolean;
  fillMode: number;
  customType: string;
  clearCoat: ClearCoatJSON;
  anisotropy: AnisotropyJSON;
  brdf: BrdfJSON;
  sheen: SheenJSON;
  subSurface: SubSurfaceJSON;
  indexOfRefraction?: number;

  bumpTexture: TextureJSON;
  albedoTexture: TextureJSON;
  opacityTexture: TextureJSON;
  metallicTexture: TextureJSON;
  ambientTexture: TextureJSON;
  emissiveTexture: TextureJSON;
  detailMap: {
    texture: TextureJSON,
    bumpLevel: number,
    diffuseBlendLevel: number,
    isEnabled: boolean,
    normalBlendMethod: number,
    roughnessBlendLevel: number
  }
  microSurfaceTexture: TextureJSON;
  mv_vcao_albedoTextureMultiply?: number;
  mv_vcao_intensity?: number;
}

export interface TextureJSON {
  //tags: null,
  url: string;
  uOffset: number;
  vOffset: number;
  uScale: number;
  vScale: number;
  uRotationCenter: number;
  vRotationCenter: number;
  wRotationCenter: number;
  isBlocking: boolean;
  uniqueId: number;
  name: string;
  hasAlpha: boolean;
  getAlphaFromRGB: boolean;
  level: number;
  coordinatesIndex: number;
  coordinatesMode: number; //
  wrapU: number;
  wrapV: number;
  wrapR: number;
  anisotropicFilteringLevel: number;
  isCube: boolean;
  is3D: boolean;
  is2DArray: boolean;
  gammaSpace: boolean;
  invertZ: boolean;
  lodLevelInAlpha: boolean;
  lodGenerationOffset: number;
  lodGenerationScale: number;
  linearSpecularLOD: boolean;
  isRenderTarget: boolean;
  animations: Animation[];
  invertY: boolean;
  samplingMode: number;
  base64String?: string;
}

export interface ImageProcessingConfigurationJSON {
  // tags: null,
  colorCurves: {
    // tags: null,
    _globalHue: number;
    _globalDensity: number;
    _globalSaturation: number;
    _globalExposure: number;
    _highlightsHue: number;
    _highlightsDensity: number;
    _highlightsSaturation: number;
    _highlightsExposure: number;
    _midtonesHue: number;
    _midtonesDensity: number;
    _midtonesSaturation: number;
    _midtonesExposure: number;
  };
  _colorCurvesEnabled: boolean;
  colorCurvesEnabled: boolean;
  _colorGradingTexture: any;
  colorGradingTexture: any;
  _colorGradingEnabled: boolean;
  colorGradingEnabled: boolean;
  _colorGradingWithGreenDepth: boolean;
  colorGradingWithGreenDepth: boolean;
  _colorGradingBGR: boolean;
  colorGradingBGR: boolean;
  _exposure: number;
  exposure: number;
  _toneMappingEnabled: boolean;
  toneMappingEnabled: boolean;
  _toneMappingType: number;
  toneMappingType: number;
  _contrast: number;
  contrast: number;
  vignetteStretch: number;
  vignetteCentreX: number;
  vignetteCentreY: number;
  vignetteWeight: number;
  vignetteColor: number[];
  vignetteCameraFov: number;
  _vignetteBlendMode: number;
  vignetteBlendMode: number;
  _vignetteEnabled: boolean;
  vignetteEnabled: boolean;
  _applyByPostProcess: boolean;
  applyByPostProcess: boolean;
  _isEnabled: boolean;
  isEnabled: boolean;
  onUpdateParameters: any;
  _updateParameters: any;
  getClassName: any;
  prepareDefines: any;
  isReady: any;
  bind: any;
  clone: any;
  serialize: any;
}

export interface ClearCoatJSON {
  // tags: null,
  isEnabled: boolean;
  intensity: number;
  roughness: number;
  indexOfRefraction: number;
  isTintEnabled: boolean;
  tintColor: number[];
  tintColorAtDistance: number;
  tintThickness: number;
}

export interface AnisotropyJSON {
  // tags: null,
  isEnabled: boolean;
  intensity: number;
  direction: number[];
}

export interface BrdfJSON {
  // tags: null,
  useEnergyConservation: boolean;
  useSmithVisibilityHeightCorrelated: boolean;
  useSphericalHarmonics: boolean;
  useSpecularGlossinessInputEnergyConservation: boolean;
}

export interface SheenJSON {
  // tags: null
  isEnabled: boolean;
  linkSheenWithAlbedo: boolean;
  intensity: number;
  color: number[];
}

export interface SubSurfaceJSON {
  // tags: null,
  isRefractionEnabled: boolean;
  isTranslucencyEnabled: boolean;
  refractionIntensity: number;
  translucencyIntensity: number;
  scatteringIntensity: number;
  indexOfRefraction: number;
  invertRefractionY: boolean;
  linkRefractionWithTransparency: boolean;
  minimumThickness: number;
  maximumThickness: number;
  tintColor: number[];
  tintColorAtDistance: number;
  diffusionDistance: number[];
  useMaskFromThicknessTexture: boolean;
}
