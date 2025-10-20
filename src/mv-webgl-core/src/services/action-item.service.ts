import {
    AbstractMesh,
    Animation,
    AnimationGroup,
    Observable as BabylonObservable,
    CubicEase,
    EasingFunction,
    IAnimationKey,
    Matrix,
    Mesh,
    NodeMaterial,
    NodeMaterialBlock,
    Scene,
    Vector2,
    Vector3,
} from 'babylonjs';
import { inject, injectable } from 'inversify';
import { Subject, forkJoin } from 'rxjs';
import { MVEventTypes } from '../globals/mv-event-types';
import { loadJson, timeout } from '../helper';
import { fromBabylonObservable } from '../helper/babylon-observable.helper';
import { TYPES } from '../ioc/types';
import { CoreError, MVLogger } from '../logging';
import {
    ActionItem,
    ActionItemOptions,
    ActionItemOptionsJSON,
    ActionItemStateJSON,
    ActionItemsOptionsJSON,
} from '../models/action-item';
import { NodeMaterialAnimationOptions } from '../models/animation';
import { MVCameraShot } from '../models/camera';
import { CoreSettings } from '../settings';
import { ActionsService } from './actions.service';
import { EventDispatcherService } from './event-dispatcher.service';
import { MaterialService } from './material.service';
import { MeshService } from './mesh.service';

/**
 * Class to manage all ActionItems in the scene
 */
@injectable()
export class ActionItemService {
    public readonly onPointerOverTrigger$: Subject<ActionItem> = new Subject<ActionItem>();
    public readonly onPointerOutTrigger$: Subject<ActionItem> = new Subject<ActionItem>();
    public readonly onPickTrigger$: Subject<ActionItem> = new Subject<ActionItem>();
    public readonly onMoveTrigger$: Subject<ActionItem> = new Subject<ActionItem>();

    private _root: AbstractMesh = new Mesh('action_items');
    private _actionItems: ActionItem[] = [];
    private _fadeAnimation: Animation;

    /**
     * Creates new ActionItem Manager
     * @param scene -
     * @param _meshService -
     */
    constructor(
        @inject(TYPES.Scene) private _scene: Scene,
        @inject(TYPES.MeshService) private _meshService: MeshService,
        @inject(TYPES.ActionsService) private _actionsService: ActionsService,
        @inject(TYPES.MaterialService) private _materialService: MaterialService,
        @inject(TYPES.EventDispatcherService) private _eventDispatcherService: EventDispatcherService,
        @inject(TYPES.CoreSettings) private _settings?: CoreSettings,
    ) {
        this._scene.addMesh(this._root);
    }

    /**
     * Returns all active ActionItems
     *
     */
    public getActionItems(): ActionItem[] {
        return this._actionItems;
    }

    /**
     * Cleares all action items from scene. Disposes them.
     *
     *
     */
    public clear(): Promise<any> {
        const observables = this._actionItems
            .reduce(
                (acc: BabylonObservable<any>[], val: ActionItem) => [
                    ...acc,
                    val.plane.onDisposeObservable,
                    val.collisionSphere.onDisposeObservable,
                ],
                [] as BabylonObservable<any>[],
            )
            .map((p: BabylonObservable<any>) => fromBabylonObservable(p));

        this._actionItems.forEach((a: ActionItem) => {
            a.plane.dispose();
            a.collisionSphere.dispose();
        });

        this._actionItems = [];

        return forkJoin(...observables).toPromise();
    }

    /**
     * Hides ActionItem
     * @param actionItem -
     */
    public hide(actionItem: ActionItem): void {
        actionItem.hide();
    }
    /**
     * Shows ActionItem
     * @param actionItem -
     */
    public show(actionItem: ActionItem): void {
        actionItem.show();
    }
    /**
     * Emits onPick Trigger on ActionItem
     * @param actionItem -
     */
    public select(actionItem: ActionItem): void {
        actionItem.emitOnPickTrigger();
    }

    /**
     * create ActionItems from JSON document
     * @param baseUrl -
     * @param url -
     *
     */
    public async createActionItemsFromJSON(url: string, activeCameraShot?: MVCameraShot): Promise<ActionItem[]> {
        return new Promise(async (resolve: any, reject: any) => {
            try {
                const optionsJSON: ActionItemsOptionsJSON = await loadJson<ActionItemsOptionsJSON>(
                    this._settings.assetsBaseUrl + url,
                );
                const options = {
                    ...optionsJSON,
                    actionItems: optionsJSON.actionItems.map((actionItemJSON: ActionItemOptionsJSON) => {
                        return {
                            ...actionItemJSON,
                            states: actionItemJSON.states.map((stateJSON: ActionItemStateJSON) => {
                                return {
                                    ...stateJSON,
                                    position: new Vector3(...stateJSON.position),
                                };
                            }),
                            material: actionItemJSON.material ? actionItemJSON.material : options.defaultMaterial,
                        };
                    }),
                };

                const materialsBaseUrl = this._settings.assetsBaseUrl + optionsJSON.materialsUrlRelative;
                const texturesBaseUrl = this._settings.assetsBaseUrl + optionsJSON.texturesUrlRelative;
                const animationsBaseUrl = this._settings.assetsBaseUrl + optionsJSON.animationsUrlRelative;
                const actionItems: ActionItem[] = [];
                for (const actionItemOptions of options.actionItems) {
                    actionItems.push(
                        await this.createActionItem(
                            materialsBaseUrl,
                            texturesBaseUrl,
                            animationsBaseUrl,
                            actionItemOptions,
                            activeCameraShot,
                        ),
                    );
                }
                resolve(this._actionItems);
            } catch {
                reject(MVLogger.fatal(CoreError.ResourceLoadingError, 'Error loading ActionItems JSON'));
            }
        });
    }

    /**
     * Create a new ActionItem
     * @param materialBaseUrl -
     * @param textureBaseUrl -
     * @param options - ActionItem options
     *
     */
    public async createActionItem(
        materialBaseUrl: string,
        textureBaseUrl: string,
        animationsBaseUrl: string,
        options: ActionItemOptions,
        activeCameraShot?: MVCameraShot,
    ): Promise<ActionItem> {
        return new Promise(async (resolve: any, reject: any) => {
            let material = this._materialService.getMaterial(options.material);
            let animationGroup: AnimationGroup;
            if (!material) {
                material = await this._materialService.createActionItemMaterial(
                    materialBaseUrl,
                    textureBaseUrl,
                    options.material,
                );

                if (material['editorData'] && animationsBaseUrl && options.animation) {
                    // material is animated node material
                    try {
                        const animationConfig = await loadJson<NodeMaterialAnimationOptions>(
                            animationsBaseUrl + options.animation,
                        );
                        animationGroup = this._scene.animationGroups.find((ag) => {
                            return ag.name == animationConfig.id;
                        });
                        if (!animationGroup) {
                            animationGroup = new AnimationGroup(animationConfig.id, this._scene);
                            animationConfig.blocks.forEach((blockAnimation, index) => {
                                const nodeMaterialBlock = (material as NodeMaterial).getBlockByName(blockAnimation.id);
                                this.createAndPlayNodeMaterialAnimation(
                                    nodeMaterialBlock,
                                    'value',
                                    Animation[blockAnimation.animationType],
                                    blockAnimation.keyframes,
                                    animationGroup,
                                    new CubicEase(),
                                    EasingFunction[blockAnimation.easingMode],
                                    false,
                                );
                            });
                        }
                    } catch (error) {
                        console.log(
                            `ActionItem '${options.id}': Cannot find an animation file (path: ${
                                animationsBaseUrl + options.animation
                            })`,
                        );
                    }
                }
            }

            if (material instanceof NodeMaterial && !!options.animation && !animationGroup) {
                const animationConfig = await loadJson<NodeMaterialAnimationOptions>(
                    animationsBaseUrl + options.animation,
                );
                animationGroup = this._scene.animationGroups.find((ag) => {
                    return ag.name == animationConfig.id;
                });
            }

            const actionItem = new ActionItem(
                this._scene,
                options,
                material,
                animationGroup,
                this._settings.productionMode,
            );

            if (options.category && activeCameraShot) {
                const isVisible =
                    options.category == activeCameraShot.category && options.cameraId !== activeCameraShot.id;
                actionItem.setVisibility(isVisible);
            }

            actionItem.hide();

            this._root.addChild(actionItem.root);

            // Register click event on ActionItem
            this._actionsService.registerOnPickTrigger(actionItem.collisionSphere, () => {
                if (!actionItem.isBlocked()) {
                    this.onPointerOutTrigger$.next(actionItem);
                    this.onPickTrigger$.next(actionItem);
                    actionItem.emitOnPickTrigger();
                    this._eventDispatcherService.publish(MVEventTypes.onActionItemClick, { actionItem });
                }
            });

            this._actionsService.registerOnPointerOverTrigger(actionItem.collisionSphere, () => {
                actionItem.emitOnPointerOverTrigger();
                this.updateActionItem(actionItem);
                this.onPointerOverTrigger$.next(actionItem);
            });
            this._actionsService.registerOnPointerOutTrigger(actionItem.collisionSphere, () => {
                actionItem.emitOnPointerOutTrigger();
                this.onPointerOutTrigger$.next(actionItem);
            });

            this._scene.activeCamera.onViewMatrixChangedObservable.add(() => {
                this.updateActionItem(actionItem);
                this.onMoveTrigger$.next(actionItem);
            });

            this._actionItems.push(actionItem);
            resolve(actionItem.id);
        });
    }

    public async updateActionItemsVisibility(cameraShot: MVCameraShot, speedRatio?: number) {
        const promises = [];
        this._actionItems.forEach((actionItem) => {
            const cameraId = actionItem.getOptions().cameraId;
            const hideActionItems = cameraShot.getSettings().hideActionItems;
            const actionItemCategory = actionItem.getOptions().category;
            const cameraCategoryIsActive = !actionItemCategory || actionItemCategory == cameraShot.category;
            const cameraIdIsActive = cameraId == cameraShot.id;
            const isVisible = actionItem.isVisible();
            if (!isVisible && cameraCategoryIsActive && !cameraIdIsActive) {
                // fade in
                promises.push(actionItem.playFadeAnimation(speedRatio));
            } else if (isVisible && (!cameraCategoryIsActive || cameraIdIsActive || hideActionItems)) {
                // fade out
                promises.push(actionItem.playFadeAnimation(speedRatio));
            }
        });
        return Promise.all(promises);
    }

    public updateActionItemsSize(isMobileCamera?: boolean) {
        this._actionItems.forEach((actionItem: ActionItem) => {
            actionItem.updateSize(isMobileCamera);
        });
    }

    public async updateActionItems(isMobileCamera?: boolean, timeoutInMS?: number) {
        if (timeoutInMS) {
            await timeout(timeoutInMS);
        }
        this._actionItems.forEach((actionItem: ActionItem) => {
            this.updateActionItem(actionItem);
            actionItem.updateSize(isMobileCamera);
            this.onMoveTrigger$.next(actionItem);
        });
    }

    /**
     * Updates action item data
     * @param actionItem -
     */
    private updateActionItem(actionItem: ActionItem): void {
        const scene = actionItem.root.getScene();
        const viewport = scene.activeCamera.viewport;
        const engine = scene.getEngine();

        const hardwareScalingLevel = engine.getHardwareScalingLevel();

        const projectedTo2DViewport = Vector3.Project(
            actionItem.collisionSphere.position,
            Matrix.Identity(),
            scene.getTransformMatrix(),
            viewport.toGlobal(
                engine.getRenderWidth() * hardwareScalingLevel,
                engine.getRenderHeight() * hardwareScalingLevel,
            ),
        );

        const bb = actionItem.root.getBoundingInfo().boundingBox;
        const vectors = bb.vectorsWorld;

        const projectedBBVectors = vectors.map((v: Vector3) =>
            Vector3.Project(
                v,
                Matrix.Identity(),
                scene.getTransformMatrix(),
                viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()),
            ),
        );

        let minX = projectedBBVectors[0].x;
        let maxX = projectedBBVectors[0].x;
        let minY = projectedBBVectors[0].y;
        let maxY = projectedBBVectors[0].y;

        projectedBBVectors.forEach((v3: Vector3) => {
            minX = v3.x < minX ? v3.x : minX;
            maxX = v3.x > maxX ? v3.x : maxX;
            minY = v3.y < minY ? v3.y : minY;
            maxY = v3.y > maxY ? v3.y : maxY;
        });

        const isOccluded = actionItem.root.isOccluded;
        const isVisible = actionItem.root.visibility !== 0;
        actionItem.isCompletelyInFrustum = !!scene.frustumPlanes && bb.isCompletelyInFrustum(scene.frustumPlanes);

        actionItem.center = new Vector2(projectedTo2DViewport.x, projectedTo2DViewport.y);
        actionItem.zIndex = '' + parseInt('' + projectedTo2DViewport.z * 10000000);
        actionItem.boundingBox = { min: new Vector2(minX, minY), max: new Vector2(maxX, maxY) };
        // actionItem.setVisibility(isCompletelyInFrustum && !isOccluded && isVisible);
    }

    /**
     * Reset Action Items
     */
    public resetActionItems(): void {
        this._actionItems.forEach((item: ActionItem) => item.unload());
        this._actionItems = [];
    }

    /**
     * Sets the state of an action item by id. If no state is passed the action item is set to the default state.
     * @param actionItemId -
     * @param actionItemState -
     */
    public setActionItemState(actionItemId: string, actionItemState: string): void {
        if (this._actionItems) {
            const matchingActionItem = this._actionItems.find((actionItem: ActionItem) => {
                return actionItem.id == actionItemId;
            });
            if (matchingActionItem) {
                if (!actionItemState) {
                    const states = matchingActionItem.getStates();
                    const defaultStateName = states && states.length > 0 ? states[0].id : null;
                    if (!defaultStateName) {
                        return;
                    }
                    actionItemState = defaultStateName;
                }
                matchingActionItem.setState(actionItemState);
            }
        }
    }

    public createAndPlayNodeMaterialAnimation(
        parameter: NodeMaterialBlock,
        animValue: string,
        animationType: number,
        animKeys: IAnimationKey[],
        group: AnimationGroup,
        ease: any,
        easeMode: number,
        start: boolean,
    ) {
        const paramAnim = new Animation(
            parameter.name,
            animValue,
            60,
            animationType,
            Animation.ANIMATIONLOOPMODE_CYCLE,
        );

        if (ease != null) {
            const easingFunction = ease;
            if (easeMode != null) {
                easingFunction.setEasingMode(easeMode);
            }
            paramAnim.setEasingFunction(easingFunction);
        }

        paramAnim.setKeys(animKeys);
        if (group !== null) {
            group.addTargetedAnimation(paramAnim, parameter);
            group.play(true);
        }
    }
}
