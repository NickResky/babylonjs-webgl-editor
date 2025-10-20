import { CameraService } from '../services';
import { MVCameraShot, MVCamera, MVCameraShotMetaData, MVCameraShotsMetaData } from '../models/camera';
import { injectable, inject } from 'inversify';
import { TYPES } from '../ioc/types';
import { CoreSettings } from '../settings';
import { QueueAsync } from '../globals/queue-async.decorator';

/**
 * CameraController
 */
@injectable()
export class CameraController {
  /**
   * Constructor
   */
  constructor(
    @inject(TYPES.CameraService) private _cameraService?: CameraService,
    @inject(TYPES.CoreSettings) private _settings?: CoreSettings,
  ) {}

  /**
   * Returns the active camera
   *
   */
  public getActiveCamera(): MVCamera {
    return this._cameraService.getActiveCamera();
  }

  /**
   * Load new camera shots for camera
   * @param baseUrl -
   * @param cameraShotUrls -
   * @deprecated
   *
   */
  public async loadCameraShots(cameraShotUrls: string[]): Promise<MVCameraShot[]> {
    return this._cameraService.addCameraShots(cameraShotUrls)
  }

  /**
   * Load new camera shots for camera
   * @param baseUrl -
   * @param cameraShotUrls -
   *
   */
    public async loadCameraShotsFromMetaData(cameraShotsMetaData: MVCameraShotsMetaData): Promise<MVCameraShot[]> {
      return this._cameraService.addCameraShotsFromMetaData(cameraShotsMetaData);
    }

  /**
   * Return all ids of camera shots
   */
  public getAllCameraShotsIds(): string[] {
    return this._cameraService.getAllCameraShotsIds();
  }

  /**
   * Get all camera shots
   */
  public getAllCameraShots(): Map<string, MVCameraShot> {
    return this._cameraService.getAllCameraShots();
  }

  /**
   * Request a camera shot by id
   * @param id -
   */
  @QueueAsync()
  public async requestCameraShot(id: string, disableSceneFreezing?: boolean, forceUpdate?: boolean): Promise<MVCameraShot> {
    return this._cameraService.requestCameraShot(id, forceUpdate, disableSceneFreezing);
  }
}
