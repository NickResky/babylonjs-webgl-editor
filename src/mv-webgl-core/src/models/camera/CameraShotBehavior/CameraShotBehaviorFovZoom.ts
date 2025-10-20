import { Observer, PointerEventTypes, PointerInfoPre, Tools } from 'babylonjs';
import { ArcRotateCameraPinchToZoomInput } from '../input/pinch-to-zoom';
import { MVCameraShotBehaviorSettings } from '../interfaces';
import { MVCamera } from '../MVCamera';
import { CameraShotBehavior } from './CameraShotBehavior';

/**
 * Camera-FovZoom behavior class
 */
export class CameraShotBehaviorFovZoom extends CameraShotBehavior {
    private _fovZoomObserver: Observer<PointerInfoPre>;

    /**
     * Create a new FovZoom-Behavior based on the MVCameraShotBehaviorSettings
     * @param settings -
     * @param canvas - the canvas object the scene is rendered on -
     */
    constructor(settings: MVCameraShotBehaviorSettings) {
        super(settings);
    }

    /**
     * Update settings
     * @param camera -
     *
     */
    protected override updateSettings(camera: MVCamera): MVCamera {
        super.updateSettings(camera);
        this._setupFovZoom(camera);

        return camera;
    }

    /**
     * Activate behavior on camera
     * @param camera -
     */
    public override activate(camera: MVCamera): void {
        super.activate(camera);
    }

    /**
     * Deactivate behavior on camera
     * @param camera -
     */
    public override deactivate(camera: MVCamera): void {
        super.deactivate(camera);
        this._disableFovZoom(camera);
        // camera.fov = Tools.ToRadians(camera.currentShot.getSettings().fov);
    }

    /**
     * Setups FOV Zoom for camera
     * @param camera -
     */
    private _setupFovZoom(camera: MVCamera): void {
        const scene = camera.getScene();
        const engine = scene.getEngine();
        const canvas = engine.getRenderingCanvas();

        const input = new ArcRotateCameraPinchToZoomInput(this.settings);
        input.attachControl();
        camera.inputs.add(input as any);

        // mouseWheel FOV zoom
        this._fovZoomObserver = scene.onPrePointerObservable.add(
            (pointerInfo, eventState) => {
                //sanity check - this should be a PointerWheel event.
                if (pointerInfo.type !== PointerEventTypes.POINTERWHEEL) {
                    return;
                }
                const event = <MouseEvent>pointerInfo.event;

                const mouseWheelLegacyEvent = event as any;

                let delta = 0;
                if (mouseWheelLegacyEvent.wheelDelta) {
                    delta = mouseWheelLegacyEvent.wheelDelta;
                } else if (event.detail) {
                    delta = -event.detail;
                }

                if (delta) {
                    scene.activeCamera.fov -= delta / 1800;

                    const fovMin = Tools.ToRadians(this.settings.options.fovMin);
                    if (scene.activeCamera.fov < fovMin) {
                        scene.activeCamera.fov = fovMin;
                    }

                    const fovMax = Tools.ToRadians(this.settings.options.fovMax);
                    if (scene.activeCamera.fov > fovMax) {
                        scene.activeCamera.fov = fovMax;
                    }
                }
            },
            BABYLON.PointerEventTypes.POINTERWHEEL,
            false,
        );
    }

    /**
     * Disables FOV Zoom for camera
     * @param camera -
     */
    private _disableFovZoom(camera: MVCamera): void {
        const scene = camera.getScene();

        scene.onPrePointerObservable.remove(this._fovZoomObserver);
        // this._hammer.get('pinch').set({ enable: false });
    }
}
