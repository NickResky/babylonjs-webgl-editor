import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { AppendSceneAsync, DebugLayer, Engine, Scene } from 'babylonjs';
// import '@babylonjs/loaders';
// import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_draco_mesh_compression';
// import '@babylonjs/loaders/glTF';
// import { registerBuiltInLoaders } from '@babylonjs/loaders/dynamic';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import 'babylonjs-loaders';
import { fromEvent, Subject } from 'rxjs';
import {
    BaseResolver,
    Core,
    MVEntity,
    MVEntityConfig
} from '../../../mv-webgl-core';
import { ActionItemService } from '../../services/action-item/action-item.service';
import { CameraService } from '../../services/camera/camera.service';
import { DataService, ProjectSettings } from '../../services/data/data.service';
import { EntityService } from '../../services/entity/entity.service';
import { EnvironmentService } from '../../services/environment/environment.service';
import {
    InspectorService,
    MVDebugLayer
} from '../../services/inspector/inspector.service';
import { MaterialService } from '../../services/material/material.service';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    imports: [CommonModule, MatIconModule, MatSelectModule, MatFormFieldModule]
})
export class HomeComponent implements AfterViewInit {
    @ViewChild('canvascontainer')
    private canvasContainer?: ElementRef<HTMLElement>;
    @ViewChild('canvascontainerwrapper')
    private canvasContainerWrapper?: ElementRef<HTMLElement>;
    @ViewChild('canvas') private canvas?: ElementRef<HTMLCanvasElement>;

    private inspectorOpen = true;
    private core?: Core;
    public scene?: Scene;
    public actionItemVisibility: boolean = true;

    public entityBaseUrl?: string;
    private entityConfigFile?: MVEntityConfig;
    public entityConfigFileName?: string;
    public entityUrl?: string;
    public entityInitiallyLoaded = false;

    private _projectSettings: ProjectSettings;
    private _productionMode = false;

    public closeInputField = new Subject<void>();
    public debugLayer?: DebugLayer;
    public actionTabsContainer: any = null;
    public loading = true;
    public loadingProgress: number = 0;
    public showLoadingBackground = true;
    public ior = 1.3;
    public metallicF0Factor = 1.0;

    public mobileViewActive = false;
    public mobileViewScale = 1;

    constructor(
        private dataService: DataService,
        private cameraService: CameraService,
        private environmentService: EnvironmentService,
        private actionItemService: ActionItemService,
        private entityService: EntityService,
        private materialService: MaterialService,
        private inspectorService: InspectorService,
        private elmRef: ElementRef
    ) {}

    ngAfterViewInit(): void {
        // this.dataService.loading$.subscribe((loading: boolean) => {
        //   this.loading = loading;
        // });
        // this.dataService.showLoadingBackground$.subscribe((showLoadingBackground: boolean) => {
        //   this.showLoadingBackground = showLoadingBackground;
        // });
        this.dataService.projectSettings$.subscribe(
            (project: ProjectSettings) => {
                this.entityBaseUrl = project.baseProjectUrl;
                this.entityConfigFile = project.entityConfigFile;
                this.entityConfigFileName = project.entityConfigFileName;
                this.entityUrl =
                    this.entityBaseUrl.replace('file://', '') +
                    this.entityConfigFileName;
                this._projectSettings = project;
                this._productionMode = project.productionMode;
                this.setup();
            }
        );
        // this.setup();
        // this.dataService.reloadScene$.subscribe(() => {
        //   // TODO
        // });
    }

    private async setup() {
        // this.dataService.setShowLoadingBackground(true);
        // this.dataService.setLoading(true);
        this.entityInitiallyLoaded = false;
        this.loadingProgress = 0;

        if (this.core) {
            this.resetCore();
        }
        const baseResolver = new BaseResolver();

        if (!this.canvasContainerWrapper) return;

        this.core = new Core(
            this.canvasContainerWrapper.nativeElement,
            (entity: MVEntity): BaseResolver => {
                // if (entity.entityConfig.cwsId) return new CWSV1AndLocalResolver();

                return baseResolver;
            },
            {
                assetsBaseUrl: this._projectSettings?.baseProjectUrl, //'http://127.0.0.1:5500/',
                // assetsBaseUrl: 'C:/Code/webgl-assets-stratus/',
                productionMode: this._productionMode,
                antiAliasingSettings: {
                    fxaaEnabled: true,
                    samplesOnRotation: 1,
                    samplesOnStill: 7,
                    automaticOptimization: 2,
                    automaticOptimizationStep: 0.2,
                    optimizationTargetFrameRate: 20,
                    fxTargetFrameRate: 3,
                    hardwareScalingMinimum: 0.5,
                    hardwareScalingMaximum: 1
                }
            }
        );
        await this.setupCamera();

        // await this.core.Product.loadProduct('stratus_entity_config.json');
        // this.core.displayDefaultLoadingUi();
        await this.actionItemService.setupActionItems(
            this.core,
            this._projectSettings
        );

        // this.core.Product.onLoadingProgressUpdate$.subscribe((loadingProgress: any) => {
        //   // this.dataService.setLoadingProgress(loadingProgress);
        //   this.loadingProgress = Math.floor(loadingProgress);
        // });

        // load environment
        this.environmentService.setup(this.core);
        // await this.entityService.updateLightmapRegistryJSON();
        // await this.entityService.updateGlbFileRegistryJSON(this.entityConfigFile);
        // // load product
        this.entityService.setup(this.core);
        const environmentEntityConfigUrl =
            this.entityConfigFile.environmentEntityUrlsRelative[0];
        const environmentEntityConfig: MVEntityConfig =
            await this.environmentService.setEnvironmentEntityConfig(
                environmentEntityConfigUrl
            );

        this.scene = this.core.getScene();

        const loadEntityPromise = this.entityService.loadEntity(
            environmentEntityConfig.id
        );

        const loadEnvironmentPromise =
            this.environmentService.loadDefaultEnvironment(
                this.entityBaseUrl,
                this.entityConfigFile
            );
        const results = await Promise.all([
            loadEntityPromise,
            loadEnvironmentPromise
        ]);
        const entity = results[0];
        this.entityService.setActiveEntity(entity);
        this.entityService.addEntity(entity);

        // // TODO only necessary until mobile and non mobile cameas are loaded togther in product controller
        await this.cameraService.requestDefaultCameraShot();

        this.setupKeyPressEvents(this.core._canvas);
        Object.defineProperty(this.scene, 'debugLayer', {
            get: function (this: Scene) {
                if (!this._debugLayer) {
                    // @ts-ignore
                    this._debugLayer = new MVDebugLayer(this);
                }
                return this._debugLayer;
            },
            enumerable: true,
            configurable: true
        });

        this.inspectorService.openInspector(
            this.scene,
            this.canvasContainerWrapper?.nativeElement
        );
        // this.scene.debugLayer.show({
        //     embedMode: true // optional: shows embedded instead of popup
        // });
        // this.debugLayer = this.scene.debugLayer;
        this.dataService.setCore(this.core);
        // this.actionTabsContainer = this.elmRef.nativeElement.querySelector('#actionTabs');

        // MVLogger.info('Start rendering');
        this.core.startRender();
        this.entityInitiallyLoaded = true;

        // this.dataService.setLoading(false);
        // this.dataService.setShowLoadingBackground(false);
    }

    setupKeyPressEvents(canvas: HTMLCanvasElement) {
        const keyDownEvent = fromEvent(canvas, 'keydown');
        keyDownEvent.subscribe((key: KeyboardEvent) => {
            const numberKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
            if (numberKeys.includes(key.key)) {
                const index = parseInt(key.key) - 1;
                this.cameraService.requestCameraShotByIndex(index);
                return;
            }

            switch (key.code) {
                case 'KeyI': {
                    // if (this.inspectorOpen) {
                    //     this.scene.debugLayer.show();
                    // } else {
                    //     this.scene.debugLayer.hide();
                    // }
                    this.inspectorOpen = !this.inspectorOpen;
                    this.inspectorService.toggleInspector(
                        this.scene,
                        this.canvasContainerWrapper.nativeElement
                    );
                    break;
                }
                case 'KeyF': {
                    this.cameraService.toggleFreeCamera();
                    break;
                }
                case 'KeyL': {
                    this.materialService.toggleLightmaps();
                    break;
                }
                case 'KeyC': {
                    this.core.toggleLUT();
                    break;
                }
                case 'KeyJ': {
                    this.dataService.resizeSidebar();
                    break;
                }
                case 'KeyM': {
                    this.toggleMobileView();
                    break;
                }
                case 'KeyV': {
                    this.materialService.toggleVertexColorHighlight();
                    break;
                }
                case 'KeyH': {
                    this.toggleHostspots();
                    break;
                }
                case 'KeyK': {
                    this.toggleLensFlareSystem();
                    break;
                }
                case 'F1': {
                    this.cameraService.requestPreviousCameraShot();
                    break;
                }
                case 'F2': {
                    this.cameraService.requestNextCameraShot();
                    break;
                }
                case 'F3': {
                    this.saveMaterialsAndCreateAllocators();
                    break;
                }
                // case 'KeyO': {
                //   this.scene.materials.forEach(material => {
                //     if (material['indexOfRefraction'] !== undefined && material['indexOfRefraction'] !== null) {
                //       material['indexOfRefraction'] -= 0.05;
                //     }
                //   });
                //   this.ior -= 0.05;
                //   this.notifier.show({
                //     type: 'info',
                //     message: 'IOR: ' + this.ior
                //   });
                //   break;
                // }
                // case 'KeyP': {
                //   this.scene.materials.forEach(material => {
                //     if (material['indexOfRefraction'] !== undefined && material['indexOfRefraction'] !== null) {
                //       material['indexOfRefraction'] += 0.05;
                //     }
                //   });
                //   this.ior += 0.05;
                //   this.notifier.show({
                //     type: 'info',
                //     message: 'IOR: ' + this.ior
                //   });
                //   break;
                // }
                // case 'KeyY': {
                //   this.scene.materials.forEach(material => {
                //     if (material['metallicF0Factor'] !== undefined && material['metallicF0Factor'] !== null) {
                //       material['metallicF0Factor'] -= 0.05;
                //     }
                //   });
                //   this.metallicF0Factor -= 0.05;
                //   this.notifier.show({
                //     type: 'info',
                //     message: 'metallicF0Factor: ' + this.metallicF0Factor
                //   });
                //   break;
                // }
                // case 'KeyU': {
                //   this.scene.materials.forEach(material => {
                //     if (material['metallicF0Factor'] !== undefined && material['metallicF0Factor'] !== null) {
                //       material['metallicF0Factor'] += 0.05;
                //     }
                //   });
                //   this.metallicF0Factor += 0.05;
                //   this.notifier.show({
                //     type: 'info',
                //     message: 'metallicF0Factor: ' + this.metallicF0Factor
                //   });
                //   break;
                // }
            }
        });
    }

    async saveMaterialsAndCreateAllocators() {
        console.log('saveMaterialsAndCreateAllocators');
        this.scene?.materials.forEach((m) => {
            if (m.name.includes('.json')) return;

            const path = `materials/suv/${m.name.replace('MI_GLTF_', '')}.json`;
            this.materialService.updateMaterial(
                this._projectSettings.baseProjectUrl,
                path,
                m as any
            );
        });
    }

    private async test_setup() {
        const engine = new Engine(this.canvas.nativeElement, true);
        const scene = new Scene(engine);

        const file = '/assets/c25_ext_body.glb';
        // const file = 'https://playground.babylonjs.com/scenes/skull.babylon';
        // const file = 'https://playground.babylonjs.com/scenes/BoomBox.glb';
        // LoadAssetContainerAsync(file, this.scene);

        await AppendSceneAsync(file, scene);

        scene.createDefaultCameraOrLight(true, true, true);

        engine.runRenderLoop(() => {
            scene.render();
        });
    }

    public toggleMobileView() {
        this.mobileViewActive = !this.mobileViewActive;
        setTimeout(() => this.core?.resize(), 0);
    }

    private resetCore(): void {
        // this.cameraService.destroyFreeCamera();
        try {
            this.core?.destroy();
        } catch (e) {
            console.log(e);
        }
        this.core = undefined;
    }

    private async setupCamera() {
        return this.cameraService.setupCamera(
            this.core,
            this.entityBaseUrl,
            this.entityConfigFile,
            this.entityUrl
        );
    }

    private toggleHostspots() {
        if (this.actionItemVisibility) {
            this.core?.ActionItem.hide();
        } else {
            this.core?.ActionItem.show();
        }
        this.actionItemVisibility = !this.actionItemVisibility;
    }

    private toggleLensFlareSystem() {
        this.core?.toggleLensFlareSystem();
    }
}
