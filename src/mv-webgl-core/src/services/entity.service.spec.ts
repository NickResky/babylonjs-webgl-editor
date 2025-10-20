import {
  NullEngine,
  Scene,
  AnimationGroup,
  AbstractMesh,
  PointLight,
  Vector3,
  BoundingInfo,
  BaseTexture,
} from 'babylonjs';
import { MVAnimation } from '../models/animation/MVAnimation';
import { MVRuleEngineTypes } from '../models/configuration/configuration-interface';
import { MVEntity } from '../models/entity/mv-entity';
import { MVEnvironmentEntity } from '../models/entity/mv-environment-entity';
import { MVProductEntity } from '../models/entity/mv-product-entity';
import { MVMaterial } from '../models/material';
import { MVMaterialMapping } from '../models/material/mv-material-mapping';
import { AssetLoaderService } from './asset-loader.service';
import { ConfigurationService } from './configuration.service';
import { EntityService } from './entity.service';
import { JsonService } from './json.service';
import { LightService } from './light.service';
import { MaterialService } from './material.service';
import { MeshService } from './mesh.service';
import { SceneSettingsService } from './scene-settings.service';
import { CoreSettings, CoreSettingsObject } from '../settings';

/* Mock classes */

class ConfigurationServiceMock extends ConfigurationService {}

class MeshServiceMock extends MeshService {}

class JsonServiceMock extends JsonService {
  constructor() {
    super({ assetsBaseUrl: 'TEST-URL' } as any);
  }
}

class AssetLoaderServiceMock extends AssetLoaderService {}

class LightServiceMock extends LightService {}

class MaterialServiceMock extends MaterialService {}

class SceneSettingsServiceMock extends SceneSettingsService {}

class CoreSettingsMock extends CoreSettings {
  constructor() {
    super({
      assetsBaseUrl: '/',
    });
  }
}

describe('Entity Service', () => {
  let engine: NullEngine;
  let scene: Scene;
  let entityService: EntityService;
  let configurationServiceMock: ConfigurationServiceMock;
  let meshServiceMock: MeshServiceMock;
  let jsonServiceMock: JsonServiceMock;
  let assetLoaderServiceMock: AssetLoaderServiceMock;
  let lightServiceMock: LightServiceMock;
  let materialServiceMock: MaterialServiceMock;
  let sceneSettingsService: SceneSettingsServiceMock;
  let coreSettingsMock: CoreSettingsMock;

  beforeAll(() => {
    engine = new NullEngine();
  });

  beforeEach(() => {
    scene = new Scene(engine);
    configurationServiceMock = new ConfigurationServiceMock(null);
    meshServiceMock = new MeshServiceMock(null, null);
    jsonServiceMock = new JsonServiceMock();
    assetLoaderServiceMock = new AssetLoaderServiceMock();
    lightServiceMock = new LightServiceMock(null);
    materialServiceMock = new MaterialServiceMock(null, null);
    sceneSettingsService = new SceneSettingsServiceMock(null, null, null);

    coreSettingsMock = new CoreSettingsMock();

    entityService = new EntityService(
      scene,
      configurationServiceMock,
      meshServiceMock,
      jsonServiceMock,
      assetLoaderServiceMock,
      lightServiceMock,
      materialServiceMock,
      sceneSettingsService,
      coreSettingsMock,
    );
    console.log('test');
  });

  afterEach(() => {
    scene.dispose();
  });

  it('Should create', () => {
    expect(entityService).toBeTruthy();
  });

  it('setupAnimations - Not create animations', async () => {
    const spyAssetLoader = spyOn(assetLoaderServiceMock, 'loadAnimationGroups');
    const testEntity = { entityConfig: {}, addAnimation: () => {} };
    const spyEntity = spyOn(testEntity, 'addAnimation');
    await entityService.setupAnimations(testEntity as any);

    expect(spyAssetLoader).not.toHaveBeenCalled();
    expect(spyEntity).not.toHaveBeenCalled();
  });

  it('setupAnimations', async (done: DoneFn) => {
    const testEntity = {
      entityConfig: {
        animationsUrlRelative: 'PATH',
        animations: ['ANIMATION-ONE'],
      },
      addAnimation: (animation: MVAnimation) => {
        expect(animation.id).toBe('TESTGROUP');
        expect((animation as any).animationGroup.loopAnimation).toBeFalsy();
        done();
      },
    };

    const spyAssetLoader = spyOn(assetLoaderServiceMock, 'loadAnimationGroups').and.returnValue(
      Promise.resolve([new AnimationGroup('TESTGROUP|ONE', scene)]),
    );
    const spyEntity = spyOn(testEntity, 'addAnimation').and.callThrough();

    await entityService.setupAnimations(testEntity as any);

    expect(spyAssetLoader).toHaveBeenCalled();
    expect(spyEntity).toHaveBeenCalled();
  });

  it('loadRig - without rig', async () => {
    const testEntity = { entityConfig: {}, rootNode: null, rig: null };

    await entityService.loadRig(testEntity as any);

    expect(testEntity.rootNode).not.toBeNull();
    expect(testEntity.rig).not.toBeNull();
    expect(testEntity.rootNode.getClassName()).toBe('AbstractMesh');
    expect(testEntity.rig.length).toBe(1);
  });

  it('loadRig - with rig', async () => {
    const testEntity = {
      uuid: 'TESTUUID',
      entityConfig: {
        entityConfigBaseUrl: 'BASE-URL',
        rigUrlRelative: 'URL',
      },
      rootNode: null,
      rig: null,
    };
    const mesh = new AbstractMesh('MESHNAME', scene);
    mesh.id = '__root__';
    const loadMeshSpy = spyOn(assetLoaderServiceMock, 'loadMeshes').and.returnValue(Promise.resolve([mesh]));

    await entityService.loadRig(testEntity as any);

    expect(loadMeshSpy).toHaveBeenCalledWith(
      testEntity.entityConfig.entityConfigBaseUrl,
      testEntity.entityConfig.rigUrlRelative,
    );
    expect(testEntity.rootNode).not.toBeNull();
    expect(testEntity.rig).not.toBeNull();
    expect(testEntity.rootNode.id).toBe(testEntity.uuid);
    expect(testEntity.rootNode.name).toBe(testEntity.uuid);
    expect(testEntity.rootNode.getClassName()).toBe('AbstractMesh');
    expect(testEntity.rig.length).toBe(1);
    expect(mesh.name).toBe(testEntity.uuid);
  });

  it('loadConfigs - throw error', async () => {
    const testEntity = {
      name: 'TEST-ENTITY',
      entityConfig: {
        ruleEngineType: MVRuleEngineTypes.JSON,
      },
    };

    let errorMessage = '';
    try {
      await entityService.loadConfigs(testEntity as any);
    } catch (e) {
      errorMessage = e.message;
    }
    expect(errorMessage).toBe(
      '[FATAL ERROR] InvalidConfigurationError. (No entityConfigUrlRelative defined for TEST-ENTITY)',
    );
  });

  it('loadConfigs - ruleEngineJson', async () => {
    const testEntity = {
      entityConfig: {
        entityConfigBaseUrl: 'URL',
        ruleEngineType: MVRuleEngineTypes.JSON,
        ruleEngineConfigUrlRelative: 'PATH',
      },
      ruleEngineJson: '',
    };
    const spyLoadJson = spyOn(jsonServiceMock, 'loadJson').and.returnValue('TEST' as any);

    let errorMessage = '';
    try {
      await entityService.loadConfigs(testEntity as any);
    } catch (e) {
      errorMessage = e.message;
    }
    expect(errorMessage).toBe('');
    expect(testEntity.ruleEngineJson).toBe('TEST');
    expect(spyLoadJson).toHaveBeenCalledWith(
      `${testEntity.entityConfig.entityConfigBaseUrl}${testEntity.entityConfig.ruleEngineConfigUrlRelative}`,
    );
  });

  it('loadConfigs - meshSettings', async () => {
    const testEntity = {
      entityConfig: {
        meshSettingsRelative: 'PATH',
        entityConfigBaseUrl: 'URL',
      },
      meshSettingsJson: '',
    };
    const spyLoadJson = spyOn(jsonServiceMock, 'loadJson').and.returnValue('TEST' as any);

    let errorMessage = '';
    try {
      await entityService.loadConfigs(testEntity as any);
    } catch (e) {
      errorMessage = e.message;
    }
    expect(errorMessage).toBe('');
    expect(testEntity.meshSettingsJson).toBe('TEST');
    expect(spyLoadJson).toHaveBeenCalledWith(
      `${testEntity.entityConfig.entityConfigBaseUrl}${testEntity.entityConfig.meshSettingsRelative}`,
    );
  });

  it('loadConfigs - lightmapTextures', async () => {
    const testEntity = {
      entityConfig: {
        lightmapTexturesUrlRelative: 'PATH',
        entityConfigBaseUrl: 'URL',
      },
      lightmapArrayJSON: '',
    };
    const spyLoadJson = spyOn(jsonServiceMock, 'loadJson').and.returnValue({ files: 'TEST' } as any);

    let errorMessage = '';
    try {
      await entityService.loadConfigs(testEntity as any);
    } catch (e) {
      errorMessage = e.message;
    }
    expect(errorMessage).toBe('');
    expect(testEntity.lightmapArrayJSON).toBe('TEST');
    expect(spyLoadJson).toHaveBeenCalledWith(
      `${testEntity.entityConfig.entityConfigBaseUrl}${testEntity.entityConfig.lightmapTexturesUrlRelative}registry.json`,
    );
  });

  it('loadConfigs - materialMappings', async () => {
    const testEntity = {
      entityConfig: {
        materialMappingsUrlRelative: 'PATH',
        entityConfigBaseUrl: 'URL',
      },
      materialMappingsJson: '',
    };
    const spyLoadJson = spyOn(jsonServiceMock, 'loadJson').and.returnValue('TEST' as any);

    let errorMessage = '';
    try {
      await entityService.loadConfigs(testEntity as any);
    } catch (e) {
      errorMessage = e.message;
    }
    expect(errorMessage).toBe('');
    expect(testEntity.materialMappingsJson).toBe('TEST');
    expect(spyLoadJson).toHaveBeenCalledWith(
      `${testEntity.entityConfig.entityConfigBaseUrl}${testEntity.entityConfig.materialMappingsUrlRelative}`,
    );
  });

  it('loadConfigs', async () => {
    const testEntity = {
      entityConfig: {
        materialMappingsUrlRelative: 'PATH',
        ruleEngineConfigUrlRelative: 'PATH2',
        meshSettingsRelative: 'PATH3',
        lightmapTexturesUrlRelative: 'PATH4',
        entityConfigBaseUrl: 'URL',
        ruleEngineType: MVRuleEngineTypes.JSON,
      },
      materialMappingsJson: '',
      ruleEngineJson: '',
      meshSettingsJson: '',
      lightmapArrayJSON: '',
    };
    const spyLoadJson = spyOn(jsonServiceMock, 'loadJson').and.returnValue('TEST' as any);

    let errorMessage = '';
    try {
      await entityService.loadConfigs(testEntity as any);
    } catch (e) {
      errorMessage = e.message;
    }
    expect(errorMessage).toBe('');
    expect(spyLoadJson).toHaveBeenCalledTimes(4);
  });

  it('applyLayerConfiguration', async () => {
    const spyApplyMeshesToLayer = spyOn(entityService as any, 'applyMeshesToLayer').and.returnValues(
      Promise.resolve(1),
      Promise.resolve(2),
      Promise.resolve(false),
    );

    const testEntity = {
      layers: [1, 2, false],
    };

    const data = await entityService.applyLayerConfiguration(testEntity as any);

    expect(spyApplyMeshesToLayer).toHaveBeenCalledTimes(3);
    expect(data.length).toBe(2);
  });

  it('applyMeshesToLayer - null', async () => {
    const spyLoadMeshes = spyOn(entityService as any, 'loadMeshes').and.returnValue(Promise.resolve());

    const testEntity = {};
    const testLayer = {
      previousVisibilityState: true,
      visibilityState: true,
    };

    const data = await (entityService as any).applyMeshesToLayer(testEntity as any, testLayer as any);

    expect(spyLoadMeshes).not.toHaveBeenCalled();
    expect(data).toBeNull();
  });

  it('applyMeshesToLayer', async () => {
    const spyLoadMeshes = spyOn(entityService as any, 'loadMeshes').and.returnValue(Promise.resolve());

    const testEntity = {};
    const testLayer = {
      previousVisibilityState: false,
      visibilityState: true,
      layerPaths: [1, 2],
    };

    const data = await (entityService as any).applyMeshesToLayer(testEntity as any, testLayer as any);

    expect(spyLoadMeshes).toHaveBeenCalledTimes(2);
    expect(data.previousVisibilityState).toBeTruthy();
    expect(data.visibilityState).toBeTruthy();
  });

  it('applyMeshesToLayer - non visible', async () => {
    const spyLoadMeshes = spyOn(entityService as any, 'loadMeshes').and.returnValue(Promise.resolve());

    const testEntity = {};
    const testLayer = {
      previousVisibilityState: true,
      visibilityState: false,
      layerPaths: [1, 2],
    };

    const data = await (entityService as any).applyMeshesToLayer(testEntity as any, testLayer as any);

    expect(spyLoadMeshes).not.toHaveBeenCalled();
    expect(data.previousVisibilityState).toBeFalsy();
    expect(data.visibilityState).toBeFalsy();
  });

  it('loadMeshes - no meshes loaded', async () => {
    const spyLoadMeshes = spyOn(assetLoaderServiceMock, 'loadMeshes').and.returnValue(Promise.reject());
    const spyConsole = spyOn(console, 'error');

    const testEntity = {
      entityConfig: {
        entityConfigBaseUrl: 'URL',
        meshesUrlRelative: 'URL',
      },
    };
    const testLayer = {
      previousVisibilityState: true,
      visibilityState: false,
      layerPaths: [1, 2],
    };

    await (entityService as any).loadMeshes(testEntity, 'LAYER-PATH', testLayer);
    expect(spyConsole).toHaveBeenCalledWith('[ERROR] Failed loading file URLURLLAYER-PATH');
  });

  it('loadMeshes - no meshes loaded 2', async () => {
    const spyLoadMeshes = spyOn(assetLoaderServiceMock, 'loadMeshes').and.returnValue(Promise.resolve([]));

    const testEntity = {
      entityConfig: {
        entityConfigBaseUrl: 'URL',
        meshesUrlRelative: 'URL',
      },
    };
    const testLayer = {
      previousVisibilityState: true,
      visibilityState: false,
      layerPaths: [1, 2],
    };

    const data = await (entityService as any).loadMeshes(testEntity, 'LAYER-PATH', testLayer);
    expect(spyLoadMeshes).toHaveBeenCalled();
    expect(data.length).toBe(0);
  });

  it('loadMeshes', async () => {
    const setParentSpy = spyOn(AbstractMesh.prototype, 'setParent');
    const meshOne = new AbstractMesh('meshOne', scene);
    const meshTwo = new AbstractMesh('meshTwo', scene);
    const spyLoadMeshes = spyOn(assetLoaderServiceMock, 'loadMeshes').and.returnValue(
      Promise.resolve([meshOne, meshTwo]),
    );

    const testEntity = {
      uuid: 'TESTUUD',
      entityConfig: {
        entityConfigBaseUrl: 'URL',
        meshesUrlRelative: 'URL',
      },
      rootNode: {
        id: 'Test',
      },
    };
    const testLayer = {
      previousVisibilityState: true,
      visibilityState: false,
      layerPaths: [1, 2],
      addMesh: mesh => {
        expect(['meshOne', 'meshTwo']).toContain(mesh.id);
      },
    };

    const data = await (entityService as any).loadMeshes(testEntity, 'LAYER-PATH_socket_Test.glb', testLayer);
    expect(spyLoadMeshes).toHaveBeenCalled();
    expect(setParentSpy).toHaveBeenCalledTimes(2);
    expect(data.length).toBe(2);
    expect(setParentSpy).toHaveBeenCalledWith(testEntity.rootNode as any);
  });

  it('getEntities', () => {
    (entityService as any)._entities = ['ONE'] as any;
    const entities = entityService.getEntities();
    expect(entities).toEqual(['ONE'] as any);
  });

  it('addProduct - allowMultiple true', () => {
    const config = {
      name: 'test',
      id: 'testID',
      entityConfigBaseUrl: 'URL',
      materialsUrlRelative: 'URL',
      texturesUrlRelative: 'URL',
      cwsId: 'testID',
      cwsResourceVersionId: 'versionId',
    };
    const entity = new MVProductEntity(config as any, '');
    (entityService as any)._entities = [entity];
    const data = entityService.addProduct(config as any, '', true);
    expect((entityService as any)._entities.length).toBe(2);
    expect((entityService as any)._entities[0]).toEqual(data);
  });

  it('addProduct - allowMultiple false', () => {
    const config = {
      name: 'test',
      id: 'uuid',
      entityConfigBaseUrl: 'URL',
      materialsUrlRelative: 'URL',
      texturesUrlRelative: 'URL',
      cwsId: 'testID',
      cwsResourceVersionId: 'versionId',
    };
    const entity = new MVProductEntity(config as any, 'uuid');
    entity.rootNode = { dispose: () => {} } as any;
    (entityService as any)._entities = [entity];
    const spyDispose = spyOn(entity.rootNode, 'dispose');

    const data = entityService.addProduct(config as any, '');
    expect((entityService as any)._entities.length).toBe(1);
    expect((entityService as any)._entities[0]).toEqual(data);
    expect(spyDispose).toHaveBeenCalled();
  });

  it('addEnvironment', () => {
    const config = {
      name: 'test',
      id: 'uuid',
      entityConfigBaseUrl: 'URL',
      materialsUrlRelative: 'URL',
      texturesUrlRelative: 'URL',
      cwsId: 'testID',
      cwsResourceVersionId: 'versionId',
    };
    const entity = new MVEnvironmentEntity(config as any, 'uuid');
    entity.rootNode = { dispose: () => {} } as any;
    (entityService as any)._entities = [entity];
    const spyDispose = spyOn(entity.rootNode, 'dispose');

    const data = entityService.addEnvironment(config as any, '');
    expect((entityService as any)._entities.length).toBe(1);
    expect((entityService as any)._entities[0]).toEqual(data);
    expect(spyDispose).toHaveBeenCalled();
  });

  it('getEntities', () => {
    (entityService as any)._entities = [{ uuid: '12A' }, { uuid: '23A' }] as any;
    const entity = entityService.getEntity('12A');
    expect(entity).toEqual({ uuid: '12A' } as any);
  });

  it('addRigToScene', () => {
    const entity = {
      rig: [1, 2, 3],
    };
    const spyScene = spyOn(scene, 'addMesh');

    entityService.addRigToScene(entity as any);
    expect(spyScene).toHaveBeenCalledTimes(3);
  });

  it('updateLayersInScene', async () => {
    const layers = [
      { visibilityState: true, meshes: 1 },
      { visibilityState: false, meshes: 2 },
    ];

    const spyAddMesh = spyOn(meshServiceMock, 'addMeshes');
    const spyRemoveMesh = spyOn(meshServiceMock, 'removeMeshes').and.returnValue(Promise.resolve([]));

    await entityService.updateLayersInScene(layers as any);
    expect(spyAddMesh).toHaveBeenCalledWith(1 as any);
    expect(spyRemoveMesh).toHaveBeenCalledWith(2 as any);
  });

  it('updateLightsAndSceneSettings - no entity', () => {
    const spyUpdateLights = spyOn(entityService, 'updateLights');
    const spyUpdateSceneSettings = spyOn(sceneSettingsService, 'updateSceneSettings');
    const config = {
      name: 'test',
      id: 'uuid',
      entityConfigBaseUrl: 'URL',
      materialsUrlRelative: 'URL',
      texturesUrlRelative: 'URL',
      cwsId: 'testID',
      cwsResourceVersionId: 'versionId',
    };
    const entity = new MVEnvironmentEntity(config as any, 'uuid');
    (entityService as any)._entities = [entity, entity];
    entityService.updateLightsAndSceneSettings('cameraCat');

    expect(spyUpdateLights).toHaveBeenCalledTimes(2);
    expect(spyUpdateSceneSettings).toHaveBeenCalledTimes(2);
    expect(spyUpdateLights).toHaveBeenCalledWith('cameraCat', entity);
  });

  it('updateLightsAndSceneSettings - no entity 2', () => {
    const spyUpdateLights = spyOn(entityService, 'updateLights');
    const spyUpdateSceneSettings = spyOn(sceneSettingsService, 'updateSceneSettings');
    const config = {
      name: 'test',
      id: 'uuid',
      entityConfigBaseUrl: 'URL',
      materialsUrlRelative: 'URL',
      texturesUrlRelative: 'URL',
      cwsId: 'testID',
      cwsResourceVersionId: 'versionId',
    };
    const entity = new MVEntity(config as any, 'uuid');
    (entityService as any)._entities = [entity, entity];
    entityService.updateLightsAndSceneSettings('cameraCat');

    expect(spyUpdateLights).toHaveBeenCalledTimes(2);
    expect(spyUpdateSceneSettings).toHaveBeenCalledTimes(0);
    expect(spyUpdateLights).toHaveBeenCalledWith('cameraCat', entity);
  });

  it('updateLightsAndSceneSettings - with entity', () => {
    const spyUpdateLights = spyOn(entityService, 'updateLights');
    const spyUpdateSceneSettings = spyOn(sceneSettingsService, 'updateSceneSettings');
    const config = {
      name: 'test',
      id: 'uuid',
      entityConfigBaseUrl: 'URL',
      materialsUrlRelative: 'URL',
      texturesUrlRelative: 'URL',
      cwsId: 'testID',
      cwsResourceVersionId: 'versionId',
    };
    const entity = new MVEntity(config as any, 'uuid');
    (entityService as any)._entities = [entity, entity];
    entityService.updateLightsAndSceneSettings('cameraCat', entity);

    expect(spyUpdateLights).toHaveBeenCalledTimes(1);
    expect(spyUpdateSceneSettings).toHaveBeenCalledTimes(0);
    expect(spyUpdateLights).toHaveBeenCalledWith('cameraCat', entity);
  });

  it('updateLights - no entity', async () => {
    const spyRemoveLight = spyOn(lightServiceMock, 'removeLight').and.returnValue(Promise.resolve());
    const spyParseLight = spyOn(lightServiceMock, 'parseLight');
    const config = {
      name: 'test',
      id: 'uuid',
      entityConfigBaseUrl: 'URL',
      materialsUrlRelative: 'URL',
      texturesUrlRelative: 'URL',
      cwsId: 'testID',
      cwsResourceVersionId: 'versionId',
      lights: [
        {
          uniqueId: 52,
          entityReference: 'test',
        },
      ],
    };
    const entity = new MVEntity(config as any, 'uuid');
    (entityService as any)._entities = [entity, entity];
    const light = new PointLight('test', Vector3.Zero(), scene);
    light['entityReference'] = 'uuid';

    await entityService.updateLights('cameraCat');

    expect(spyRemoveLight).toHaveBeenCalledTimes(2);
    expect(spyRemoveLight).toHaveBeenCalledWith(light);
  });

  it('updateLights - no entity 2', async () => {
    const spyRemoveLight = spyOn(lightServiceMock, 'removeLight').and.returnValue(Promise.resolve());
    const spyParseLight = spyOn(lightServiceMock, 'parseLight');
    const config = {
      name: 'test',
      id: 'uuid',
      entityConfigBaseUrl: 'URL',
      materialsUrlRelative: 'URL',
      texturesUrlRelative: 'URL',
      cwsId: 'testID',
      cwsResourceVersionId: 'versionId',
      lights: [
        {
          uniqueId: 52,
          entityReference: 'test',
        },
      ],
    };
    const entity = new MVEntity(config as any, 'uuid');
    (entityService as any)._entities = [entity, entity];
    const light = new PointLight('test', Vector3.Zero(), scene);
    light['entityReference'] = 'uuid2'; // other uuid

    await entityService.updateLights('cameraCat');

    expect(spyRemoveLight).toHaveBeenCalledTimes(0);
  });

  it('updateLights - entity', async () => {
    const spyRemoveLight = spyOn(lightServiceMock, 'removeLight').and.returnValue(Promise.resolve());
    const spyParseLight = spyOn(lightServiceMock, 'parseLight');
    const config = {
      name: 'test',
      id: 'uuid',
      uuid: 'uuid',
      entityConfigBaseUrl: 'URL',
      materialsUrlRelative: 'URL',
      texturesUrlRelative: 'URL',
      cwsId: 'testID',
      cwsResourceVersionId: 'versionId',
      lights: {
        cameraCat: [{ uuid: 'light' }],
      },
    };
    const entity = new MVEntity(config as any, 'uuid');
    const light = new PointLight('test', Vector3.Zero(), scene);
    light['entityReference'] = 'uuid';

    await entityService.updateLights('cameraCat', entity);

    expect(spyRemoveLight).toHaveBeenCalledTimes(1);
    expect(spyParseLight).toHaveBeenCalledTimes(1);
  });

  it('prepareMaterials', async () => {
    const spyPrepareMaterialsForLayer = spyOn(entityService, 'prepareMaterialsForLayer').and.returnValue(
      Promise.resolve(),
    );
    const entity = {
      layers: [
        { visibilityState: true },
        { visibilityState: true },
        { visibilityState: false },
        { visibilityState: true },
      ],
    };
    await entityService.prepareMaterials(entity as any);
    expect(spyPrepareMaterialsForLayer).toHaveBeenCalledTimes(3);
  });

  it('prepareMaterialsForLayer - not visible', async () => {
    const spyApplyMeshSettingsFromJson = spyOn(entityService as any, 'applyMeshSettingsFromJson');
    const entity = {};
    const layer = {
      visibilityState: false,
      meshes: [
        {
          id: 1,
        },
      ],
    };
    await entityService.prepareMaterialsForLayer(entity as any, layer as any);
    expect(spyApplyMeshSettingsFromJson).toHaveBeenCalledTimes(0);
  });

  it('prepareMaterialsForLayer - visible', async () => {
    const spyApplyMeshSettingsFromJson = spyOn(entityService as any, 'applyMeshSettingsFromJson');
    const spyProcessOriginalMaterial = spyOn(entityService as any, 'processOriginalMaterial');
    const entity = {
      uuid: '212',
    };
    const layer = {
      visibilityState: true,
      meshes: [
        {
          id: '1',
          material: 'mat',
        },
      ],
    };
    await entityService.prepareMaterialsForLayer(entity as any, layer as any);
    expect(spyApplyMeshSettingsFromJson).toHaveBeenCalledTimes(1);
    expect(spyProcessOriginalMaterial).toHaveBeenCalledTimes(1);
    expect(spyApplyMeshSettingsFromJson).toHaveBeenCalledWith(entity as any, layer.meshes[0] as any);
  });

  it('applyMeshSettingsFromJson', () => {
    const mesh = new AbstractMesh('applyMeshSettingsFromJson', scene);
    mesh.setBoundingInfo(new BoundingInfo(Vector3.Zero(), Vector3.Zero()));
    mesh.id = 'ID';
    const spyScale = spyOn(mesh._boundingInfo.boundingBox, 'scale');
    const entity = {
      meshSettingsJson: {
        meshes: [
          {
            id: 'ID',
            name: 'TEST-DATA',
            boundingBoxScale: 'BOUNDING-DATA',
            hideOnCameraIntersect: 'hideOnCameraIntersect-DATA',
          },
          { id: 'ID2' },
        ],
      },
    };

    (entityService as any).applyMeshSettingsFromJson(entity, mesh);

    expect(spyScale).toHaveBeenCalledWith('BOUNDING-DATA' as any);
    expect(mesh['hideOnCameraIntersect']).toBe('hideOnCameraIntersect-DATA');
    expect(mesh['name']).toBe('TEST-DATA');
  });

  it('processOriginalMaterial - no inspectableCustomProperties', async () => {
    const mesh = new AbstractMesh('TEST-MESH', scene);
    const material = new MVMaterial('TEST-MAT.json', 'MAT-ID', scene);
    mesh.material = material;
    mesh['originalMaterialName'] = 'originalMaterialName';
    mesh['layerName'] = 'layerName';

    const entity = {
      getMaterialMapping: (name: string) => {},
      addMaterialMapping: (mapping: any) => {},
    };
    const layer = {
      name: 'TEST-LAYER',
    };

    const sypGetMaterialMapping = spyOn(entity, 'getMaterialMapping').and.returnValue();
    const sypAddMaterialMapping = spyOn(entity, 'addMaterialMapping').and.returnValue();
    const spyAddMesh = spyOn(MVMaterialMapping.prototype, 'addMesh');

    await (entityService as any).processOriginalMaterial(entity, mesh, layer);

    const mapping = new MVMaterialMapping('TEST-MAT', null);
    expect(sypAddMaterialMapping).toHaveBeenCalledWith(mapping);
    expect(spyAddMesh).toHaveBeenCalledWith(mesh);
    expect(mesh.inspectableCustomProperties).toEqual([]);
  });

  it('processOriginalMaterial - inspectableCustomProperties', async () => {
    const mesh = new AbstractMesh('TEST-MESH', scene);
    const material = new MVMaterial('TEST-MAT.json', 'MAT-ID', scene);
    mesh.material = material;

    const entity = {
      getMaterialMapping: (name: string) => {},
      addMaterialMapping: (mapping: any) => {},
    };
    const layer = {
      name: 'TEST-LAYER',
    };

    const sypGetMaterialMapping = spyOn(entity, 'getMaterialMapping').and.returnValue();
    const sypAddMaterialMapping = spyOn(entity, 'addMaterialMapping').and.returnValue();
    const spyAddMesh = spyOn(MVMaterialMapping.prototype, 'addMesh');

    await (entityService as any).processOriginalMaterial(entity, mesh, layer);

    const mapping = new MVMaterialMapping('TEST-MAT', null);
    expect(sypAddMaterialMapping).toHaveBeenCalledWith(mapping);
    expect(spyAddMesh).toHaveBeenCalledWith(mesh);
    expect(mesh.inspectableCustomProperties.length).toBe(2);
  });

  it('processOriginalMaterial - lightmap', async () => {
    const mesh = new AbstractMesh('TEST-MESH', scene);
    const material = new MVMaterial('TEST-MAT', 'TEST-MAT', scene);
    mesh.material = material;

    const entity = {
      getMaterialMapping: (name: string) => {},
      addMaterialMapping: (mapping: any) => {},
      lightmapArrayJSON: ['TEST-LAYER.jpg'],
    };
    const layer = {
      name: 'TEST-LAYER',
    };

    const sypGetMaterialMapping = spyOn(entity, 'getMaterialMapping').and.returnValue();
    const sypAddMaterialMapping = spyOn(entity, 'addMaterialMapping').and.returnValue();
    const spyAddMesh = spyOn(MVMaterialMapping.prototype, 'addMesh');

    await (entityService as any).processOriginalMaterial(entity, mesh, layer);

    const mapping = new MVMaterialMapping('TEST-MAT', null);
    expect(sypAddMaterialMapping).toHaveBeenCalledWith(mapping);
    expect(spyAddMesh).toHaveBeenCalledWith(mesh);
    expect(mesh['lightMapFileName']).toBe('TEST-LAYER.jpg');
  });

  it('processOriginalMaterial - lightmap override', async () => {
    const mesh = new AbstractMesh('TEST-MESH', scene);
    mesh['fileName'] = 'test-file-name.glb';
    const material = new MVMaterial('TEST-MAT', 'TEST-MAT', scene);
    mesh.material = material;

    const entity = {
      getMaterialMapping: (name: string) => {},
      addMaterialMapping: (mapping: any) => {},
      lightmapArrayJSON: ['TEST-LAYER.jpg'],
      entityConfig: {
        lightmapOverwrites: {
          'test-file-name.glb': 'LIGHTMAP-OVERWRITE.jpg',
        },
      },
    };
    const layer = {
      name: 'TEST-LAYER',
    };

    const sypGetMaterialMapping = spyOn(entity, 'getMaterialMapping').and.returnValue();
    const sypAddMaterialMapping = spyOn(entity, 'addMaterialMapping').and.returnValue();
    const spyAddMesh = spyOn(MVMaterialMapping.prototype, 'addMesh');

    await (entityService as any).processOriginalMaterial(entity, mesh, layer);

    const mapping = new MVMaterialMapping('TEST-MAT', null);
    expect(sypAddMaterialMapping).toHaveBeenCalledWith(mapping);
    expect(spyAddMesh).toHaveBeenCalledWith(mesh);
    expect(mesh['lightMapFileName']).toBe('LIGHTMAP-OVERWRITE.jpg');
  });

  it('getTargetMaterial - no layer', async () => {
    const spyGetMaterial = spyOn(materialServiceMock, 'getMaterial').and.returnValue(
      new MVMaterial('TEST-MAT', '', scene),
    );
    const spyCreateMaterial = spyOn(materialServiceMock, 'createMaterial');
    const entity = {
      entityConfig: {
        entityConfigBaseUrl: 'BASE',
        lightmapTexturesUrlRelative: '',
      },
    };

    const data = await (entityService as any).getTargetMaterial(entity, 'materialMappingUrl');

    expect(data.name).toBe('TEST-MAT');
    expect(data.id).toBe('TEST-MAT');
    expect(data['isLightmapMaterial']).toBeFalsy();
    expect(spyGetMaterial).toHaveBeenCalledTimes(1);
    expect(spyCreateMaterial).not.toHaveBeenCalled();
  });

  it('getTargetMaterial', async () => {
    const material = new MVMaterial('TEST-MAT2', 'TEST', scene);
    material.lightmapTexture = new BaseTexture(scene);
    spyOn(material.lightmapTexture, 'getInternalTexture').and.returnValue({ url: 'BASETEXTURETEST-LAYER.json' } as any);
    const spyGetMaterial = spyOn(materialServiceMock, 'getMaterial').and.returnValue(material);
    const spyCreateMaterial = spyOn(materialServiceMock, 'createMaterial');
    const entity = {
      entityConfig: {
        entityConfigBaseUrl: 'BASE',
        lightmapTexturesUrlRelative: 'TEXTURE',
      },
      lightmapArrayJSON: ['TEST-LAYER.json', 'TEST-LAYER2.json'],
    };

    const layer = {
      name: 'TEST-LAYER',
    };

    const data = await (entityService as any).getTargetMaterial(entity, 'materialMappingUrl', layer);

    expect(data.name).toBe('TEST-MAT2');
    expect(data.id).toBe('TEST-MAT2');
    expect(data['isLightmapMaterial']).toBeFalsy();
    expect(spyGetMaterial).toHaveBeenCalledTimes(1);
    expect(spyCreateMaterial).not.toHaveBeenCalled();
  });

  it('applyMaterials', async () => {
    const entity = {
      materialMappings: [
        { mapping: 'Mapping 1', meshes: [1, 2, 3] },
        { mapping: 'Mapping 2', meshes: [4, 5] },
        { mapping: 'Mapping 3', meshes: [6] },
        { mapping: 'Mapping 1', meshes: [7, 8] },
      ],
    };

    const spyApplyMaterial = spyOn(entityService as any, 'applyMaterial').and.returnValue(Promise.resolve());

    await entityService.applyMaterials(entity as any);

    expect(spyApplyMaterial).toHaveBeenCalledTimes(3);
    expect(spyApplyMaterial).toHaveBeenCalledWith(entity, 'Mapping 1', [1, 2, 3, 7, 8]);
    expect(spyApplyMaterial).toHaveBeenCalledWith(entity, 'Mapping 2', [4, 5]);
    expect(spyApplyMaterial).toHaveBeenCalledWith(entity, 'Mapping 3', [6]);
  });

  it('applyMaterial', async () => {
    const entity = {
      layers: [{ name: 'TEST' }, { name: 'TEST2' }],
      lightmapArrayJSON: ['TEST.png', 'TEST3.jpg'],
    };
    const mesh1 = new AbstractMesh('TEST', scene);
    mesh1['lightMapFileName'] = 'TEST.png';
    const mesh2 = new AbstractMesh('TEST2', scene);

    const meshes = [mesh1, mesh2];

    const targetMaterial = new MVMaterial('TEST_MAT.json', '', scene);

    const spyGetTargetMaterial = spyOn(entityService as any, 'getTargetMaterial').and.returnValue(
      Promise.resolve(targetMaterial),
    );

    const spyGetLightMapMaterial = spyOn(entityService as any, 'getLightMapMaterial').and.returnValue(
      new MVMaterial('TEST_MAT_TEST.png.json', '', scene),
    );

    await (entityService as any).applyMaterial(entity, 'URL', meshes);

    expect(spyGetTargetMaterial).toHaveBeenCalledTimes(1);
    expect(spyGetTargetMaterial).toHaveBeenCalledWith(entity, 'URL');
    expect(spyGetLightMapMaterial).toHaveBeenCalledTimes(1);
    expect(spyGetLightMapMaterial).toHaveBeenCalledWith(entity, mesh1, targetMaterial);
    expect(meshes[0].material.name).toEqual('TEST_MAT_TEST.png.json');
    expect(meshes[1].material.name).toEqual('TEST_MAT.json');
  });
});
