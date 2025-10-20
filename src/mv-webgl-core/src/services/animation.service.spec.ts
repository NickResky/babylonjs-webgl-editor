import { services } from '../ioc/container-modules';
import { CoreWraperElement, CoreCanvasElement } from '../models/CoreCanvasElement';
import { Scene, AnimationGroup, NullEngine } from 'babylonjs';
import { Container } from 'inversify';
import { TYPES } from '../ioc/types';
import { CoreSettings } from '../settings';
import { AnimationService } from './animation.service';
import { MVEntity } from '../models/entity/mv-entity';
import { MVEntityConfig } from '../models/entity/interfaces';
import { MVRuleEngineTypes } from '../models/configuration/interfaces';
import { MVAnimation } from '../models/animation/MVAnimation';

describe('Animation Service', () => {
  let mockAnimationServiceContainer: any;
  let mva: MVAnimation;
  let scene: Scene;
  let engine: NullEngine;
  let notExistingAnimationGroupID: string;
  let existingAnimationGroupID: string;
  let animationService: AnimationService;
  let mockEntityConfig: MVEntityConfig = {
    name: 'test_car_model',
    id: 'test_car_id_01',
    animations: [
      { fileUrl: 'test_animation_01.glb', speedRatio: 1 },
      { fileUrl: 'test_animation_02.glb', speedRatio: 1 },
      { fileUrl: 'test_animation_03.glb', speedRatio: 1 },
    ],
    environmentEntityUrlsRelative: ['test_entity_config_01.json', 'test_entity_config_02.json'],
    ruleEngineType: MVRuleEngineTypes.JSON,
    meshesUrlRelative: 'test/test/meshes_production/',
    materialsUrlRelative: 'test/test/materials/',
    texturesUrlRelative: 'test/test/textures/',
    actionItemUrlRelative: 'test/test/test_action_items.json',
    ruleEngineConfigUrlRelative: 'test/test/test_rule_engine.json',
    materialMappingsUrlRelative: 'test/test/test_material_mappings.json',
    rigUrlRelative: 'test/test/test_rig.glb',
    cameraShotUrlsRelative: [],
  };
  let mockEntity = new MVEntity(mockEntityConfig, 'TestEntityID');
  let container = new Container({ defaultScope: 'Singleton' });

  beforeAll(() => {
    const canvas = document.createElement('canvas');
    const div = document.createElement('div');
    engine = new NullEngine();

    const coreSettingsObject = {
      assetsBaseUrl: 'fakeUrl',
      openInspectorWithKey: 'KeyI',
      postProcessingOptions: {
        imagePostProcessingEnabled: true,
        glowLayerEnabled: true,
      },
    };
    container.bind<Scene>(TYPES.Scene).toConstantValue(scene);
    container.bind<CoreWraperElement>(TYPES.CoreWraperElement).toConstantValue(div);
    container.bind<CoreCanvasElement>(TYPES.Canvas).toConstantValue(canvas);
    container.bind<CoreSettings>(TYPES.CoreSettings).toConstantValue(new CoreSettings(coreSettingsObject as any));
    container.load(services);
  });

  beforeEach(() => {
    scene = new Scene(engine);
    mockAnimationServiceContainer = container.get<AnimationService>(TYPES.AnimationService);
    animationService = new AnimationService();
    const animationGroup = new AnimationGroup('TestMvaID', scene);
    mva = new MVAnimation(animationGroup);
    notExistingAnimationGroupID = 'falseID';
    existingAnimationGroupID = 'correctID';
    (mva as any)._id = 'correctID';

    (mockEntity as any)._animations.push(mva);
  });
  afterEach(() => {
    scene.dispose();
  });

  it('Should create', () => {
    expect(animationService).toBeTruthy();
  });

  it('should call the play function with an existing animationGroupID and check if it has been resolved', async () => {
    const animationObject = { play: () => {} };
    const animationsObjectSpy = spyOn(animationObject, 'play');
    const entitySpy = spyOn(mockEntity, 'getAnimation').and.returnValue(animationObject as any);
    mockAnimationServiceContainer.play(existingAnimationGroupID, mockEntity);
    expect(animationsObjectSpy).toHaveBeenCalled();
    await expectAsync(mockAnimationServiceContainer.play(existingAnimationGroupID, mockEntity)).toBeResolved();
  });

  it('should return warning on play function if animationGroupID does not exist', async () => {
    const result = await mockAnimationServiceContainer.play(notExistingAnimationGroupID, mockEntity);
    expect(result).toBe(
      `No animation group named '${notExistingAnimationGroupID}' found for the entity '${mockEntity.name}'`,
    );
  });

  it('should call the pause function with an existing animationGroupID and check if it has been resolved', async () => {
    const animationObject = { pause: () => {} };
    const animationsObjectSpy = spyOn(animationObject, 'pause');
    const entitySpy = spyOn(mockEntity, 'getAnimation').and.returnValue(animationObject as any);
    mockAnimationServiceContainer.pause(existingAnimationGroupID, mockEntity);
    expect(animationsObjectSpy).toHaveBeenCalled();

    await expectAsync(mockAnimationServiceContainer.pause(existingAnimationGroupID, mockEntity)).toBeResolved();
  });

  it('should call an error on pause function if animationgroupID does not exist', async () => {
    await expectAsync(mockAnimationServiceContainer.pause(notExistingAnimationGroupID, mockEntity)).toBeRejectedWith(
      new Error(`No animation group named '${notExistingAnimationGroupID}' found for the entity '${mockEntity.name}'`),
    );
  });

  it('should call the stop function with an existing animationGroupID and check if it has been resolved', async () => {
    const animationObject = { stop: () => {} };
    const animationsObjectSpy = spyOn(animationObject, 'stop');
    const entitySpy = spyOn(mockEntity, 'getAnimation').and.returnValue(animationObject as any);
    mockAnimationServiceContainer.stop(existingAnimationGroupID, mockEntity);
    expect(animationsObjectSpy).toHaveBeenCalled();
  });

  it('should call an error on stop function if animationgroupID does not exist', async () => {
    try {
      mockAnimationServiceContainer.stop(notExistingAnimationGroupID, mockEntity);
    } catch (error) {
      expect(error.message).toEqual(
        `No animation group named '${notExistingAnimationGroupID}' found for the entity '${mockEntity.name}'`,
      );
    }
  });

  it('should call the reset function with an existing animationGroupID and check if it has been resolved', async () => {
    const animationObject = { reset: () => {} };
    const animationsObjectSpy = spyOn(animationObject, 'reset');
    const entitySpy = spyOn(mockEntity, 'getAnimation').and.returnValue(animationObject as any);
    mockAnimationServiceContainer.reset(existingAnimationGroupID, mockEntity);
    expect(animationsObjectSpy).toHaveBeenCalled();
    await expectAsync(mockAnimationServiceContainer.reset(existingAnimationGroupID, mockEntity)).toBeResolved();
  });

  it('should call an error on reset function if animationgroupID does not exist', async () => {
    await expectAsync(mockAnimationServiceContainer.reset(notExistingAnimationGroupID, mockEntity)).toBeRejectedWith(
      new Error(`No animation group named '${notExistingAnimationGroupID}' found for the entity '${mockEntity.name}'`),
    );
  });
});
