import { calculateCameraRadiusFromCameraZoomBehavior } from '../../../helper';
import { MVCameraShotBehaviorSettings } from '../interfaces';
import { MVCamera } from '../MVCamera';
import { CameraShotBehavior } from './CameraShotBehavior';

/**
 * Camera-Zoom behavior class
 */
export class CameraShotBehaviorZoom extends CameraShotBehavior {
  /**
   * Create a new Zoom-Behavior based on the MVCameraShotBehaviorSettings
   * @param settings -
   */
  constructor(settings: MVCameraShotBehaviorSettings) {
    super(settings);
  }

  /**
   * Update settings
   * @param camera -
   *
   */
  protected override updateSettings(camera: MVCamera): MVCamera {
    super.updateSettings(camera);
    const options = this.settings.options;

    if (options.lowerRadiusLimit !== null && options.upperRadiusLimit !== null) {
      camera.lowerRadiusLimit = options.lowerRadiusLimit;
      camera.upperRadiusLimit = options.upperRadiusLimit;
      camera.radius = calculateCameraRadiusFromCameraZoomBehavior(camera, this.settings);
      camera.rebuildAnglesAndRadius();
    }

    if (options.wheelPrecision) {
      camera.wheelDeltaPercentage = this.settings.options.wheelPrecision;
      camera.wheelPrecision = this.settings.options.wheelPrecision;
    }

    return camera;
  }

  /**
   * Activate behavior on camera
   * @param camera -
   */
  public override  activate(camera: MVCamera): void {
    super.activate(camera);
  }

  /**
   * Deactivate behavior on camera
   * @param camera -
   */
  public override deactivate(camera: MVCamera): void {
    super.deactivate(camera);
    camera.upperRadiusLimit = camera.radius;
    camera.lowerRadiusLimit = camera.radius;
  }
}
