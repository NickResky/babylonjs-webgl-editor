import { MVCameraShotBehaviorSettings } from '../interfaces';
import { MVCamera } from '../MVCamera';

/**
 * Abstract class for Camera-Shot-Behaviors
 */
export abstract class CameraShotBehavior {
  /** Defines the if this behavior is active */
  public active: boolean;
  /** Defines the settings of the behavior that will be applied on the camera */
  public settings: MVCameraShotBehaviorSettings;

  /**
   * Create a new Behavior based on the MVCameraShotBehaviorSettings
   * @param settings -
   */
  protected constructor(settings: MVCameraShotBehaviorSettings) {
    this.settings = settings;
  }

  /**
   * Update settings
   * @param camera -
   *
   */
  protected updateSettings(camera: MVCamera): MVCamera {
    return camera;
  }

  /**
   * Update settings on rotation
   *
   */
  public updateSettingsOnRotation(camera: MVCamera): MVCamera {
    return camera;
  }

  /**
   * Activate behavior on camera
   * @param camera -
   */
  public activate(camera: MVCamera): void {
    this.active = true;
    this.updateSettings(camera);
  }

  /**
   * Deactivate behavior on camera
   * @param camera -
   */
  public deactivate(camera: MVCamera): void {
    this.active = false;
  }
}
