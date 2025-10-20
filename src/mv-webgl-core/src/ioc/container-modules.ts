import { ContainerModule } from 'inversify';
import {
    ActionItemController,
    AnimationController,
    CameraController,
    ControlsController,
    EnvironmentController,
    LightController,
    ProductController,
    SceneController,
} from '../controllers';
import {
    ActionsService,
    AssetLoaderService,
    CameraService,
    ConfigurationService,
    EntityService,
    LightService,
    MaterialService,
    MeshService,
    SceneSettingsService,
    TextureService,
} from '../services';
import { ActionItemService } from '../services/action-item.service';
import { AnimationService } from '../services/animation.service';
import { EventDispatcherService } from '../services/event-dispatcher.service';
import { MVSceneOptimizerService } from '../services/mv-scene-optimizer.service';
import { PlatformService } from '../services/platform.service';
import { TYPES } from './types';

//Dont use lib.dom.d.ts interfaces, everything has to be this application unique
// e.g. No HTMLElement, instead use CoreHTMLElement

export const services = new ContainerModule(({ bind }) => {
    bind<ActionItemService>(TYPES.ActionItemService).to(ActionItemService);
    bind<ActionsService>(TYPES.ActionsService).to(ActionsService);
    bind<AnimationService>(TYPES.AnimationService).to(AnimationService);
    bind<AssetLoaderService>(TYPES.AssetLoaderService).to(AssetLoaderService);
    bind<CameraService>(TYPES.CameraService).to(CameraService);
    bind<ConfigurationService>(TYPES.ConfigurationService).to(ConfigurationService);
    bind<EntityService>(TYPES.EntityService).to(EntityService);
    bind<EventDispatcherService>(TYPES.EventDispatcherService).to(EventDispatcherService);
    bind<LightService>(TYPES.LightService).to(LightService);
    bind<MaterialService>(TYPES.MaterialService).to(MaterialService);
    bind<MeshService>(TYPES.MeshService).to(MeshService);
    bind<SceneSettingsService>(TYPES.SceneSettingsService).to(SceneSettingsService);
    bind<TextureService>(TYPES.TextureService).to(TextureService);
    bind<MVSceneOptimizerService>(TYPES.MVSceneOptimizerService).to(MVSceneOptimizerService);
    bind<PlatformService>(TYPES.PlatformService).to(PlatformService);
});

export const controlers = new ContainerModule(({ bind }) => {
    bind<ActionItemController>(TYPES.ActionItemController).to(ActionItemController);
    bind<AnimationController>(TYPES.AnimationController).to(AnimationController);
    bind<CameraController>(TYPES.CameraController).to(CameraController);
    bind<ControlsController>(TYPES.ControlsController).to(ControlsController);
    bind<EnvironmentController>(TYPES.EnvironmentController).to(EnvironmentController);
    bind<LightController>(TYPES.LightController).to(LightController);
    bind<ProductController>(TYPES.ProductController).to(ProductController);
    bind<SceneController>(TYPES.SceneController).to(SceneController);
});
