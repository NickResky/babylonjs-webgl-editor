import { MVSceneOptimizerService } from '../services/mv-scene-optimizer.service';
import { injectable, inject } from 'inversify';
import { TYPES } from '../ioc/types';

/**
 * SceneController
 */
@injectable()
export class SceneController {
  /**
   * Constructor
   */
  constructor(
    @inject(TYPES.MVSceneOptimizerService) private _sceneOptimizerService: MVSceneOptimizerService
  ) {}

  /**
   * Starts sceen optimizations
   *
   */
  public startOptimizationStrategies(): Promise<void> {
    return this._sceneOptimizerService.startFPSBasedOptimizer();
  }

}
