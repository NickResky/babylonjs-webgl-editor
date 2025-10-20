import { MVEntity } from './mv-entity';
import { MVEntityConfig, MVEnvironmentConfigs, MVEnvironmentConfig } from './interfaces';
import { loadJson } from '../../helper';
import { MVLogger } from '../../logging';
import { Subject } from 'rxjs';
import { BaseTexture } from 'babylonjs';

/**
 * Class for environment entities
 */
export class MVEnvironmentEntity extends MVEntity {
  public environmentSceneSettings: MVEnvironmentConfigs;
  public activeEnvironmentSceneSetting: MVEnvironmentConfig;
  public activeEnvironmentCode: string;
  public environmentTextures: BaseTexture[] = [];

  /**
   * Creates a new environment entity
   * @param entityConfig -
   * @param entityUuid -
   */
  constructor(entityConfig: MVEntityConfig, entityUuid: string, onLoadingProgressUpdate$: Subject<number>) {
    super(entityConfig, entityUuid, onLoadingProgressUpdate$);
    this.setupEnvironmentSettings();
  }

  /**
   * Setup the encironment settings
   *
   */
  private async setupEnvironmentSettings(): Promise<void> {
    if (this.entityConfig['environmentConfig']) {
      this.environmentSceneSettings = this.entityConfig['environmentConfig'];
      return;
    }
    const environmentConfigJsonUrl =
      this.entityConfig.entityConfigBaseUrl + this.entityConfig.environmentConfigRelative;
    try {
      this.environmentSceneSettings = await loadJson(environmentConfigJsonUrl);
    } catch(error) {
      MVLogger.error('Failed to setup environment settings for entity ' + this.entityConfig.id);
      throw error;
    }
  }
}
