import { Material, NodeMaterial, NullEngine, Scene, StandardMaterial } from 'babylonjs';
import { MVMaterial } from '../models/material';
import { JsonService } from './json.service';
import { MaterialService } from './material.service';

let materialConfigMock = {};
class JsonServiceMock extends JsonService {}

describe('Material Service', () => {
  let engine: NullEngine;
  let scene: Scene;
  let materialService: MaterialService;
  let loadMaterialConfigSpy;

  beforeAll(() => {
    engine = new NullEngine();
  });

  beforeEach(() => {
    scene = new Scene(engine);
    materialConfigMock = {};
    materialService = new MaterialService(scene, new JsonServiceMock());
  });

  afterEach(() => {
    scene.dispose();
  });

  it('Should create', () => {
    expect(materialService).toBeTruthy();
  });

  it('getMaterial', () => {
    let material = materialService.getMaterial('TEST-ID');
    expect(material).toBeUndefined();

    const m = new StandardMaterial('MATERIAL', scene);
    m.id = 'TEST-ID';

    material = materialService.getMaterial('TEST-ID');
    expect(material).toBeTruthy();
    expect(material.id).toBe('TEST-ID');
    expect(material.name).toBe('MATERIAL');
  });

  it('createMaterial - NodeMaterial', async () => {
    materialConfigMock = { customType: 'BABYLON.NodeMaterial' };
    loadMaterialConfigSpy = spyOn(JsonServiceMock.prototype, 'loadJson').and.returnValue(materialConfigMock as any);
    const mBaseUrl = 'MBASE',
      tBaseUrl = 'TBASE',
      url = 'URL';
    const spyNodeMaterialParse = spyOn(NodeMaterial, 'Parse').and.returnValue({ id: '', name: '' } as any);
    const material = await materialService.createMaterial(mBaseUrl, tBaseUrl, url);

    expect(spyNodeMaterialParse).toHaveBeenCalled();
    expect(material.name).toBe('URL');
    expect(material.id).toBe('URL');
    expect(material['isMVMaterial']).toBeTruthy();
  });

  it('createMaterial - MVMaterial', async () => {
    loadMaterialConfigSpy = spyOn(JsonServiceMock.prototype, 'loadJson').and.returnValue(materialConfigMock as any);
    spyOn(MVMaterial, 'setInspectableCustomProperties');
    spyOn(MVMaterial.prototype, 'parseMaterialFromConfig').and.returnValue(Promise.resolve());
    const mBaseUrl = 'MBASE',
      tBaseUrl = 'TBASE',
      url = 'URL';

    const material = await materialService.createMaterial(mBaseUrl, tBaseUrl, url);
    expect(material.name).toBe('URL');
    expect(material.id).toBe('URL');
    expect((material as MVMaterial).isMVMaterial).toBeTruthy();
  });

  it('deleteMaterial', () => {
    materialService.deleteMaterial('TEST-ID');

    const m = new StandardMaterial('MATERIAL', scene);
    m.id = 'TEST-ID';

    expect(scene.materials.length).toBe(1);
    expect(scene.materials.find((mat: Material) => mat.id === 'TEST-ID')).toBeDefined();
    materialService.deleteMaterial('TEST-ID');
    expect(scene.materials.length).toBe(0);
    expect(scene.materials.find((mat: Material) => mat.id === 'TEST-ID')).toBeUndefined();
  });
});
