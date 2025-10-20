import { MVEntity } from '../models/entity/mv-entity';
import { injectable } from 'inversify';
import { MVLogger, CoreError } from '../logging';
import { PlayAnimationOptions } from '../models/animation/interfaces';

/**
 * The class for all Babylon related Animation functionality
 */
@injectable()
export class AnimationService {
  /**
   * Plays an animation group by name. Resolves the returned promise when the animation has finished playing.
   * @param animationGroupId -
   * @param entity -
   * @param options -
   */
  public async play(
    animationGroupId: string,
    entity: MVEntity,
    options: PlayAnimationOptions = {},
  ): Promise<void> {
    return new Promise(async (resolve: CallableFunction, reject: CallableFunction) => {
      // Get the  BabylonJS AnimationGroup
      const animation = entity.getAnimation(animationGroupId);
      if (!animation) {
        const errorMessage = `No animation group named '${animationGroupId}' found for the entity '${entity.name}'`;
        MVLogger.warn(CoreError.InvalidParameterError, errorMessage);

        return resolve(errorMessage);
      }

      // Play Animation
      await animation.play(options);
      resolve();
    });
  }

  /**
   * Pauses an animation on a specific entity
   * @param animationGroupId -
   * @param entity -
   */
  public async pause(animationGroupId: string, entity: MVEntity): Promise<void> {
    return new Promise(async (resolve: CallableFunction, reject: CallableFunction) => {
      const animation = entity.getAnimation(animationGroupId);
      if (!animation) {
        const errorMessage = `No animation group named '${animationGroupId}' found for the entity '${entity.name}'`;
        MVLogger.warn(CoreError.InvalidParameterError, errorMessage);

        return resolve(errorMessage);
      }
      await animation.pause();
      resolve();
    });
  }

  /**
   * Stops an animation on a specific entity
   * @param animationGroupId -
   * @param entity -
   */
  public stop(animationGroupId: string, entity: MVEntity): void {
    const animation = entity.getAnimation(animationGroupId);
    if (!animation) {
      const errorMessage = `No animation group named '${animationGroupId}' found for the entity '${entity.name}'`;
      MVLogger.warn(CoreError.InvalidParameterError, errorMessage);
      return;
    }
    animation.stop();
  }

  /**
   * Resets an animation on a specific entity
   * @param animationGroupId -
   * @param entity -
   */
  public async reset(animationGroupId: string, entity: MVEntity): Promise<void> {
    return new Promise(async (resolve: CallableFunction, reject: CallableFunction) => {
      const animation = entity.getAnimation(animationGroupId);
      if (!animation) {
        const errorMessage = `No animation group named '${animationGroupId}' found for the entity '${entity.name}'`;
        MVLogger.warn(CoreError.InvalidParameterError, errorMessage);
        return resolve(errorMessage);
      }
      await animation.reset();
      resolve();
    });
  }
}
