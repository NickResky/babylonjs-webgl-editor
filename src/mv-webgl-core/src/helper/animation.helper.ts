import { Animation, IAnimationKey, AnimationGroup, NodeMaterialBlock } from 'babylonjs';

/**
 *
 */
export const createAnimation = (
  animationName: string,
  property: string,
  propertyType: any,
  object: any,
  fps: number,
  duration: number,
  oldValue: any,
  newValue: any,
): Animation => {
  const animation = new Animation(animationName, property, fps, propertyType);

  const keyFrames: IAnimationKey[] = [];

  keyFrames.push({
    frame: 0,
    value: oldValue,
  });

  keyFrames.push({
    frame: duration,
    value: newValue,
  });

  animation.setKeys(keyFrames);
  object.animations.push(animation);
  return animation;
};

