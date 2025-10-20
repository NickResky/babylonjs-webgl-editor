import { injectable, inject } from 'inversify';
import { EntityService } from '../services';
import { MVEntity } from '../models/entity/mv-entity';
import { AnimationService } from '../services/animation.service';
import { TYPES } from '../ioc/types';
import { PlayAnimationOptions } from '../models/animation';

/**
 * AnimationController
 */
@injectable()
export class AnimationController {
  /**
   * Constructor
   */
  constructor(
    @inject(TYPES.EntityService) private _entityService: EntityService,
    @inject(TYPES.AnimationService) private _animationService: AnimationService,
  ) {}

  /**
   * Play animation
   * @param animationGroupId -
   * @param entityOrEntityUuid -
   * @param options -
   */
  public async play(
    animationGroupId: string,
    entityOrEntityUuid?: MVEntity | string,
    options: PlayAnimationOptions = {},
  ): Promise<void> {
    const entities = entityOrEntityUuid ? this.getEntity(entityOrEntityUuid) : this._entityService.getEntities();
    const animationPromises = [];
    for (const _entity of entities) {
      animationPromises.push(this._animationService.play(animationGroupId, _entity, options));
    }
    await Promise.all(animationPromises);
  }

  /**
   * Reset an animation
   * @param animationGroupId -
   * @param entityOrEntityUuid -
   */
  public reset(animationGroupId: string, entityOrEntityUuid?: MVEntity | string): void {
    const entities = entityOrEntityUuid ? this.getEntity(entityOrEntityUuid) : this._entityService.getEntities();
    for (const _entity of entities) {
      try {
        this._animationService.reset(animationGroupId, _entity);
      } catch (error) {}
    }
  }

  /**
   * Pause an animation
   * @param animationGroupId -
   * @param entityOrEntityUuid -
   */
  public pause(animationGroupId: string, entityOrEntityUuid?: MVEntity | string): void {
    const entities = entityOrEntityUuid ? this.getEntity(entityOrEntityUuid) : this._entityService.getEntities();
    for (const _entity of entities) {
      try {
        this._animationService.pause(animationGroupId, _entity);
      } catch (error) {}
    }
  }

  /**
   * Stop an animation
   * @param animationGroupId -
   * @param entityOrEntityUuid -
   */
  public stop(animationGroupId: string, entityOrEntityUuid?: MVEntity | string): void {
    const entities = entityOrEntityUuid ? this.getEntity(entityOrEntityUuid) : this._entityService.getEntities();
    for (const _entity of entities) {
      try {
        this._animationService.stop(animationGroupId, _entity);
      } catch (error) {}
    }
  }

  /**
   * List of available animations
   */
  public list(): string[] {
    const entities = this._entityService.getEntities();
    const animations = entities.reduce((acc, val) => [...acc, ...val.animations], []);

    return animations.map(p => p.id);
  }

  /**
   * Get entity array from id or entity
   * @param entityOrEntityUuid -
   */
  private getEntity(entityOrEntityUuid: MVEntity | string): MVEntity[] {
    if (entityOrEntityUuid instanceof MVEntity) {
      return [entityOrEntityUuid];
    }
    // If the given parameter is an entity uuid, get that entity and return it
    return [this._entityService.getEntity(entityOrEntityUuid)];
  }
}
