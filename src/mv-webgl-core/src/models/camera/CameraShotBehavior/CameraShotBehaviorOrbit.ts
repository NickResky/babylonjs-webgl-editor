import { Tools } from 'babylonjs';
import { modulo } from '../../../helper';
import { MVCameraShotBehaviorSettings } from '../interfaces';
import { MVCamera } from '../MVCamera';
import { CameraShotBehavior } from './CameraShotBehavior';

/**
 * Camera-Orbit behavior class
 */
export class CameraShotBehaviorOrbit extends CameraShotBehavior {
  /** We need the index to access the following element of alphaToRadiusMappingsArray */
  private alphaToRadiusIndex: number;
  private previousAlpha: number;

  /**
   * Create a new Orbit-Behavior based on the MVCameraShotBehaviorSettings
   * @param settings -
   */
  constructor(settings: MVCameraShotBehaviorSettings) {
    super(settings);
    this.alphaToRadiusIndex = 0;
  }

  /**
   * Update settings
   * @param camera -
   *
   */
  protected override updateSettings(camera: MVCamera): MVCamera {
    super.updateSettings(camera);

    camera.lowerAlphaLimit = this.settings.options.lowerAlphaLimit
      ? Tools.ToRadians(this.settings.options.lowerAlphaLimit)
      : null;
    camera.upperAlphaLimit = this.settings.options.upperAlphaLimit
      ? Tools.ToRadians(this.settings.options.upperAlphaLimit)
      : null;
    camera.lowerAlphaLimitDegrees = this.settings.options.lowerAlphaLimit ? this.settings.options.lowerAlphaLimit : 0;
    camera.upperAlphaLimitDegrees = this.settings.options.upperAlphaLimit ? this.settings.options.upperAlphaLimit : 0;
    camera.lowerBetaLimit = this.settings.options.lowerBetaLimit
      ? Tools.ToRadians(this.settings.options.lowerBetaLimit)
      : null;
    camera.upperBetaLimit = this.settings.options.upperBetaLimit
      ? Tools.ToRadians(this.settings.options.upperBetaLimit)
      : null;

    camera.inertia = this.settings.options.inertia ? this.settings.options.inertia : 0.9;

    // Invert camera for interior
    if (camera.radius < 1) {
      camera.angularSensibilityX = -4000;
      camera.angularSensibilityY = -4000;
    } else {
      camera.angularSensibilityX = 1500;
      camera.angularSensibilityY = 1500;
    }

    this.setAutoRotationFromBehavior(camera);

    camera.rebuildAnglesAndRadius();

    this.previousAlpha = camera.alpha;

    return camera;
  }

  /**
   * Update settings on camera rotation. If there is a entry for alphaToRadiusMappings in the camera shot config the camera moves towards or from the camera target, based on its rotation(alpha) and the corresponding radius value. The radius in between each element is calculated with a linear slope.
   * @param camera -
   */
  public override updateSettingsOnRotation(camera: MVCamera): MVCamera {
    const alphaToRadiusMappings = this.settings.options.alphaToRadiusMappings;
    const alphaToRadiusMappingsArray = [];

    for (const key in alphaToRadiusMappings) {
      if (alphaToRadiusMappings.hasOwnProperty(key)) {
        alphaToRadiusMappingsArray.push({ alpha: +key, radius: alphaToRadiusMappings[key] });
      }
    }

    if (alphaToRadiusMappings) {
      let alphaInDegrees = Tools.ToDegrees(camera.alpha);
      alphaInDegrees = modulo(alphaInDegrees, 360);
      let calculatedRadius = 360;
      let minimalAlphaDifference = 360;
      let currentAlphaRadiusIndex = 0;

      for (const key in alphaToRadiusMappings) {
        const alphaDifference = alphaInDegrees - parseInt(key);
        if (alphaDifference > 0 && alphaDifference < minimalAlphaDifference) {
          minimalAlphaDifference = alphaDifference;
          this.alphaToRadiusIndex = currentAlphaRadiusIndex++;
        }
      }

      let nextIndex = this.alphaToRadiusIndex;
      this.alphaToRadiusIndex + 1 >= alphaToRadiusMappingsArray.length ? (nextIndex = 0) : nextIndex++;

      let alphaDifference =
        alphaToRadiusMappingsArray[nextIndex].alpha - alphaToRadiusMappingsArray[this.alphaToRadiusIndex].alpha;
      alphaDifference = modulo(alphaDifference, 360);
      const radiusDifference =
        alphaToRadiusMappingsArray[nextIndex].radius - alphaToRadiusMappingsArray[this.alphaToRadiusIndex].radius;
      const slope = radiusDifference / alphaDifference;

      //Radius Calculation
      calculatedRadius =
        alphaToRadiusMappingsArray[this.alphaToRadiusIndex].radius +
        slope * (alphaInDegrees - alphaToRadiusMappingsArray[this.alphaToRadiusIndex].alpha);
      // The following sets the camera radius as fixed to the radius based on the above mapping.
      camera.upperRadiusLimit = calculatedRadius;
      camera.lowerRadiusLimit = calculatedRadius;

      camera.radius = calculatedRadius;
    }

    if (this.settings.options.lowerAlphaLimit !== undefined && this.settings.options.upperAlphaLimit !== undefined) {

      // check if current alpha value is within 20% range from limitation
      const limit = 0.2;
      const factor = 1.5;

      const alphaRange = Math.abs(this.settings.options.upperAlphaLimit - this.settings.options.lowerAlphaLimit);
      const cameraAlphaInDeg = Tools.ToDegrees(camera.alpha);

      const distanceFromLowerLimit = Math.abs(cameraAlphaInDeg - this.settings.options.lowerAlphaLimit);
      const withinLowerLimitRange = distanceFromLowerLimit < alphaRange * limit;

      const distanceFromUpperLimit = Math.abs(cameraAlphaInDeg - this.settings.options.upperAlphaLimit);
      const withinUpperLimitRange = distanceFromUpperLimit  < alphaRange * limit;

      const alphaDecreased = camera.alpha < this.previousAlpha;
      const alphaIncreased = camera.alpha > this.previousAlpha;

      const defaultInertia = this.settings.options.inertia ? this.settings.options.inertia : 0.9;

      const shouldDecreaseInertia = (withinLowerLimitRange && alphaDecreased) || (withinUpperLimitRange && alphaIncreased);
      const shouldResetInertia = (!withinLowerLimitRange && !withinUpperLimitRange) || (withinLowerLimitRange && alphaIncreased) || (withinUpperLimitRange && alphaDecreased);

      if (shouldDecreaseInertia && alphaDecreased) {
        camera.inertia = Math.max((distanceFromLowerLimit / (alphaRange * limit * factor)) * defaultInertia, 0.01);
      } else if (shouldDecreaseInertia && alphaIncreased) {
        camera.inertia = Math.max((distanceFromUpperLimit / (alphaRange * limit * factor)) * defaultInertia, 0.01);
      } else if (shouldResetInertia) {
        camera.inertia = defaultInertia;
      }

    }

    this.previousAlpha = camera.alpha;

    return camera;
  }

  /**
   * Activate behavior on camera
   * @param camera -
   */
  public override activate(camera: MVCamera): void {
    super.activate(camera);
  }

  /**
   * Deactivate behavior on camera
   * @param camera -
   */
  public override deactivate(camera: MVCamera): void {
    super.deactivate(camera);
    camera.lowerAlphaLimit = camera.alpha;
    camera.upperAlphaLimit = camera.alpha;
    camera.lowerBetaLimit = camera.beta;
    camera.upperBetaLimit = camera.beta;
    camera.angularSensibilityX = 1000;
    camera.angularSensibilityY = 1000;
  }

  /**
   * Set the AutoRotationBehavior if the settings allowing it
   * @param camera -
   */
  private setAutoRotationFromBehavior(camera: MVCamera): void {
    if (this.settings.options.allowAutoRotation) {
      camera.useAutoRotationBehavior = true;
      camera.autoRotationBehavior.idleRotationSpeed = this.settings.options.autoRotationSpeed;
    } else {
      camera.useAutoRotationBehavior = false;
    }
  }
}
