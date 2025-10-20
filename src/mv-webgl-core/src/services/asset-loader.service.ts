import { AbstractMesh, AnimationGroup, AssetContainer, Camera, DracoCompression, ISceneLoaderProgressEvent, Scene, SceneLoader } from 'babylonjs';
import 'babylonjs-loaders';
import { inject, injectable } from 'inversify';
import { AssetContainerResult, detectAndroidDevice } from '../helper';
import { TYPES } from '../ioc/types';
import { MVLogger } from '../logging';
import { MVEntity } from '../models/entity/mv-entity';
import { MVLayer } from '../models/entity/mv-layer';
import { PlatformService } from './platform.service';

/**
 * Asset Loader
 */
@injectable()
export class AssetLoaderService {


  constructor(
    @inject(TYPES.PlatformService) private platform: PlatformService,
  ) { 
    // WASM decoder is not working on Chrome version for Android. This is the workaround. 
    const isAndroidDevice = detectAndroidDevice()
    if (isAndroidDevice) {
      MVLogger.info('Android device detected');
      DracoCompression.Configuration = {
        decoder: {
          fallbackUrl: "https://preview.babylonjs.com/draco_decoder_gltf.js",
          wasmBinaryUrl: null,
          wasmUrl: null
        }
      }
    }
  }

  /**
   * Loads a mesh from an external resource
   * @param url -
   * @param fileName -
   *
   */
  public async loadMeshes(url: string, fileName: string, layer?: MVLayer): Promise<AbstractMesh[]> {
    return SceneLoader.LoadAssetContainerAsync(url, fileName).then((assetContainer: AssetContainer) => {
      if (layer) {
        layer.assetContainers.push(assetContainer);
      }
      return assetContainer.meshes;
    });
  }

  /**
   * Loads a mesh from an external resource
   * @param url -
   * @param fileName -
   *
   */
  public async loadRig(url: string, fileName: string, entity?: MVEntity): Promise<AbstractMesh[]> {
    return SceneLoader.LoadAssetContainerAsync(url, fileName).then((assetContainer: AssetContainer) => {
      if (entity) {
        entity.assetContainers.push(assetContainer);
      }
      return assetContainer.meshes;
    });
  }

  public async loadAssetContainerParams(params: {
    url: string,
    fileName: string,
    layer: MVLayer
  }): Promise<AssetContainer> {
    const assetContainer = await this.loadAssetContainer(params.url, params.fileName);
    params.layer.assetContainers.push(assetContainer);
    return assetContainer;
  }

  public async loadAssetContainer(url: string, fileName): Promise<AssetContainer> {
    if (!fileName || fileName.length < 1 || fileName == '.glb') return null

    return SceneLoader.LoadAssetContainerAsync(url, fileName);
  }

  public async loadAssetContainerWithoutUncompressing(url: string, fileName: string, scene: Scene): Promise<AssetContainerResult> {
    if (!fileName || fileName.length < 1 || fileName == '.glb') return {
      uncompressedAssetContainer: null
    };
    
    return new Promise(async (resolve, reject) => {
      let downloadFinishedTime;
      const promise = SceneLoader.LoadAssetContainerAsync(url, fileName, scene, (event: ISceneLoaderProgressEvent) => {
        const loadingPercentage = event.loaded / event.total;
        if (loadingPercentage >= 1.0) {
          downloadFinishedTime = Date.now();
          resolve({
            uncompressedAssetContainer: promise
          });
        }
      });
    });
  }

  /**
   * Loads a meshes and animation groups from an external resource
   * @param url -
   * @param fileName -
   *
   */
  public loadMeshesAndAnimationGroups(
    url: string,
    fileName: string,
  ): Promise<{
    meshes: AbstractMesh[];
    animationGroups: AnimationGroup[];
  }> {
    return SceneLoader.LoadAssetContainerAsync(url, fileName).then((assetContainer: AssetContainer) => {
      return {
        meshes: assetContainer.meshes,
        animationGroups: assetContainer.animationGroups,
      };
    });
  }

  /**
   * Loads AnimationGroups from an external resource
   * @param url -
   * @param fileName -
   *
   */
  public loadAnimationGroups(url: string, fileName: string, entity?: MVEntity): Promise<AnimationGroup[]> {
    return SceneLoader.LoadAssetContainerAsync(url, fileName).then((assetContainer: AssetContainer) => {
      if (entity) {
        entity.assetContainers.push(assetContainer);
      }
      return assetContainer.animationGroups;
    });
  }

  /**
   * Loads Cameras from an external resource
   * @param url -
   * @param fileName -
   *
   */
  public loadCameras(url: string, fileName: string): Promise<Camera[]> {
    return SceneLoader.LoadAssetContainerAsync(url, fileName).then((assetContainer: AssetContainer) => {
      return assetContainer.cameras;
    });
  }
}
