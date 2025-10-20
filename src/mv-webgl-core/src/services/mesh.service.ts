import { Scene } from 'babylonjs';
import { AssetLoaderService } from './asset-loader.service';
import { injectable, inject } from 'inversify';
import { TYPES } from '../ioc/types';
import { PlatformService } from './platform.service';

/**
 * Service for modifying meshes
 */

@injectable()
export class MeshService {
  /**
   * Creates a new BabylonJS based Mesh Service
   * @param _scene - the Babylon scene
   * @param _assetLoader - the AssetLoader for mesh loading
   */
  constructor(
    @inject(TYPES.Scene) private _scene: Scene,
    @inject(TYPES.PlatformService) private _platform: PlatformService,
    @inject(TYPES.AssetLoaderService) private _assetLoader: AssetLoaderService,
  ) {}

  


}
