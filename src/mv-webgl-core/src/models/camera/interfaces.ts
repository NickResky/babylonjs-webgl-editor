import { MVAnimationState } from "../animation/interfaces";

export interface MVCameraShotSettings {
  /** Category of the camera, needed to set different lights and scene settings */
  category: string;
  /** Vector 3 position of camera target */
  target: number[];
  /** Vector 3 position of camera */
  position: number[];
  /** Field of view */
  fov: number;
  /** Array of camera shot behaviors. Empty if no behaviors on camera */
  behaviors: MVCameraShotBehaviorSettings[];
  /** Url of the camera animation file (glb file) */
  animationFile?: string;
  /** animation fps */
  animationFps?: number;
  /** fov Keyframes and values of the camera  */
  fovKeyFrames?: {
    [key: string]: number;
  };
  /** Light Category Keyframes and values of the camera  */
  lightCategoryKeyFrames?: {
    [key: string]: string;
  };
  /** Defines if action items should be hidden when camera shot is active */
  hideActionItems?: boolean;
}

export interface MVCameraShotBehaviorSettings {
  /** Type of camera shot behavior */
  type: MVCameraShotBehaviourType;
  /** Parameter for camera shot behavior */
  options: MVCameraShotBehaviorOption;
}

export enum MVCameraShotBehaviourType {
  /** Orbit-Type for camera */
  'ORBIT' = 'ORBIT',
  /** Zoom-Type for camera */
  'ZOOM' = 'ZOOM',
  /** FOV-Zoom-Type for camera */
  'FOV_ZOOM' = 'FOV_ZOOM',
}

export interface MVCameraShotBehaviorOption {
  /** Lower limit of the horizontal orbit value */
  lowerAlphaLimit?: number;
  /** Lower limit of the horizontal orbit value */
  upperAlphaLimit?: number;
  /** Lower limit of the vertical orbit value */
  lowerBetaLimit?: number;
  /** Upper limit of the vertical orbit value */
  upperBetaLimit?: number;
  /** Limit the zoom factor in the zoom-out */
  upperRadiusLimit?: number;
  /** Limit the zoom factor in the zoom-in */
  lowerRadiusLimit?: number;
  /** Use idle rotate functionality */
  allowAutoRotation?: boolean;
  /** Speed of the idle rotation */
  autoRotationSpeed?: number;
  /** Speed and step width of mouse wheel for the zoom  */
  wheelPrecision?: number;
  /** The lower this number the longer it will take for the camera to stop after a rotation */
  inertia?: number;
  /** Alpha/ rotation value to radius mapping to implement parallax effect */
  alphaToRadiusMappings?: {
    [key: string]: number;
  };
  /** Limit the fov zoom (degrees) */
  fovMin?: number;
  /** Limit the fov zoom (degrees) */
  fovMax?: number;
}

export interface MVCameraShotsMetaData {
  [key: string]: MVCameraShotMetaData
}

export interface MVCameraShotMetaData {
  id?: string;
  urlRelative?: string;
  mobileUrlRelative?: string,
  animationStates?: MVAnimationState[];
  cameraTransition?: MVCameraTransition;
  cameraShotSettings?: MVCameraShotSettings;
  cameraShotSettingsMobile?: MVCameraShotSettings;
  activeInEditor?: boolean;
  mobileActiveInEditor?: boolean;
}

export interface MVCameraShotTransition {
  cameraShotIds: string[];
  cameraTransition: MVCameraTransition;
}

export interface MVCameraTransition {
  fadeToBlack?: boolean;
  fadeToBlackOnLeave?: boolean;
  transformAnimation?: boolean;
  zoomIn?: boolean;
}

export interface MVCameraCategoryTransitions {
  [key: string]: {
    [key: string]: MVCameraTransition;
  };
}

export interface MVStartRenderOptions {
  fadeOutPreviousFrame?: boolean,
  fadeOutDurationInMilliSeconds?: number
}
