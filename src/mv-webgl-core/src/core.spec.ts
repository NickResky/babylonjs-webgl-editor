import { Core } from './core';
import { AppConfig } from '../environment/environment';
import { BaseResolver } from './resolvers/base-resolver';
import { MVEntity } from './models/entity/mv-entity';

describe('Core', () => {
  const CONTAINER_ID = 'test-id';

  let core: Core;
  let canvas;
  let localResolver;
  let cws1Resolver;

  beforeAll(() => {
    canvas = document.createElement('canvas');

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    document.body.appendChild(container);

    localResolver = new BaseResolver();

    AppConfig.ASSET_LOADING = 'LOCAL';
  });

  beforeEach(() => {
    core = new Core(
      canvas,
      (entity: MVEntity): BaseResolver => {
        if ((entity as any).cwsId) return cws1Resolver;

        return localResolver;
      },
      { assetsBaseUrl: '/' },
    );
  });

  describe('CORE_TEST', () => {
    it('TEST', () => {
      expect(false).toBeFalse();
    });

    describe('Something1', () => {
      it('Works', () => {
        expect(false).toBeFalse();
      });
    });

    describe('Something2', () => {
      it('Works2', () => {
        expect(false).toBeFalse();
      });
    });
  });

  it('should throw if input is invalid', () => {
    const ff1 = function() {
      new Core(
        null,
        (entity: MVEntity): BaseResolver => {
          if ((entity as any).cwsId) return cws1Resolver;

          return localResolver;
        },
        { assetsBaseUrl: '/' },
      );
    };
    const ff2 = function() {
      new Core(
        '',
        (entity: MVEntity): BaseResolver => {
          if ((entity as any).cwsId) return cws1Resolver;

          return localResolver;
        },
        { assetsBaseUrl: '/' },
      );
    };
    expect(ff1).toThrowError(
      '[FATAL ERROR] InvalidParameterError. (No html container id or element provided in Core constructor.)',
    );
    expect(ff2).toThrowError(
      '[FATAL ERROR] InvalidParameterError. (No html container id or element provided in Core constructor.)',
    );
  });

  it('should throw if container element not found', () => {
    const ff1 = function() {
      new Core(
        'fake elementid that does not exist',
        (entity: MVEntity): BaseResolver => {
          if ((entity as any).cwsId) return cws1Resolver;

          return localResolver;
        },
        { assetsBaseUrl: '/' },
      );
    };
    expect(ff1).toThrowError(
      '[FATAL ERROR] NotFound. (No html element with the provided id (fake elementid that does not exist) found)',
    );
  });

  it('should create div wrapper and canvas element', () => {
    new Core(
      CONTAINER_ID,
      (entity: MVEntity): BaseResolver => {
        if ((entity as any).cwsId) return cws1Resolver;

        return localResolver;
      },
      { assetsBaseUrl: '/' },
    );

    const wrapper = document.getElementById('core-wrapper');
    const canvas = wrapper.getElementsByTagName('canvas')[0];
    expect(!!wrapper).toBe(true);
    expect(!!canvas).toBe(true);
  });

  it('should have wrapper and canvas of same size', () => {
    new Core(
      CONTAINER_ID,
      (entity: MVEntity): BaseResolver => {
        if ((entity as any).cwsId) return cws1Resolver;

        return localResolver;
      },
      { assetsBaseUrl: '/' },
    );
    const wrapper = document.getElementById('core-wrapper') as HTMLElement;
    const canvas = wrapper.getElementsByTagName('canvas')[0] as HTMLCanvasElement;

    const w = wrapper.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();

    const areSameWidth = w.width === c.width;
    const areSameHeight = w.height === c.height;

    expect(areSameWidth).toBe(true);
    expect(areSameHeight).toBe(true);
  });

  it('should have wrapper in same position as canvas', () => {
    new Core(
      CONTAINER_ID,
      (entity: MVEntity): BaseResolver => {
        if ((entity as any).cwsId) return cws1Resolver;

        return localResolver;
      },
      { assetsBaseUrl: '/' },
    );

    const wrapper = document.getElementById('core-wrapper') as HTMLElement;
    const canvas = wrapper.getElementsByTagName('canvas')[0] as HTMLCanvasElement;

    const w = wrapper.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();

    expect(w.top === c.top).toBe(true);
    expect(w.right === c.right).toBe(true);
    expect(w.bottom === c.bottom).toBe(true);
    expect(w.left === c.left).toBe(true);
  });
});
