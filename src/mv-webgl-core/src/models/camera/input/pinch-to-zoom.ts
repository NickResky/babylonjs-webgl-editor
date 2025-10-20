import { ArcRotateCamera, ICameraInput, Tools } from 'babylonjs';
import { Subject } from 'rxjs';
import { MVCamera, MVCameraShotBehaviorSettings } from '..';

export class ArcRotateCameraPinchToZoomInput implements ICameraInput<ArcRotateCamera> {
    // Globals to cache event state
    private static evCache = [];
    private static prevDiff = -1;
    private static diffStart = 0;
    private static currentMovement: string;
    private pinchStartFov = 1;

    private static newFov$: Subject<{ type: string; diff: number }> = new Subject<{ type: string; diff: number }>();
    private static setPinchStartFov$: Subject<void> = new Subject<void>();
    private settings: MVCameraShotBehaviorSettings;
    public camera: MVCamera;

    constructor(settings: MVCameraShotBehaviorSettings) {
        this.settings = settings;
        ArcRotateCameraPinchToZoomInput.setPinchStartFov$.subscribe(() => (this.pinchStartFov = this.camera?.fov));
        ArcRotateCameraPinchToZoomInput.newFov$.subscribe((fov) => {
            const pinchFactor = this.settings.options.wheelPrecision;
            const diff = Math.abs(1 - fov.diff);

            console.log(diff);

            const newFov =
                fov.type === 'IN'
                    ? this.pinchStartFov - diff / (pinchFactor / 3)
                    : this.pinchStartFov + diff / (pinchFactor / 3);

            const fovMinRadians = Tools.ToRadians(this.settings.options.fovMin);
            const fovMaxRadians = Tools.ToRadians(this.settings.options.fovMax);

            if (newFov >= fovMinRadians && newFov <= fovMaxRadians && fov.diff !== 1) {
                this.camera.fov = newFov;
            }
        });
    }

    public getClassName(): string {
        return 'ArcRotateCameraPinchToZoomInput';
    }

    public getSimpleName(): string {
        return 'pinchToZoom';
    }

    /**
     * Install event handlers for the pointer target
     * @param element - HTMLElement
     * @param noPreventDefault - boolean
     */
    public attachControl(noPreventDefault?: boolean): void {
        // if (!element) return;
        // element.onpointerdown = this.pointerdown_handler;
        // element.onpointermove = this.pointermove_handler;
        // // Use same handler for pointer {up,cancel,out,leave} events since
        // // the semantics for these events - in this app - are the same.
        // element.onpointerup = this.pointerup_handler;
        // element.onpointercancel = this.pointerup_handler;
        // element.onpointerout = this.pointerup_handler;
        // element.onpointerleave = this.pointerup_handler;
    }

    /**
     * TODO
     */
    detachControl: () => void;

    /**
     * TODO
     * @type {() => void}
     */
    checkInputs?: () => void;

    /**
     * The pointerdown event signals the start of a touch interaction.
     * This event is cached to support 2-finger gestures
     * @param ev - PointerEvent
     */
    public pointerdown_handler(ev): void {
        ArcRotateCameraPinchToZoomInput.evCache.push(ev);
        ArcRotateCameraPinchToZoomInput.setPinchStartFov$.next();
    }

    /**
     * This function implements a 2-pointer horizontal pinch/zoom gesture.
     * If the distance between the two pointers has increased (zoom in) is triggered,
     * and if the distance is decreasing (zoom out) is triggered
     * @param ev - PointerEvent
     */
    public pointermove_handler(ev): void {
        for (let i = 0; i < ArcRotateCameraPinchToZoomInput.evCache.length; i++) {
            if (ev.pointerId == ArcRotateCameraPinchToZoomInput.evCache[i].pointerId) {
                ArcRotateCameraPinchToZoomInput.evCache[i] = ev;
                break;
            }
        }

        // If two pointers are down, check for pinch gestures
        if (ArcRotateCameraPinchToZoomInput.evCache.length >= 2) {
            // Calculate the distance between the two pointers
            const p1 = ArcRotateCameraPinchToZoomInput.evCache[0];
            const p2 = ArcRotateCameraPinchToZoomInput.evCache[1];
            // distance between two pointers
            const curDiff = Math.sqrt(Math.pow(p1.clientX - p2.clientX, 2) + Math.pow(p1.clientY - p2.clientY, 2));
            if (ArcRotateCameraPinchToZoomInput.diffStart === 0) {
                ArcRotateCameraPinchToZoomInput.diffStart = curDiff;
            }

            let scale = ArcRotateCameraPinchToZoomInput.diffStart / curDiff;

            if (ArcRotateCameraPinchToZoomInput.prevDiff > 0) {
                if (curDiff > ArcRotateCameraPinchToZoomInput.prevDiff) {
                    if (ArcRotateCameraPinchToZoomInput.currentMovement !== 'IN') {
                        ArcRotateCameraPinchToZoomInput.currentMovement = 'IN';
                        ArcRotateCameraPinchToZoomInput.diffStart = curDiff;
                        scale = ArcRotateCameraPinchToZoomInput.diffStart / curDiff;
                    }
                    // The distance between the two pointers has increased
                    ArcRotateCameraPinchToZoomInput.newFov$.next({ type: 'IN', diff: scale });
                }
                if (curDiff < ArcRotateCameraPinchToZoomInput.prevDiff) {
                    // The distance between the two pointers has decreased
                    if (ArcRotateCameraPinchToZoomInput.currentMovement !== 'OUT') {
                        ArcRotateCameraPinchToZoomInput.currentMovement = 'OUT';
                        ArcRotateCameraPinchToZoomInput.diffStart = curDiff;
                        scale = ArcRotateCameraPinchToZoomInput.diffStart / curDiff;
                    }
                    // The distance between the two pointers has increased
                    ArcRotateCameraPinchToZoomInput.newFov$.next({ type: 'OUT', diff: scale });
                }
            }

            // Cache the distance for the next move event
            ArcRotateCameraPinchToZoomInput.prevDiff = curDiff;
        }
    }

    /**
     * Remove this pointer from the cache and reset the target's
     * @param ev - PointerEvent
     */
    public pointerup_handler(ev): void {
        ArcRotateCameraPinchToZoomInput.remove_event(ev);
        ArcRotateCameraPinchToZoomInput.setPinchStartFov$.next();

        // If the number of pointers down is less than two then reset diff tracker
        if (ArcRotateCameraPinchToZoomInput.evCache.length < 2) {
            ArcRotateCameraPinchToZoomInput.prevDiff = -1;
        }
        ArcRotateCameraPinchToZoomInput.diffStart = 0;
        ArcRotateCameraPinchToZoomInput.currentMovement = null;
    }

    /**
     * Remove this event from the target's cache
     * @param ev - PointerEvent
     */
    private static remove_event(ev): void {
        for (let i = 0; i < ArcRotateCameraPinchToZoomInput.evCache.length; i++) {
            if (ArcRotateCameraPinchToZoomInput.evCache[i].pointerId == ev.pointerId) {
                ArcRotateCameraPinchToZoomInput.evCache.splice(i, 1);
                break;
            }
        }
    }
}
