import { DefaultRenderingPipeline, NullEngine, Scene } from 'babylonjs';
import { MVSceneOptimizerService } from './mv-scene-optimizer.service';

describe('MVSceneOptimizer Service', () => {
  let engine: NullEngine;
  let scene: Scene;
  let sceneOptimizerService: MVSceneOptimizerService;
  const coreSettings = {};

  beforeAll(() => {
    engine = new NullEngine();
  });

  beforeEach(() => {
    scene = new Scene(engine);
    sceneOptimizerService = new MVSceneOptimizerService(scene, coreSettings as any);
  });

  afterEach(() => {
    scene.dispose();
  });

  it('Should create', () => {
    expect(sceneOptimizerService).toBeTruthy();
  });

  it('init', async (done: DoneFn) => {
    const spy = spyOn(sceneOptimizerService as any, 'initAntiAliasing');
    const spyConsole = spyOn(console, 'log');
    (sceneOptimizerService as any)._settings = { logAvgFps: true };

    sceneOptimizerService.init();

    setTimeout(() => {
      expect(spy).toHaveBeenCalled();
      expect(spyConsole).toHaveBeenCalledWith('%c [INFO] ', 'background:lightgreen; color: black', 'FPS: 60');
      done();
    }, 5000);
  });

  it('initAntiAliasing', () => {
    (sceneOptimizerService as any)._settings = {
      antiAliasingSettings: {
        samplesOnStill: 2,
        fxaaEnabled: false,
      },
    };
    (sceneOptimizerService as any).initAntiAliasing();

    const renderPipeline: DefaultRenderingPipeline = (sceneOptimizerService as any)._renderPipeline;
    expect(renderPipeline.fxaaEnabled).toBeFalse();
    expect(renderPipeline.samples).toBe(2);
  });

  it('setupPostProcess', () => {
    (sceneOptimizerService as any)._settings = {
      assetsBaseUrl: '',
    };
    const postProcessingConfiguration = {
      colorGradingTextureUrl: null,
      colorGradingTextureEnabled: true,
      imagePostProcessingEnabled: true,
      toneMappingEnabled: false,
      toneMappingType: 1,
    } as any;

    sceneOptimizerService.setupPostProcess(postProcessingConfiguration);

    const renderPipeline: DefaultRenderingPipeline = (sceneOptimizerService as any)._renderPipeline;
    expect(renderPipeline.imageProcessingEnabled).toBeTrue();
    expect(renderPipeline.imageProcessing.toneMappingEnabled).toBeFalse();
    expect(renderPipeline.imageProcessing.toneMappingType).toBe(1);
  });

  it('optimizeOnMove', () => {
    const renderPipeline: DefaultRenderingPipeline = (sceneOptimizerService as any)._renderPipeline;
    renderPipeline.samples = 7;

    (sceneOptimizerService as any)._settings = {
      antiAliasingSettings: {
        samplesOnRotation: 2,
      },
    };

    sceneOptimizerService.optimizeOnMove();

    expect(renderPipeline.samples).toBe(2);
  });

  it('optimizeOnStill', () => {
    const renderPipeline: DefaultRenderingPipeline = (sceneOptimizerService as any)._renderPipeline;
    renderPipeline.samples = 2;

    (sceneOptimizerService as any)._settings = {
      antiAliasingSettings: {
        samplesOnStill: 7,
      },
    };

    sceneOptimizerService.optimizeOnStill();

    expect(renderPipeline.samples).toBe(7);
  });

  it('optimizeOnStill', () => {
    const renderPipeline: DefaultRenderingPipeline = (sceneOptimizerService as any)._renderPipeline;
    const renderPipelineFromFunction = sceneOptimizerService.getRenderPipeline();
    expect(renderPipeline).toEqual(renderPipelineFromFunction);
  });
});
