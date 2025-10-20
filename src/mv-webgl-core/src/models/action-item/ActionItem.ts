import {
    AbstractMesh,
    Animation,
    AnimationGroup,
    CubicEase,
    Material,
    Mesh,
    MeshBuilder,
    Scene,
    Vector2,
    Vector3,
} from 'babylonjs';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { detectMobileDevice } from '../../helper';
import { ActionItemOptions, ActionItemState } from './interfaces';

/**
 * ActionItem class
 */
export class ActionItem {
    /** Defines the ID of the action item */
    public id: string;
    /** Defines the plane which is the action item in the scene */
    public plane: Mesh;
    /** Defines the collisionSphere which handle the click event later. It is bigger, for easier click events than the plane. */
    public collisionSphere: Mesh;
    public isHidden = false;

    /** Defines the onPick event. If a user clicks on the action item this event will be fired. */
    private _onPick$: Subject<ActionItem> = new Subject<ActionItem>();
    public onPick$: Observable<ActionItem>;

    /** Defines the onPointerOver event. If a user moves pointer over the action item this event will be fired. */
    public _onPointerOver$: Subject<ActionItem> = new Subject<ActionItem>();
    public onPointerOver$: Observable<ActionItem>;

    /** Defines the onPointerOut event. If a user moves pointer away from the action item this event will be fired. */
    public _onPointerOut$: Subject<ActionItem> = new Subject<ActionItem>();
    public onPointerOut$: Observable<ActionItem>;

    /** Defines the sates of the action items, which contains the position of the action item in the scene */
    private readonly _states: ActionItemState[] = [];
    /** Defines the current index of the active state */
    private _stateIndex: number;
    /** Defines the state event. If a new state on the action item is set, this event is fired. */
    private _state$: BehaviorSubject<ActionItemState> = new BehaviorSubject<ActionItemState>(null);
    /** Defines the blocked status. To avoid multiple cliks at the same time an action item gets blocked until the next state. */
    private _blocked: boolean;
    private _fadeAnimation: Animation;

    public center: Vector2;
    public zIndex: string;
    public boundingBox: { min: Vector2; max: Vector2 };
    public isCompletelyInFrustum: boolean = true;

    /** Options of the action item */
    private _options: ActionItemOptions;

    /** Node wrapper for action item */
    public root: Mesh;

    /**
     * Creates a new ActionItem
     * @param scene -
     * @param options -
     */
    constructor(
        private _scene: Scene,
        options: ActionItemOptions,
        private material: Material,
        private animationGroup?: AnimationGroup,
        private _productionMode?: boolean,
    ) {
        this._options = options;
        this.id = options.id;
        this.center = new Vector2();
        this.zIndex = '0';
        this.boundingBox = { min: new Vector2(), max: new Vector2() };

        this.root = new Mesh(options.id);

        this.plane = MeshBuilder.CreatePlane(
            `${this.id}_plane`,
            { size: options.size, sideOrientation: Mesh.DOUBLESIDE },
            null,
        );
        this.updateSize();
        this.root.addChild(this.plane);
        this.plane.visibility = 1;
        // this.plane.position = new Vector3();
        this.plane.position = options.states[0].position;
        this.plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        this.plane.material = material;
        this.plane.occlusionType = AbstractMesh.OCCLUSION_TYPE_STRICT;

        this.collisionSphere = MeshBuilder.CreateSphere(`${this.id}_sphere`, { diameter: options.size + 0.1 }, null);
        this.collisionSphere['isCollisionActor'] = true;
        this.collisionSphere.visibility = 0;
        this.collisionSphere.position = options.states[0].position;
        // this.collisionSphere.position = new Vector3();
        this.root.addChild(this.collisionSphere);

        this.onPick$ = this._onPick$.asObservable();
        this.onPointerOver$ = this._onPointerOver$.asObservable();
        this.onPointerOut$ = this._onPointerOut$.asObservable();
        this._states = options.states;
        this._stateIndex = 0;
        this._state$.next(this._states[this._stateIndex]);

        this._fadeAnimation = new Animation(
            'fadeAnimation',
            'visibility',
            30,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT,
        );
        this._fadeAnimation.setEasingFunction(new CubicEase());
    }

    public isVisible(): boolean {
        return this.plane.visibility ? true : false;
    }

    public setVisibility(visibility: boolean) {
        this.unfreeze();
        if (visibility && !this.isHidden) {
            this.plane.visibility = 1;
            this.collisionSphere.isVisible = true;
            this.playAnimation();
        } else {
            this.plane.visibility = 0;
            this.collisionSphere.isVisible = false;
            this.pauseAnimation();
        }
        this.freeze();
    }

    public pauseAnimation() {
        if (this.animationGroup) {
            this.animationGroup.pause();
        }
    }

    public playAnimation() {
        if (this.animationGroup) {
            this.animationGroup.play();
        }
    }

    /**
     * Hides action item
     */
    public hide(): void {
        this.unfreeze();
        this.isHidden = true;
        this.plane.isVisible = false;
        this.plane.visibility = 0;
        this.collisionSphere.isVisible = false;
        this.freeze();
        this.pauseAnimation();
    }

    /**
     * Shows action item
     */
    public show(): void {
        this.unfreeze();
        this.isHidden = false;
        this.plane.isVisible = true;
        this.plane.visibility = 1;
        this.collisionSphere.isVisible = true;
        this.freeze();
        this.playAnimation();
    }

    public unfreeze() {
        if (!this.plane.material) return;
        this.plane.material.unfreeze();
        this.plane._unFreeze();
    }

    public freeze() {
        if (!this.plane.material || !this._productionMode) return;
        this.plane.material.freeze();
        this.plane._freeze();
    }

    /**
     * Get the current state of the ActionItem
     *
     */
    public getState(): ActionItemState {
        return this._state$.getValue();
    }

    /**
     * Get the next state of the ActionItem
     */
    public getNextState(): ActionItemState {
        const nextIndex = this._stateIndex + 1 >= this._states.length ? 0 : this._stateIndex + 1;
        return this._states[nextIndex];
    }

    /**
     * Gets all states of the ActionItem.
     *
     */
    public getStates(): ActionItemState[] {
        return this._states;
    }

    public isBlocked(): boolean {
        return this._blocked;
    }

    /**
     * Go to next state and show ActionItem
     */
    public nextState(): void {
        this._stateIndex = this._stateIndex + 1 >= this._states.length ? 0 : this._stateIndex + 1;
        this._state$.next(this._states[this._stateIndex]);

        this.updatePosition(this.getState().position);
        if (this._states?.length > 1) {
            this.playFadeAnimation();
        }
        this._blocked = false;
    }

    /**
     * Set animation state
     * @param id - ActionItemState id
     */
    public setState(id: string): void {
        this._stateIndex = this._states.findIndex((state: ActionItemState) => state.id === id);
        this._state$.next(this._states[this._stateIndex]);
        this.updatePosition(this.getState().position);
        this._blocked = false;
    }

    /**
     * Emit OnPick and hide ActionItem
     */
    public emitOnPickTrigger(): void {
        if (!this._blocked) {
            this._onPick$.next(this);
        }
    }
    /**
     * Emit OnPointerOver and hide ActionItem
     */
    public emitOnPointerOverTrigger(): void {
        this._onPointerOver$.next(this);
    }
    /**
     * Emit OnPointerOut and hide ActionItem
     */
    public emitOnPointerOutTrigger(): void {
        this._onPointerOut$.next(this);
    }

    /**
     * Update the position of the ActionItem
     * @param position -
     */
    private updatePosition(position: Vector3): void {
        this.plane.position = position;
        this.collisionSphere.position = position;
    }

    /**
     * Plays the fade animation
     */
    public async playFadeAnimation(speedRatio: number = 3): Promise<void> {
        if (this.isHidden) return;

        this._fadeAnimation.setKeys([
            { frame: 0, value: this.plane.visibility },
            { frame: 30, value: this.plane.visibility ? 0 : 1 },
        ]);
        return new Promise(resolve => {
            this._scene.beginDirectAnimation(this.plane, [this._fadeAnimation], 0, 100, false, speedRatio, () => {
                if (this.plane.visibility) {
                    this.setVisibility(true);
                } else {
                    this.setVisibility(false);
                }
                return resolve();
            });
        });
    }

    public updateSize(isMobileCamera?: boolean) {
        const size = this._options.size;
        const mobileSize = this._options.size_mobile;

        if (size !== undefined && mobileSize !== undefined) {
            const isMobileDevice = detectMobileDevice();
            if (isMobileDevice || isMobileCamera) {
                const mobileScaling = mobileSize / size;
                this.plane.scaling.x = mobileScaling;
                this.plane.scaling.y = mobileScaling;
                this.plane.scaling.z = mobileScaling;
            } else {
                this.plane.scaling.x = 1;
                this.plane.scaling.y = 1;
                this.plane.scaling.z = 1;
            }
        }
    }

    /**
     * Blocks the action item from click events.
     */
    public block(): void {
        this._blocked = true;
    }

    /**
     * Unblocks the action item from click events.
     */
    public unblock(): void {
        this._blocked = false;
    }

    /**
     * Unloads the action item.
     */
    public unload(): void {
        this.root.dispose(false, true);
    }

    /**
     * Gets the options of the action item
     */
    public getOptions(): ActionItemOptions {
        return this._options;
    }
}
