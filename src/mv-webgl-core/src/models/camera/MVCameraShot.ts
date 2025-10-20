import { ArcRotateCameraMouseWheelInput, Vector3, Tools } from 'babylonjs';
import { calculateCameraRadius } from '../../helper';
import { CameraShotBehavior, CameraShotBehaviorOrbit, CameraShotBehaviorZoom } from './CameraShotBehavior';
import { MVCameraShotBehaviorSettings, MVCameraShotBehaviourType, MVCameraShotSettings } from './interfaces';
import { MVCamera } from './MVCamera';
import { CoreError, MVLogger } from '../../logging';
import { CameraShotBehaviorFovZoom } from './CameraShotBehavior/CameraShotBehaviorFovZoom';

/**
 * Base camera shot class for handling camera shot settings
 */
export class MVCameraShot {
  public readonly id: string;
  public readonly category: string;
  private behaviors: CameraShotBehavior[] = [];
  private settings: MVCameraShotSettings;
  private _active: boolean;

  /**
   * Create a new Camera shot based on MVCameraShotSettings
   * @param settings -
   * @param id -
   */
  constructor(settings: MVCameraShotSettings, id: string) {
    this.id = id;
    this.category = settings.category;
    this.settings = settings;

    // Set shot behavior`s if exists
    this.settings.behaviors?.forEach((behavior: MVCameraShotBehaviorSettings) => {
      if (Object.keys(MVCameraShotBehaviourType).includes(behavior.type)) {
        this.behaviors.push(this.createNewCameraShotBehavior(behavior.type, behavior));
      } else {
        MVLogger.fatal(CoreError.InvalidParameterError, `Behavior with type: ${behavior.type} does not exist`);
      }
    });
  }

  /**
   * Get Active state
   */
  public isActive(): boolean {
    return this._active;
  }

  /**
   * Update Camera settings/parameters including all camera shot behaviors
   * @param camera - that get´s updated
   */
  private updateSettings(camera: MVCamera): void {
    // Reset camera values
    // this.resetCameraValues(camera);

    // Set required settings
    camera.setPosition(new Vector3(...this.settings.position));
    camera.setTarget(new Vector3(...this.settings.target), false, true);

    camera.radius = calculateCameraRadius(camera.position, camera.target);
    camera.upperRadiusLimit = camera.radius;
    camera.lowerRadiusLimit = camera.radius;

    // Set defaults
    camera.lowerAlphaLimit = camera.alpha;
    camera.upperAlphaLimit = camera.alpha;
    camera.lowerBetaLimit = camera.beta;
    camera.upperBetaLimit = camera.beta;
    camera.inputs.removeByType('ArcRotateCameraMouseWheelInput');
    camera.inputs.removeByType('MVCameraMouseWheelInputFOV');
    camera.inputs.add(new ArcRotateCameraMouseWheelInput() as any);

    camera.rebuildAnglesAndRadius();

    // Set optional settings
    camera.fov = this.settings.fov ? Tools.ToRadians(this.settings.fov) : camera.fov;

    // Attach camera behaviors
    if (this.behaviors.length > 0) {
      this.behaviors.forEach((behavior: CameraShotBehavior) => {
        behavior.activate(camera);
      });
    }
  }

  /**
   * Set Camera shot active
   * @param camera -
   */
  public activate(camera: MVCamera): void {
    this._active = true;

    this.updateSettings(camera);
  }

  /**
   * Deactivate camera shot
   * @param camera -
   */
  public deactivate(camera: MVCamera): void {
    this._active = false;
    if (this.behaviors.length > 0) {
      this.behaviors.forEach((behavior: CameraShotBehavior) => {
        behavior.deactivate(camera);
      });
    }
  }

  /**
   * Creates a new camera shot behavior based on the MVCameraShotBehaviourType
   * @param type -
   * @param settings -
   *
   */
  private createNewCameraShotBehavior(
    type: MVCameraShotBehaviourType,
    settings: MVCameraShotBehaviorSettings,
  ): CameraShotBehavior {
    switch (type) {
      case MVCameraShotBehaviourType.ORBIT:
        return new CameraShotBehaviorOrbit(settings);
      case MVCameraShotBehaviourType.ZOOM:
        return new CameraShotBehaviorZoom(settings);
      case MVCameraShotBehaviourType.FOV_ZOOM:
        return new CameraShotBehaviorFovZoom(settings);
    }
  }

  /**
   * Reset all camera values
   * @param camera -
   */
  private resetCameraValues(camera: MVCamera): void {
    camera.alpha = 0;
    camera.lowerAlphaLimit = null;
    camera.upperAlphaLimit = null;
    camera.beta = 0;
    camera.lowerBetaLimit = null;
    camera.upperBetaLimit = null;
  }

  /**
   * Get camera shot settings
   */
  public getSettings(): MVCameraShotSettings {
    return this.settings;
  }

  /**
   * Get behaviors
   */
  public getBehaviors(): CameraShotBehavior[] {
    return this.behaviors;
  }
}
