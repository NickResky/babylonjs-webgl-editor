import { NullEngine, Scene, Vector3, AbstractMesh } from 'babylonjs';
import { CameraService } from './camera.service';
import { EntityService } from './entity.service';
import { MVCameraShot, MVCameraShotSettings, MVCamera } from '../models/camera';
import { MVSceneOptimizerService } from './mv-scene-optimizer.service';

class EntityServiceMock extends EntityService {}
class SceneOptimizerMock extends MVSceneOptimizerService {}

describe('Camera Service', () => {
  let engine: NullEngine;
  let scene: Scene;
  let canvas;
  let cameraShotSettings: MVCameraShotSettings;
  let cameraService: CameraService;
  let entityServiceMock: EntityServiceMock;
  let sceneOptimizerMock: SceneOptimizerMock;

  beforeAll(() => {
    engine = new NullEngine();
    canvas = document.createElement('canvas');
  });

  beforeEach(() => {
    scene = new Scene(engine);
    cameraShotSettings = { category: 'testCategory', target: [0, 0, 0], position: [1, 1, 1], fov: 35, behaviors: [] };
    entityServiceMock = new EntityServiceMock(scene, null, null, null, null, null, null, null, null);
    sceneOptimizerMock = new SceneOptimizerMock(scene, null);
    cameraService = new CameraService(scene, canvas, entityServiceMock, sceneOptimizerMock);
  });

  afterEach(() => {
    scene.dispose();
  });

  it('Should create', () => {
    expect(cameraService).toBeTruthy();
  });

  it('Should get a camera shot by id', () => {
    const c = new MVCameraShot(cameraShotSettings, 'TEST-ID');
    (cameraService as any)._cameraShots = new Map();
    (cameraService as any)._cameraShots.set('TEST-ID', c);
    let cameraShot = cameraService.getCameraShot('TEST-ID');
    expect(cameraShot).toBeTruthy();
    expect(cameraShot.id).toBe('TEST-ID');
  });

  it('Should get active camera shot', () => {
    const c1 = new MVCameraShot(cameraShotSettings, 'TEST-ID');
    const c2 = new MVCameraShot(cameraShotSettings, 'TEST-ID-ACTIVE');
    (c2 as any)._active = true;
    (cameraService as any)._cameraShots = new Map();
    (cameraService as any)._cameraShots.set('TEST-ID', c1);
    (cameraService as any)._cameraShots.set('TEST-ID-ACTIVE', c2);
    let activeCameraShot = cameraService.getActiveCameraShot();
    expect(activeCameraShot).toBeTruthy();
    expect(activeCameraShot).toBe(c2);
  });

  it('Should return all ids of camera shots', () => {
    const c1 = new MVCameraShot(cameraShotSettings, 'TEST-ID');
    const c2 = new MVCameraShot(cameraShotSettings, 'TEST-ID01');
    const c3 = new MVCameraShot(cameraShotSettings, 'TEST-ID02');
    (cameraService as any)._cameraShots = new Map();
    (cameraService as any)._cameraShots.set('TEST-ID', c1);
    (cameraService as any)._cameraShots.set('TEST-ID01', c2);
    (cameraService as any)._cameraShots.set('TEST-ID02', c3);
    let allCameraShotIds = cameraService.getAllCameraShotsIds();
    expect(allCameraShotIds).toBeTruthy();
    expect(allCameraShotIds).toEqual(['TEST-ID', 'TEST-ID01', 'TEST-ID02']);
  });

  it('Should get active camera', () => {
    const c = new MVCamera('mainCamera', Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), scene, true);

    let activeCamera = cameraService.getActiveCamera();

    expect(activeCamera).toBeTruthy();
    expect(activeCamera.id).toEqual(c.id);
  });

  it('Should setup the default camera', () => {
    const c = new MVCamera('mainCamera', Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), scene);
    c.attachControl(canvas, true);
    c.useAutoRotationBehavior = false;
    c.panningSensibility = 0;
    c.minZ = 0.01;
    c.wheelPrecision = 100;
    c.speed = 1;
    c.useNaturalPinchZoom = true;

    let defaultCamera = cameraService.setupDefaultCamera();

    expect(defaultCamera).toBeTruthy();
    expect(defaultCamera.id).toBe(c.id);
    expect(defaultCamera.useAutoRotationBehavior).toBe(c.useAutoRotationBehavior);
    expect(defaultCamera.attachControl).toBe(c.attachControl);
    expect(defaultCamera.panningSensibility).toBe(c.panningSensibility);
    expect(defaultCamera.minZ).toBe(c.minZ);
    expect(defaultCamera.wheelPrecision).toBe(c.wheelPrecision);
    expect(defaultCamera.speed).toBe(c.speed);
    expect(defaultCamera.useNaturalPinchZoom).toBe(c.useNaturalPinchZoom);
  });

  it('Should add camera to render pipeline', () => {
    const renderPipeline = { addCamera: () => {}, prepare: () => {} };

    const renderPipeSpy = spyOn(SceneOptimizerMock.prototype, 'getRenderPipeline').and.returnValue(
      renderPipeline as any,
    );
    const renderPipeSpyAddCamera = spyOn(renderPipeline, 'addCamera');
    const renderPipeSpyPrepare = spyOn(renderPipeline, 'prepare');

    cameraService.addCameraToRenderPipeline();

    expect(renderPipeSpyAddCamera).toHaveBeenCalled();
    expect(renderPipeSpyPrepare).toHaveBeenCalled();
  });

  it('Should updateMeshesToBeHiddenOnCameraIntersection', () => {
    const m = new AbstractMesh('hiddenMesh', scene);
    m['hideOnCameraIntersect'] = true;
    const m2 = new AbstractMesh('Mesh', scene);

    cameraService.updateMeshesToBeHiddenOnCameraIntersection();
    expect((cameraService as any)._meshesToBeHiddenOnCameraIntersection.length).toBe(1);
  });

  it('Should get all camera shots', () => {
    const c1 = new MVCameraShot(cameraShotSettings, 'TEST-ID');
    const c2 = new MVCameraShot(cameraShotSettings, 'TEST-ID01');
    const c3 = new MVCameraShot(cameraShotSettings, 'TEST-ID02');

    (cameraService as any)._cameraShots = new Map<string, MVCameraShot>();

    (cameraService as any)._cameraShots.set('TEST-ID', c1);
    (cameraService as any)._cameraShots.set('TEST-ID01', c2);
    (cameraService as any)._cameraShots.set('TEST-ID02', c3);

    let allCameraShots = cameraService.getAllCameraShots();

    expect(allCameraShots).toBeTruthy();
    expect(allCameraShots.size).toBe(3);
  });
});
