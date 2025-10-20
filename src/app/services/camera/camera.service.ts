import { Injectable } from '@angular/core';
import {
  ArcRotateCamera,
  Camera,
  FreeCamera,
  GizmoManager,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  Tools,
  Vector3,
} from 'babylonjs';
import { DefaultRenderingPipeline } from 'babylonjs/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import {
  Core,
  MVCamera,
  MVCameraShotBehaviorSettings,
  MVCameraShotBehaviourType,
  MVCameraShotMetaData,
  MVCameraShotSettings,
  MVCameraShotsMetaData,
  MVEntityConfig,
} from 'mv-core';
import { BehaviorSubject } from 'rxjs';
import { ElectronService } from '../electron/electron.service';
import { FileAccessService, FileType } from '../file-access/file-access.service';
import { NotifierService } from '../notifier/notifier.service';
import { ProductionExportService } from '../production-export/production-export.service';
import { UserService } from '../user/user.service';

@Injectable({
  providedIn: 'root',
})
export class CameraService {
  private _core: Core;
  private _freeCamera: FreeCamera;
  private _freeCameraActive: boolean = false;
  private _freeCameraActive$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  public freeCameraActive = this._freeCameraActive$.asObservable();
  public activeEntityUrl: string;
  private _baseUrl: string;
  private _entityUrl: string;
  private _entityConfig: MVEntityConfig;
  private _cameraShots: MVCameraShotsMetaData = {};
  private _cameraShots$: BehaviorSubject<MVCameraShotsMetaData> = new BehaviorSubject({});
  public cameraShots$ = this._cameraShots$.asObservable();
  public activeCameraShotCategory: string = null;
  private _activeCameraShotCategory$: BehaviorSubject<string> = new BehaviorSubject(null);
  public activeCameraShotCategory$ = this._activeCameraShotCategory$.asObservable();

  public canvas: HTMLCanvasElement;
  public mainCameraTargetHelper: Mesh;
  public mainCameraTargetGizmoManager: GizmoManager;

  private _defaultCameraShotData: MVCameraShotSettings = {
    category: 'ext',
    target: [-1.2, 0.3, 0],
    position: [1.8646088388512434, 2.696629522230178, -2.637108188529546],
    fov: 35,
    behaviors: [
      {
        type: MVCameraShotBehaviourType.ORBIT,
        options: {
          allowAutoRotation: false,
          lowerBetaLimit: 57.29582048692501,
          upperBetaLimit: 97.4028948277725,
          autoRotationSpeed: 0.05,
        },
      },
      {
        type: MVCameraShotBehaviourType.ZOOM,
        options: {
          wheelPrecision: 0.01,
          lowerRadiusLimit: 4.7,
          upperRadiusLimit: 8,
        },
      },
    ],
  };

  constructor(
    private fileService: FileAccessService,
    private notifier: NotifierService,
    private electronService: ElectronService,
    private userService: UserService,
    private productionExportService: ProductionExportService
  ) {}

  public async setupCamera(
    core: Core,
    entityBaseUrl: string,
    entityConfig: MVEntityConfig,
    entityUrl: string
  ) {
    this._core = core;
    this.canvas = this._core._canvas;
    this._baseUrl = entityBaseUrl;
    this._cameraShots = {};
    this._entityUrl = entityUrl;
    this._entityConfig = entityConfig;
    // cameraShotUrlsRelative.forEach((cameraShotUrl) => {
    //   this._cameraShotUrlsRelative.push(cameraShotUrl);
    // });

    await this.reloadCameraShots(this._entityConfig.cameraShots);
  }

  public getDefaultCameraShot() {
    const defaultCameraShotId = this.getDefaultCameraShotId();
    if (!defaultCameraShotId) return null;
    return this._cameraShots[defaultCameraShotId];
  }

  public async requestDefaultCameraShot() {
    const defaulCameraShotId = this.getDefaultCameraShotId();
    await this.requestCameraShot(defaulCameraShotId, false);
  }

  public getDefaultCameraShotId(): string {
    if (!this._cameraShots) return null;
    return Object.values(this._cameraShots)[0]?.id;
  }

  public getActiveCameraShot(): MVCameraShotMetaData {
    for (let cameraShotId of Object.keys(this._cameraShots)) {
      const cameraShotMetaData: MVCameraShotMetaData = this._cameraShots[cameraShotId];
      if (cameraShotMetaData.activeInEditor) {
        return cameraShotMetaData;
      }
    }
    return null;
  }

  public getCameraConfig(basePath: string, fileName: string): Promise<MVCameraShotSettings> {
    const newPath = basePath.replace('file://', '');
    const newFileName = fileName.replace('.json', '');
    return new Promise((resolve, reject) => {
      this.fileService.getFile(newPath, newFileName, FileType.JSON).then(
        (data: string) => {
          try {
            const config = JSON.parse(data);
            resolve(config);
          } catch (e) {
            reject(e);
          }
        },
        (err) => reject(err)
      );
    });
  }

  public async updateCamera(cameraShotMetaData: MVCameraShotMetaData): Promise<void> {
    const baseUrl = this._baseUrl.replace('file://', '');

    const activeCameraShotUrl = cameraShotMetaData.mobileActiveInEditor
      ? cameraShotMetaData.mobileUrlRelative
      : cameraShotMetaData.urlRelative;

    const activeCameraShotSettingsString = await this.fileService.getFile(
      baseUrl,
      activeCameraShotUrl.replace('.json', ''),
      FileType.JSON
    );

    const activeCameraShotSettings: MVCameraShotSettings = JSON.parse(
      activeCameraShotSettingsString
    ) as MVCameraShotSettings;
    const camera = this._core.getScene().getCameraByID('mainCamera') as ArcRotateCamera;

    // Babylon cameras save FOV values in degree units. Our json files have Radian units. One Radian unit is 360 /(2 * pi) degrees.
    activeCameraShotSettings.fov = camera.fov * (360 / (2 * Math.PI));
    activeCameraShotSettings.position = [camera.position.x, camera.position.y, camera.position.z];
    activeCameraShotSettings.target = [camera.target.x, camera.target.y, camera.target.z];

    let zoomBehavior = activeCameraShotSettings.behaviors.find(
      (a) => a.type == MVCameraShotBehaviourType.ZOOM
    );
    const zoomBehaviorActive = camera.lowerRadiusLimit !== camera.upperRadiusLimit;
    if (!zoomBehaviorActive && zoomBehavior) {
      // remove zoom behavior
      activeCameraShotSettings.behaviors = activeCameraShotSettings.behaviors.reduce(
        (behaviours: MVCameraShotBehaviorSettings[], currentBehaviour) => {
          if (currentBehaviour.type !== MVCameraShotBehaviourType.ZOOM) {
            behaviours.push(currentBehaviour);
          }
          return behaviours;
        },
        []
      );
    } else {
      if (!zoomBehavior) {
        zoomBehavior = this._defaultCameraShotData.behaviors[1];
        activeCameraShotSettings.behaviors.push(zoomBehavior);
      }
      zoomBehavior.options.lowerRadiusLimit = camera.lowerRadiusLimit;
      zoomBehavior.options.upperRadiusLimit = camera.upperRadiusLimit;
      zoomBehavior.options.wheelPrecision = camera.wheelDeltaPercentage;
      zoomBehavior.options.wheelPrecision = camera.wheelDeltaPercentage;
    }

    let orbitBehavior = activeCameraShotSettings.behaviors.find(
      (a) => a.type == MVCameraShotBehaviourType.ORBIT
    );
    const orbitBehaviorActive =
      camera.lowerBetaLimit !== null ||
      camera.upperBetaLimit !== null ||
      camera.lowerAlphaLimit !== null ||
      camera.upperAlphaLimit !== null ||
      camera.lowerBetaLimit !== camera.upperRadiusLimit ||
      camera.lowerAlphaLimit !== camera.upperAlphaLimit;

    if (!orbitBehaviorActive && orbitBehavior) {
      // remove orbit behavior
      activeCameraShotSettings.behaviors = activeCameraShotSettings.behaviors.reduce(
        (behaviours: MVCameraShotBehaviorSettings[], currentBehaviour) => {
          if (currentBehaviour.type !== MVCameraShotBehaviourType.ZOOM) {
            behaviours.push(currentBehaviour);
          }
          return behaviours;
        },
        []
      );
    } else {
      if (!orbitBehavior) {
        orbitBehavior = this._defaultCameraShotData.behaviors[0];
        activeCameraShotSettings.behaviors.push(orbitBehavior);
      }

      orbitBehavior.options.allowAutoRotation = camera.useAutoRotationBehavior;
      orbitBehavior.options.autoRotationSpeed = camera.autoRotationBehavior?.idleRotationSpeed;
      orbitBehavior.options.inertia = camera.inertia;
      orbitBehavior.options.lowerBetaLimit = camera.lowerBetaLimit * 57.2958; // convert beta value to degrees
      orbitBehavior.options.upperBetaLimit = camera.upperBetaLimit * 57.2958;
      if (camera.lowerAlphaLimit !== null && camera.upperAlphaLimit !== null) {
        orbitBehavior.options.lowerAlphaLimit = Tools.ToDegrees(camera.lowerAlphaLimit);
        orbitBehavior.options.upperAlphaLimit = Tools.ToDegrees(camera.upperAlphaLimit);
      } else {
        delete orbitBehavior.options.lowerAlphaLimit;
        delete orbitBehavior.options.upperAlphaLimit;
      }
    }

    await this.fileService.updateFile(
      baseUrl,
      activeCameraShotUrl.replace('.json', ''),
      FileType.JSON,
      JSON.stringify(activeCameraShotSettings, null, 2)
    );
    this.notifier.notify('success', `Camera ${activeCameraShotUrl} saved`);

    await this.reloadCameraShots(this._cameraShots);
  }

  public destroyFreeCamera() {
    if (this._freeCamera) {
      this._freeCamera.dispose();
      this._freeCamera = null;
    }
  }

  /**
   * Requests a camera shot by id. The camera shot must have been loaded previously from the camera manager.
   * @param {string} id
   */
  public async requestCameraShot(id: string, isMobile: boolean): Promise<void> {
    if (!id) {
      this.requestFreeCamera();
      return;
    }

    const scene: Scene = this._core.getScene();
    this._freeCameraActive = false;
    this._freeCameraActive$.next(this._freeCameraActive);
    if (this._freeCamera) {
      this._freeCamera.detachControl();
    }
    const camera = this._core.Camera.getActiveCamera();
    camera.attachControl(this.canvas);

    const cameraShotMetaData: MVCameraShotMetaData = this._cameraShots[id];

    if (!cameraShotMetaData) {
      console.error(`Camera shot id ${id} not found`);
      return;
    }

    if (isMobile && cameraShotMetaData.cameraShotSettingsMobile) {
      id = id + '_mobile';
    }

    await this._core.Camera.requestCameraShot(id, false, true);
    this.activateCameraShot(cameraShotMetaData, isMobile);

    const mainCamera: MVCamera = this._core.Camera.getActiveCamera();
    mainCamera.orbitBehaviourEnabled = true;
    this.updateMainCameraTargetHelper();
  }

  public activateCameraShot(cameraShotMetaData: MVCameraShotMetaData, isMobile: boolean) {
    if (!cameraShotMetaData) return;

    Object.values(this._cameraShots).forEach((metaData) => {
      metaData.activeInEditor = false;
      metaData.mobileActiveInEditor = false;
      if (metaData == cameraShotMetaData) {
        metaData.activeInEditor = true;
        this.setActiveCameraShotCategory(cameraShotMetaData.cameraShotSettings?.category);
        if (isMobile) {
          metaData.mobileActiveInEditor = true;
        }
      }
    });
  }

  public setActiveCameraShotCategory(category: string) {
    this.activeCameraShotCategory = category;
    this._activeCameraShotCategory$.next(category);
  }

  public toggleFreeCamera() {
    if (!this._freeCameraActive) {
      this.requestFreeCamera();
      this.notifier.notify('info', 'Free Camera activated');
    } else {
      const defaultCameraShotId = this.getDefaultCameraShotId();
      this.requestCameraShot(defaultCameraShotId, false);
      this.notifier.notify('info', 'Free Camera deactivated');
    }
  }

  public isMobileCameraActive() {
    for (let cameraShotId of Object.keys(this._cameraShots)) {
      const cameraShotMetaData: MVCameraShotMetaData = this._cameraShots[cameraShotId];
      if (cameraShotMetaData.mobileActiveInEditor) {
        return true;
      }
    }
    return false;
  }

  public requestNextCameraShot() {
    const previousCameraShotMetaData = this.getActiveCameraShot();

    if (!this._cameraShots || !previousCameraShotMetaData) return;

    const cameraShotsMetaDataArray = Object.values(this._cameraShots);
    const currentIndex = cameraShotsMetaDataArray.indexOf(previousCameraShotMetaData);

    const nextIndex = currentIndex + 1 >= cameraShotsMetaDataArray.length ? 0 : currentIndex + 1;
    this.requestCameraShotByIndex(nextIndex);
  }

  public requestPreviousCameraShot() {
    const previousCameraShotMetaData = this.getActiveCameraShot();

    if (!this._cameraShots || !previousCameraShotMetaData) return;

    const cameraShotsMetaDataArray = Object.values(this._cameraShots);
    const currentIndex = cameraShotsMetaDataArray.indexOf(previousCameraShotMetaData);

    const nextIndex = currentIndex - 1 < 0 ? cameraShotsMetaDataArray.length - 1 : currentIndex - 1;
    this.requestCameraShotByIndex(nextIndex);
  }

  public requestCameraShotByIndex(index: number) {
    const cameraShotsMetaDataArray = Object.values(this._cameraShots);
    if (index < cameraShotsMetaDataArray.length) {
      const cameraShotMetaData = cameraShotsMetaDataArray[index];
      let cameraShotId = cameraShotMetaData.id;
      const mobileCameraActive = this.isMobileCameraActive();
      this.requestCameraShot(cameraShotId, mobileCameraActive);
      this.notifier.notify('info', `${cameraShotId} activated`);
    }
  }

  /**
   * Requests a free camera shot.
   */
  public requestFreeCamera(): void {
    this._freeCameraActive = true;
    this._freeCameraActive$.next(this._freeCameraActive);
    const scene = this._core.getScene();
    if (!this._freeCamera) {
      const camera = new FreeCamera('freeCamera', new Vector3(0, 5, -10), scene);
      camera.speed = 0.2;
      camera.minZ = 0.01;
      camera.fov = 1.13; // fov value of 65 convertet to babylon format (65/57.3 = 1.13)
      const activeCamera = this._core.Camera.getActiveCamera();
      camera.position = activeCamera.position;
      camera.setTarget(activeCamera.target);
      camera.keysUp.push(87); // "w"
      camera.keysDown.push(83); // "s"
      camera.keysLeft.push(65); // "a"
      camera.keysRight.push(68); // "d"
      camera.keysDownward.push(81); // "q" TODO Comment back in after babylon update
      camera.keysUpward.push(69); // "e" TODO Comment back in after babylon update
      this._freeCamera = camera;
      // Add camera to render pipeline
      const renderPipeline: DefaultRenderingPipeline = scene.postProcessRenderPipelineManager
        .supportedPipelines[0] as DefaultRenderingPipeline;
      renderPipeline.addCamera(this._freeCamera);
      renderPipeline.prepare();
      scene.postProcessRenderPipelineManager.update();
    }
    this._freeCamera.attachControl(this.canvas);
    scene.activeCamera = this._freeCamera;
    this.updateMainCameraTargetHelper();
  }

  /**
   * Gets the a unique file name for a camera.
   * @param {string} path
   * @param {string} fileName
   * @param {number} index
   * @return {Promise<string>}
   */
  async getNewCameraShotName(path: string, fileName, index: number): Promise<string> {
    let cameraShotFileName = fileName;
    if (index) {
      cameraShotFileName = cameraShotFileName + index;
    }
    const store = await this.userService.getUserStore();
    this.fileService.getFile(store.entityBasePath, store.entityName, FileType.JSON);

    let stringEntityConfig = await this.fileService.getFile(
      store.entityBasePath,
      store.entityName,
      FileType.JSON
    );

    let entityConfig: MVEntityConfig = JSON.parse(stringEntityConfig) as MVEntityConfig;

    // const cameraExists = entityConfig.cameraShots.find((url) => {
    //   return url.includes(cameraShotFileName + '.json');
    // });
    // if (!cameraExists) {
    return cameraShotFileName;
    // }
    return this.getNewCameraShotName(path, fileName, ++index);
  }

  public async createNewCameraShot(cameraShotId: string) {
    if (this._cameraShots[cameraShotId]) {
      this.notifier.notify('error', `Camera Shot ID already exists. Please use a different name.`);
      return;
    }

    this._cameraShots[cameraShotId] = {
      id: cameraShotId,
    };
    this._cameraShots$.next(this._cameraShots);

    let store = await this.userService.getUserStore();
    const entityConfig: MVEntityConfig = await this.getEntityConfig();
    entityConfig.cameraShots = this.cleanupCameraShotsForSaving(this._cameraShots);

    await this.fileService.updateFile(
      store.entityBasePath,
      store.entityName,
      FileType.JSON,
      JSON.stringify(entityConfig, null, 2)
    );

    this.notifier.notify('success', `New camera shot "${cameraShotId}" created`);
  }

  /**
   * Creates a new camera shot by displaying a file system promt to the user.
   * @return {Promise<void>}
   */
  public async createNewCameraShotJSON(): Promise<void> {
    const openDialogOptions: any = {
      nameFieldLabel: 'Enter here your camera shot file name',
    };

    const absoluteCameraShotPath = await (window as any).electronAPI.showSaveDialogSync(
      openDialogOptions
    );
    if (!absoluteCameraShotPath) {
      return;
    }
    const genericAbsoluteCameraShotPath = absoluteCameraShotPath.replace(/\\/g, '/'); // necessary for windows file system
    const lastSlashIndex = genericAbsoluteCameraShotPath.lastIndexOf('/');

    let fileName = genericAbsoluteCameraShotPath.slice(lastSlashIndex + 1).replace('.json', '');
    fileName = this.fileService.sanitizeFileName(fileName);
    const absoluteCameraShotDirectory = genericAbsoluteCameraShotPath.slice(0, lastSlashIndex + 1);
    const cameraShotFileName = await this.getNewCameraShotName(
      absoluteCameraShotDirectory,
      fileName,
      0
    );
    let basePath = this._baseUrl.replace('file://', '');
    basePath = basePath.replace(/\\/g, '/'); // necessary for windows file system
    if (!absoluteCameraShotDirectory.includes(basePath)) {
      this.notifier.notify('error', `New camera must be saved in your assets folder!`);
      return;
    }

    const defaultCameraShotData: MVCameraShotSettings = { ...this._defaultCameraShotData };

    let currentCamera: Camera;
    if (this._freeCameraActive) {
      const freeCamera = this._core.getScene().getCameraByID('freeCamera') as FreeCamera;
      currentCamera = freeCamera;
      const target = freeCamera.getTarget();
      target.toArray(defaultCameraShotData.target);
      defaultCameraShotData.behaviors[1].options.lowerRadiusLimit = 0;
      defaultCameraShotData.behaviors[1].options.upperRadiusLimit = 10;
    } else {
      const mainCamera: ArcRotateCamera = this._core
        .getScene()
        .getCameraByID('mainCamera') as ArcRotateCamera;
      mainCamera.target.toArray(defaultCameraShotData.target);
      currentCamera = mainCamera;
    }
    currentCamera.position.toArray(defaultCameraShotData.position);
    defaultCameraShotData.fov = currentCamera.fov * (360 / (2 * Math.PI));

    await this.fileService.addFile(
      absoluteCameraShotDirectory,
      cameraShotFileName,
      FileType.JSON,
      JSON.stringify(defaultCameraShotData, null, 2)
    );

    const store = await this.userService.getUserStore();

    const entityConfigString = await this.fileService.getFile(
      store.entityBasePath,
      store.entityName,
      FileType.JSON
    );
    const entityConfig = JSON.parse(entityConfigString) as MVEntityConfig;
    let relativeCameraShotUrl = absoluteCameraShotDirectory + cameraShotFileName + '.json';
    relativeCameraShotUrl = relativeCameraShotUrl.replace(
      store.entityBasePath.replace(/\\/g, '/'),
      ''
    );

    // await this.fileService.updateFile(
    //   store.entityBasePath,
    //   store.entityName,
    //   FileType.JSON,
    //   JSON.stringify(entityConfig, null, 2)
    // );

    // await this.updateCamera();

    // this.requestCameraShot(cameraShotFileName, false);
    // TODO
    // this.activateCameraShot(cameraShotFileName, false)

    this.notifier.notify('success', `New camera "${cameraShotFileName}" created`);
  }

  public async changeCameraShotJSON(cameraShotId: string, isMobile: boolean) {
    const previousCameraShotMetaData = { ...this.getActiveCameraShot() };

    const cameraShotMetaData = this._cameraShots[cameraShotId];

    const title: string = `Select ${isMobile ? 'mobile ' : ''}camera JSON`;

    const openDialogOptions: any = {
      title: title,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    };

    const absoluteCameraShotPaths: string[] = await (window as any).electronAPI.showOpenDialogSync(
      openDialogOptions
    );
    if (!absoluteCameraShotPaths || absoluteCameraShotPaths.length == 0) {
      return;
    }

    const absoluteCameraShotPath: string = absoluteCameraShotPaths[0].replace(/\\/g, '/'); // necessary for windows
    const baseUrl = this._baseUrl.replace('file://', '');

    if (!absoluteCameraShotPath.includes(baseUrl)) {
      this.notifier.notify('error', `Camera JSON file must within the project directory.`);
      return;
    }

    const relativeCameraShotPath: string = absoluteCameraShotPath.replace(baseUrl, '');

    if (isMobile) {
      cameraShotMetaData['mobileUrlRelative'] = relativeCameraShotPath;
    } else {
      cameraShotMetaData['urlRelative'] = relativeCameraShotPath;
    }

    this._cameraShots$.next(this._cameraShots);

    let store = await this.userService.getUserStore();
    const entityConfig: MVEntityConfig = await this.getEntityConfig();
    entityConfig.cameraShots = this.cleanupCameraShotsForSaving(this._cameraShots);

    await this.fileService.updateFile(
      store.entityBasePath,
      store.entityName,
      FileType.JSON,
      JSON.stringify(entityConfig, null, 2)
    );

    await this.reloadCameraShots(this._cameraShots);
    await this.requestCameraShot(
      previousCameraShotMetaData.id,
      previousCameraShotMetaData.mobileActiveInEditor
    );

    this.notifier.notify('success', `${isMobile ? 'Mobile camera' : 'Camera'} JSON updated`);
  }

  /**
   * Deletes a camera shot by id.
   * @param {string} id Camera shot id
   */
  public async deleteCameraShot(id: string, deleteReferencedCameras?: boolean): Promise<void> {
    let store = await this.userService.getUserStore();
    let entityConfig = await this.getEntityConfig();

    delete this._cameraShots[id];
    delete entityConfig.cameraShots[id];
    this._cameraShots$.next(this._cameraShots);

    await this.fileService.updateFile(
      store.entityBasePath,
      store.entityName,
      FileType.JSON,
      JSON.stringify(entityConfig, null, 2)
    );
    this.notifier.notify('success', `Camera deleted`);

    if (deleteReferencedCameras) {
      // TODO
      // const cameraPath = this._cameraShotUrlsRelative[cameraShotIndex];
      // let completeCameraShotUrl = basePath + cameraPath;
      // await this.fileService.removeFile(completeCameraShotUrl);
    }

    await this.reloadCameraShots(this._cameraShots);
    await this.requestDefaultCameraShot();
  }

  /**
   * Animates a camera shot by id.
   * @param {string} id Camera shot id
   */
  public async openAddCameraAnimationDialog(id: string, isMobile?: boolean): Promise<void> {
    // TODO
    const openDialogOptions: any = {
      nameFieldLabel: 'Choose your camera animation .glb file',
      filters: [{ name: 'Cameras', extensions: ['glb'] }],
    };

    let absoluteCameraAnimationFileUrlArray = await (window as any).electronAPI.showOpenDialogSync(
      openDialogOptions
    );
    if (!absoluteCameraAnimationFileUrlArray) {
      return;
    }

    if (absoluteCameraAnimationFileUrlArray) {
      let basePath = this._baseUrl.replace('file://', '');
      basePath = basePath.replace(/\\/g, '/'); // necessary for windows file system
      let animationFileToLoadUrl: string = absoluteCameraAnimationFileUrlArray[0];
      animationFileToLoadUrl = animationFileToLoadUrl.replace(/\\/g, '/'); // necessary for windows file system

      if (!animationFileToLoadUrl.includes(basePath)) {
        this.notifier.notify('error', `Camera .glb file must be placed in your assets folder!`);
        return;
      }

      animationFileToLoadUrl = animationFileToLoadUrl.replace(basePath, '');

      const cameraShotMetaData: MVCameraShotMetaData = this._cameraShots[id];
      const cameraShotUrl = isMobile
        ? cameraShotMetaData.mobileUrlRelative
        : cameraShotMetaData.urlRelative;

      const newPath = this._baseUrl.replace('file://', '');
      const activeCameraShotSettingsString = await this.fileService.getFile(
        newPath,
        cameraShotUrl.replace('.json', ''),
        FileType.JSON
      );

      const activeCameraShotSettings = JSON.parse(
        activeCameraShotSettingsString
      ) as MVCameraShotSettings;

      activeCameraShotSettings.animationFile = animationFileToLoadUrl;

      activeCameraShotSettings.fovKeyFrames = null;
      activeCameraShotSettings.behaviors = [];

      await this.fileService.updateFile(
        newPath,
        cameraShotUrl.replace('.json', ''),
        FileType.JSON,
        JSON.stringify(activeCameraShotSettings, null, 2)
      );

      this.notifier.notify('success', `Camera successfully linked to .glb file`);

      await this.reloadCameraShots(this._cameraShots);
      this.requestCameraShot(cameraShotMetaData.id, isMobile);
    }
  }

  public async deleteAnimation(id: string) {
    // TODO
    this.notifier.notify('error', `This function is not yet implemented....`);
  }

  public async getEntityConfig(): Promise<MVEntityConfig> {
    let store = await this.userService.getUserStore();
    let entityConfigString = await this.fileService.getFile(
      store.entityBasePath,
      store.entityName,
      FileType.JSON
    );
    let entityConfig = JSON.parse(entityConfigString) as MVEntityConfig;
    return entityConfig;
  }

  /**
   * Updates the camera shot id
   * @param {string} oldCameraShotId
   * @param {string} newCameraShotId
   */
  public async updateCameraShotId(oldCameraShotId: string, newCameraShotId: string): Promise<void> {
    if (!newCameraShotId || newCameraShotId.length == 0) return;

    // TODO
    const basePath = this._baseUrl.replace('file://', '');
    const cameraShotIndex = Object.values(this._cameraShots).findIndex(
      (cameraShot) => cameraShot.id == oldCameraShotId
    );
    // const cameraPath = this._cameraShotUrlsRelative[cameraShotIndex];
    // const renamePath = basePath + cameraPath.replace(oldCameraShotId + '.json', '');
    // const entityBasePath = cameraPath.replace(oldCameraShotId + '.json', '');

    // let newCameraShotName = await this.getNewCameraShotName(renamePath, newCameraShotId, 0);
    // newCameraShotName = this.fileService.sanitizeFileName(newCameraShotName);
    if (newCameraShotId == '') {
      this.notifier.notify('error', `Please enter a valid name`);
      return;
    }

    // await this.fileService.renameFile(
    //   renamePath,
    //   oldCameraShotId.replace('.json', ''),
    //   FileType.JSON,
    //   newCameraShotName
    // );

    // let cameraConfigString = await this.fileService.getFile(
    //   basePath,
    //   newCameraShotName,
    //   FileType.JSON
    // );
    // let cameraConfig = JSON.parse(cameraConfigString) as MVEntityConfig;
    // cameraConfig.id = newCameraShotName;

    // await this.fileService.updateFile(
    //   basePath + entityBasePath,
    //   newCameraShotName,
    //   FileType.JSON,
    //   JSON.stringify(cameraConfig, null, 2)
    // );

    const entityConfig = await this.getEntityConfig();

    // entityConfig.cameraShotUrlsRelative.splice(cameraShotIndex, 1, entityBasePath + newCameraShotName + '.json');

    // this._cameraShotUrlsRelative = entityConfig.cameraShotUrlsRelative;

    const oldCameraShotValue = Object.values(this._cameraShots)[cameraShotIndex];
    oldCameraShotValue.id = newCameraShotId;

    const cameraShotEntries = Object.entries(this._cameraShots);

    cameraShotEntries.splice(cameraShotIndex, 1, [newCameraShotId, oldCameraShotValue]);
    this._cameraShots = cameraShotEntries.reduce((result, [key, value]) => {
      result[key] = { ...value };
      return result;
    }, {});

    this._cameraShots$.next(this._cameraShots);

    entityConfig.cameraShots = this.cleanupCameraShotsForSaving(this._cameraShots);

    let store = await this.userService.getUserStore();

    await this.fileService.updateFile(
      store.entityBasePath,
      store.entityName,
      FileType.JSON,
      JSON.stringify(entityConfig, null, 2)
    );

    await this.reloadCameraShots(this._cameraShots);

    this.notifier.notify('success', `Camera ${oldCameraShotId} renamed to ${newCameraShotId}`);
  }

  public async renameCameraShotJSON(
    relativeCameraShotUrl: string,
    newName: string,
    affectedEntityUrls: {
      url: string;
      entityConfig: MVEntityConfig;
    }[]
  ) {
    const cameraBasePath =
      (window as any).electronAPI.path().dirname(this._baseUrl + relativeCameraShotUrl) + '/';
    const relativeCameraBasePath =
      (window as any).electronAPI.path().dirname(relativeCameraShotUrl) + '/';
    const newRelativeCameraPath = relativeCameraBasePath + newName + '.json';
    const cameraFileName = (window as any).electronAPI
      .path()
      .basename(relativeCameraShotUrl)
      .replace('.json', '');

    await this.fileService.renameFile(
      cameraBasePath.replace('file://', ''),
      cameraFileName,
      FileType.JSON,
      newName
    );

    for (let affectedEntity of affectedEntityUrls) {
      let jsonString: any = await this.fileService.getFile(
        this._baseUrl.replace('file://', ''),
        affectedEntity.url.replace('.json', ''),
        FileType.JSON
      );

      jsonString = jsonString.replace(relativeCameraShotUrl, newRelativeCameraPath);

      await this.fileService.updateFile(
        this._baseUrl.replace('file://', ''),
        affectedEntity.url.replace('.json', ''),
        FileType.JSON,
        jsonString
      );
    }

    const entityConfig = await this.getEntityConfig();

    await this.reloadCameraShots(entityConfig.cameraShots);
  }

  cleanupCameraShotsForSaving(cameraShots: MVCameraShotsMetaData) {
    const cameraShotEntries = Object.entries(cameraShots);

    return [...cameraShotEntries].reduce((result, [key, value]) => {
      const valueCopy = { ...value };
      delete valueCopy.activeInEditor;
      delete valueCopy.mobileActiveInEditor;
      delete valueCopy.id;
      delete valueCopy.cameraShotSettings;
      delete valueCopy.cameraShotSettingsMobile;
      result[key] = valueCopy;
      return result;
    }, {});
  }

  private async reloadCameraShots(cameraShots: MVCameraShotsMetaData) {
    const previouslyActiveCameraShot = this.getActiveCameraShot();

    if (!cameraShots) return;

    this._cameraShots = await this.productionExportService.combineCameraShots(
      cameraShots,
      this._baseUrl
    );

    if (previouslyActiveCameraShot) {
      if (previouslyActiveCameraShot.mobileActiveInEditor) {
        this._cameraShots[previouslyActiveCameraShot.id]['mobileActiveInEditor'] = true;
      }
      if (previouslyActiveCameraShot.activeInEditor) {
        this._cameraShots[previouslyActiveCameraShot.id]['activeInEditor'] = true;
      }
    }

    await this._core.Camera.loadCameraShotsFromMetaData(this._cameraShots);
    this._cameraShots$.next(this._cameraShots);
  }

  public toggleMainCameraTargetHelper() {
    if (this.mainCameraTargetHelper?.visibility == 1) {
      this.mainCameraTargetHelper.visibility = 0;
      this.mainCameraTargetGizmoManager.positionGizmoEnabled = false;
      return;
    } else if (this.mainCameraTargetHelper?.visibility == 0) {
      this.mainCameraTargetHelper.visibility = 1;
      this.mainCameraTargetGizmoManager.positionGizmoEnabled = true;
      return;
    }
    const scene = this._core.getScene();
    this.mainCameraTargetHelper = MeshBuilder.CreateBox(
      'camera-target-helper',
      {
        size: 0.02,
      },
      scene
    );
    this.mainCameraTargetHelper.visibility;
    const camera = this._core.getScene().getCameraByID('mainCamera') as ArcRotateCamera;
    this.mainCameraTargetHelper.position = camera.target;

    const redMaterial = new PBRMaterial('RED', scene);
    redMaterial.metallic = 0;
    redMaterial.roughness = 1;
    redMaterial.albedoColor.r = 1;
    redMaterial.albedoColor.g = 0;
    redMaterial.albedoColor.b = 0;

    this.mainCameraTargetHelper.material = redMaterial;
    this.mainCameraTargetGizmoManager = window['gizmoManager'];
    this.mainCameraTargetGizmoManager.positionGizmoEnabled = true;

    this.mainCameraTargetGizmoManager.attachableMeshes = [this.mainCameraTargetHelper];
    this.mainCameraTargetGizmoManager.usePointerToAttachGizmos = false;
    this.mainCameraTargetGizmoManager.attachToMesh(this.mainCameraTargetHelper);

    this.mainCameraTargetGizmoManager.gizmos.positionGizmo.onDragStartObservable.add(() => {
      camera.target = this.mainCameraTargetHelper.position;
    });
  }

  public updateMainCameraTargetHelper() {
    if (this.mainCameraTargetHelper) {
      const camera = this._core.getScene().getCameraByID('mainCamera') as ArcRotateCamera;
      this.mainCameraTargetHelper.position = camera.target;
    }
  }
}
