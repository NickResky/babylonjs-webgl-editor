import { AbstractMesh, Mesh, NullEngine, Scene, Vector3 } from 'babylonjs';
import { AssetLoaderService } from './asset-loader.service';
import { MeshService } from './mesh.service';

class AssetLoaderServiceMock extends AssetLoaderService {}

describe('Mesh Service', () => {
  let engine: NullEngine;
  let scene: Scene;
  let meshService: MeshService;
  let assetLoaderMock: AssetLoaderServiceMock;

  beforeAll(() => {
    engine = new NullEngine();
  });

  beforeEach(() => {
    scene = new Scene(engine);
    assetLoaderMock = new AssetLoaderServiceMock();
    meshService = new MeshService(scene, assetLoaderMock);
  });

  afterEach(() => {
    scene.dispose();
  });

  it('Should create', () => {
    expect(meshService).toBeTruthy();
  });

  it('loadMeshes', () => {
    const spyLoadMeshes = spyOn(assetLoaderMock, 'loadMeshes');
    meshService.loadMeshes('URL', 'FILE-NAME');
    expect(spyLoadMeshes).toHaveBeenCalledWith('URL', 'FILE-NAME');
  });

  it('removeMesh', (done: DoneFn) => {
    const mesh = new AbstractMesh('TestMesh', scene);
    meshService.removeMesh(mesh).then(() => {
      expect(mesh.isDisposed()).toBeTrue();
      done();
    });
  });

  it('removeMeshes', (done: DoneFn) => {
    const spyRemoveMesh = spyOn(meshService, 'removeMesh');
    const meshes = [new AbstractMesh('TestMesh1', scene), new AbstractMesh('TestMesh2', scene)];
    meshService.removeMeshes(meshes).then(() => {
      expect(spyRemoveMesh).toHaveBeenCalledWith(meshes[0]);
      expect(spyRemoveMesh).toHaveBeenCalledWith(meshes[1]);
      done();
    });
  });

  it('addMesh', () => {
    const mesh = new AbstractMesh('TestMesh');
    expect(scene.meshes.length).toBe(1);

    meshService.addMesh(mesh);
    expect(scene.meshes.length).toBe(2);
    expect(scene.meshes[1]).toEqual(mesh);
  });

  it('addMeshes', () => {
    const meshes = [new AbstractMesh('TestMesh1', scene), new AbstractMesh('TestMesh2', scene)];
    const spyAddMesh = spyOn(meshService, 'addMesh');

    meshService.addMeshes(meshes);
    expect(spyAddMesh).toHaveBeenCalledTimes(2);
    expect(spyAddMesh).toHaveBeenCalledWith(meshes[0]);
    expect(spyAddMesh).toHaveBeenCalledWith(meshes[1]);
  });

  it('createPlane', () => {
    const plane = meshService.createPlane('name1', 5, Vector3.Zero(), true);
    expect(plane.name).toBe('name1');
    expect(plane.position).toEqual(Vector3.Zero());
    expect(plane.visibility).toBeTruthy();
    expect(plane.billboardMode).toBe(Mesh.BILLBOARDMODE_ALL);
  });

  it('createSphere', () => {
    const sphere = meshService.createSphere('name2', 5, Vector3.Zero(), true);
    expect(sphere.name).toBe('name2');
    expect(sphere.position).toEqual(Vector3.Zero());
    expect(sphere.visibility).toBeTruthy();
  });
});
