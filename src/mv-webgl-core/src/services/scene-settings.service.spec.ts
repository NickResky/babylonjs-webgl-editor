import { NullEngine, Scene, Layer, Color3, Color4 } from 'babylonjs';
import { MVSceneOptimizerService } from './mv-scene-optimizer.service';
import { SceneSettingsService } from './scene-settings.service';
import { TextureService } from './texture.service';

class TextureServiceMock extends TextureService {}
class MVSceneOptimizerServiceMock extends MVSceneOptimizerService {}

describe('Material Service', () => {
  let engine: NullEngine;
  let scene: Scene;

  let textureServiceMock: TextureService;
  let mvSceneOptimizerServiceMock: MVSceneOptimizerServiceMock;
  let sceneSettingsService: SceneSettingsService;

  beforeAll(() => {
    engine = new NullEngine();
  });

  beforeEach(() => {
    scene = new Scene(engine);
    textureServiceMock = new TextureServiceMock(null);
    mvSceneOptimizerServiceMock = new MVSceneOptimizerServiceMock(scene, null);
    sceneSettingsService = new SceneSettingsService(scene, textureServiceMock, mvSceneOptimizerServiceMock);
  });

  afterEach(() => {
    scene.dispose();
  });

  it('Should create', () => {
    expect(sceneSettingsService).toBeTruthy();
  });

  it('updateSceneSettings - entity no camera category', async () => {
    const spyRemoveBackgroundImage = spyOn(sceneSettingsService, 'removeBackgroundImage');
    const spySetBackground = spyOn(sceneSettingsService, 'setBackgroundImage').and.returnValue(Promise.resolve());

    const entity = {
      environmentSceneSettings: {
        testProp: [],
      },
    };

    await sceneSettingsService.updateSceneSettings('testCat', entity as any);

    expect(spyRemoveBackgroundImage).not.toHaveBeenCalled();
    expect(spySetBackground).not.toHaveBeenCalled();
  });

  it('updateSceneSettings - entity with category', async () => {
    const glowLayer = { glowLayer: { intensity: 0 } };
    const spyRemoveBackgroundImage = spyOn(sceneSettingsService, 'removeBackgroundImage');
    const spySetBackground = spyOn(sceneSettingsService, 'setBackgroundImage').and.returnValue(Promise.resolve());
    const spyGetRenderPipeline = spyOn(mvSceneOptimizerServiceMock, 'getRenderPipeline').and.returnValue(
      glowLayer as any,
    );
    const spyTextureCreate = spyOn(textureServiceMock, 'createOrGetTexture').and.returnValue(
      Promise.resolve({ texture: null } as any),
    );
    const consoleSpy = spyOn(console, 'warn');

    const entity = {
      entityConfig: {
        entityConfigBaseUrl: '',
        texturesUrlRelative: '',
      },
      activeEnvironmentSceneSetting: null,
      activeEnvironmentCode: null,
      environmentSceneSettings: {
        testCat: {
          glowLayerIntensity: 20,
          backgroundImage: 'url-image',
          collisionsEnabled: false,
          ambientColor: { r: 2, g: 1, b: 2 },
          clearColor: { r: 1, g: 2, b: 3, a: 0.2 },
          environmentTexture: {},
          animationTimeScale: 2,
          unknown: {
            test: [2, 1],
          },
        },
      },
    };

    await sceneSettingsService.updateSceneSettings('testCat', entity as any);

    expect(spyRemoveBackgroundImage).toHaveBeenCalled();
    expect(entity.activeEnvironmentSceneSetting).toEqual(entity.environmentSceneSettings.testCat);
    expect(entity.activeEnvironmentCode).toEqual('testCat');
    expect(spySetBackground).toHaveBeenCalledWith('', entity.environmentSceneSettings.testCat.backgroundImage);
    expect(spyGetRenderPipeline).toHaveBeenCalled();
    expect(glowLayer.glowLayer.intensity).toEqual(20);
    expect(scene.collisionsEnabled).toBeFalse();
    expect(scene.ambientColor).toEqual(new Color3(2, 1, 2));
    expect(scene.clearColor).toEqual(new Color4(1, 2, 3, 0.2));
    expect(spyTextureCreate).toHaveBeenCalled();
    expect(scene.environmentTexture).toEqual({ texture: null } as any);
    expect(scene.animationTimeScale).toBe(2);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[WARN] InvalidParameterError',
      'Property unknown with value: [object Object] Currently not supported. Value: ',
      Object({ test: [2, 1] }),
    );
  });

  it('removeBackgroundImage', (done: DoneFn) => {
    const backdrop = new Layer('backdrop', null, scene);
    expect(scene.layers.length).toBe(1);
    backdrop.onDisposeObservable.add(() => {
      done();
    });
    sceneSettingsService.removeBackgroundImage();
    expect(scene.layers.length).toBe(0);
  });

  it('setBackgroundImage', () => {
    // TODO Test this function in system or integration tests
  });
});
