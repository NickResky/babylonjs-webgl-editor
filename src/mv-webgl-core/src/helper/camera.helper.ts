import { Vector3, ArcRotateCamera, Animation } from 'babylonjs';
import { MVCameraShotBehaviorSettings } from '../models/camera';
import { createAnimation } from './animation.helper';

/**
 * Calculate the camera radius from position and target
 * @param position -
 * @param target -
 *
 */
export const calculateCameraRadius = (position: Vector3, target: Vector3): number => {
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const dz = target.z - position.z;
  return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2) + Math.pow(dz, 2));
};

/**
 * Calculate the camera radius in relation to the aspect ratio
 * @param camera -
 * @param zoomBehavior -
 */
export const calculateCameraRadiusFromCameraZoomBehavior = (
  camera: ArcRotateCamera,
  zoomBehavior: MVCameraShotBehaviorSettings,
) => {
  const options = zoomBehavior.options;
  const engine = camera.getScene().getEngine();

  // Get aspect radio of viewport
  const aspectRatio = engine.getAspectRatio(camera);
  // Calculate the center of the radius with lower and upper limit
  const middleValue = Math.round((options.lowerRadiusLimit + options.upperRadiusLimit) / 2);
  // Calculate a radius with middleValue multiplied by the aspect ratio to get a number, that defines
  // if it should zoom in or out. The 0.7 is the dumping factor so that the aspect radio has not that much effect.
  const radius = middleValue * aspectRatio * 0.7;
  // Subtract the radius from middle value to get an negative value that can be subtracted from middleValue
  let newRadius = middleValue - radius + middleValue;
  // Check if newRadius is in the limit bounding
  if (newRadius < options.lowerRadiusLimit) {
    newRadius = options.lowerRadiusLimit;
  }

  if (newRadius > options.upperRadiusLimit) {
    newRadius = options.upperRadiusLimit;
  }
  return newRadius;
};

export const resetCameraRotationLimits = (camera: ArcRotateCamera) => {
  camera.lowerAlphaLimit = null;
  camera.upperAlphaLimit = null;
  camera.lowerBetaLimit = null;
  camera.upperBetaLimit = null;
};

export const resetCameraRadiusLimits = (camera: ArcRotateCamera) => {
  camera.lowerRadiusLimit = null;
  camera.upperRadiusLimit = null;
};

/**
 * Creates and triggers an animation to transform a passed ArcRotateCamera
 * @param camera -
 * @param fps -
 * @param animationDuration -
 * @param newTarget -
 * @param newRadius -
 * @param newAlpha -
 * @param newBeta -
 * @param newFov -
 */
export const createAndPlayCameraTransformAnimation = async (
  camera: ArcRotateCamera,
  fps: number,
  animationDuration: number,
  newTarget: Vector3,
  newRadius: number,
  newAlpha: number,
  newBeta: number,
  newFov: number,
): Promise<void> => {
  camera.animations = [];

  if (!newFov) {
    newFov = camera.fov;
  }

  createAnimation(
    'targetAnimation',
    'target',
    Animation.ANIMATIONTYPE_VECTOR3,
    camera,
    fps,
    animationDuration,
    camera.target.clone(),
    newTarget,
  );

  createAnimation(
    'radiusAnimation',
    'radius',
    Animation.ANIMATIONTYPE_FLOAT,
    camera,
    fps,
    animationDuration,
    camera.radius,
    newRadius,
  );

  createAnimation(
    'fovAnimation',
    'fov',
    Animation.ANIMATIONTYPE_FLOAT,
    camera,
    fps,
    animationDuration,
    camera.fov,
    newFov,
  );

  createAnimation(
    'betaAnimation',
    'beta',
    Animation.ANIMATIONTYPE_FLOAT,
    camera,
    fps,
    animationDuration,
    camera.beta,
    newBeta,
  );

  createAnimation(
    'alphaAnimation',
    'alpha',
    Animation.ANIMATIONTYPE_FLOAT,
    camera,
    fps,
    animationDuration,
    camera.alpha,
    newAlpha,
  );

  return new Promise(res => {
    camera.getScene().beginAnimation(camera, 0, animationDuration, false, 0.6, () => {
      res();
    });
  });
};

/**
 * Creates and plays and animation which changes the fov value of a passed camera
 * @param camera -
 * @param fps -
 * @param animationDuration -
 * @param speedRatio -
 * @param newFovValue -
 */
export const createAndPlayCameraFovAnimation = async (
  camera: ArcRotateCamera,
  fps: number,
  animationDuration: number,
  speedRatio: number,
  newFovValue: number,
): Promise<void> => {
  camera.animations = [];

  createAnimation(
    'zoomAnimation',
    'fov',
    Animation.ANIMATIONTYPE_FLOAT,
    camera,
    fps,
    animationDuration,
    camera.fov,
    newFovValue,
  );

  return new Promise(res => {
    camera.getScene().beginAnimation(camera, 0, animationDuration, false, speedRatio, () => {
      res();
    });
  });
};
