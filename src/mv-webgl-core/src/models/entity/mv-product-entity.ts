import { MVEntity } from './mv-entity';
import { MVEntityConfig } from './interfaces';
import { Subject } from 'rxjs';

/**
 * Class for product entites
 */
export class MVProductEntity extends MVEntity {
  /**
   * Creates a new product entity
   * @param entityConfig -
   * @param entityUuid -
   */
  constructor(entityConfig: MVEntityConfig, entityUuid: string, onLoadingProgressUpdate$: Subject<number>) {
    super(entityConfig, entityUuid, onLoadingProgressUpdate$);
  }
}
