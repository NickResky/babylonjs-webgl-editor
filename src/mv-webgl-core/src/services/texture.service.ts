import { BaseTexture, Scene, Texture } from 'babylonjs';
import { inject, injectable } from 'inversify';
import { getTextureKeyFromUrl } from '../helper';
import { TYPES } from '../ioc/types';
import { MVLogger } from '../logging';
import { MVEntity } from '../models/entity';

/**
 * Texture service for handling textures in scene
 */
@injectable()
export class TextureService {

  /**
   * Create a new TextureService
   * @param scene -
   */
  constructor(@inject(TYPES.Scene) private _scene: Scene) {}

  /**
   * Create or get a texture if exist in scene
   * @param config -
   * @param rootUrl -
   */
  public async createOrGetTextureFromConfig(config: BaseTexture, rootUrl: string): Promise<BaseTexture | null> {
    // new textures only have to be created if they do not already exist in the scene

    let texture: BaseTexture | undefined= this._scene.textures.find((texture: BaseTexture) => texture.name === config.name);
    if (texture) {
      return texture;
    } else {
      const newTexturePromise = new Promise<BaseTexture | null>((resolve) => {
        try {
          const texture = Texture.Parse(config, this._scene, rootUrl);
          if (!texture) {
            resolve(null)
            return
          }
          texture?.getInternalTexture()?.onLoadedObservable.addOnce(() => {
            texture.name = config.name;
            resolve(texture);
          });
        } catch(e) {
          MVLogger.error(`Failed to load texture ${config.name}`);
          resolve(null);
        }
      });

      return newTexturePromise;
    }
  }

  public async createTexture(entity: MVEntity, url: string): Promise<BaseTexture> {
    return new Promise((resolve: any, reject: any) => {
      try {
        // const texture = new Texture(url, this._scene);

        const onLoad = () => {
          const textrureKey = getTextureKeyFromUrl(url, entity.entityConfig.postProcessingConfiguration?.lightmapTextureLevel);
          (texture as any)['mv_textureKey'] = textrureKey;
          (this._scene as any)['mv_cached_textures'][textrureKey] = texture;
          resolve(texture);
        }

        const onError = () => {
          const errorMessage = `Failed to load texture ${url}`;
          MVLogger.error(errorMessage);
          resolve(null);
        }

        const texture = new Texture(url, this._scene, false, true, 2, null, onError);

        texture.onLoadObservable.addOnce(onLoad);

      } catch(e) {
        const errorMessage = `Failed to load texture ${url}`;
        MVLogger.error(errorMessage);
        resolve(null);
      }
    });
  }
}
