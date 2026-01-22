import { ArcRotateCamera, Scene, Vector3, InspectableType } from 'babylonjs';
import { MVCameraShot } from './MVCameraShot';

/**
 * Base Camera class
 */
export class MVCamera extends ArcRotateCamera {
    /** Current active shot */
    public currentShot: MVCameraShot;
    /** Previous camera shot */
    public previousShot: MVCameraShot;
    /** Defines if the camera is allowed to rotate. Necessary for editor. */
    public orbitBehaviourEnabled: boolean;
    /** Defines if the camera is allowed to zoom. Necessary for editor. */
    public zoomBehaviourEnabled: boolean;
    /** Defines if the camera is a custom Camera. Necessary for editor. */
    public isMVCamera: boolean;
    /** */
    public lowerAlphaLimitDegrees: number;
    /** */
    public upperAlphaLimitDegrees: number;

    /**
     * Creates a new Camera
     * @param name -
     * @param alpha -
     * @param beta -
     * @param radius -
     * @param target -
     * @param scene -
     * @param setActiveOnSceneIfNoneActive -
     */
    constructor(
        name: string,
        alpha: number,
        beta: number,
        radius: number,
        target: Vector3,
        scene: Scene,
        setActiveOnSceneIfNoneActive?: boolean
    ) {
        super(
            name,
            alpha,
            beta,
            radius,
            target,
            scene,
            setActiveOnSceneIfNoneActive
        );
        this.isMVCamera = true;
        this.orbitBehaviourEnabled = true;
        this.zoomBehaviourEnabled = true;
        this.lowerAlphaLimitDegrees = 0;
        this.upperAlphaLimitDegrees = 0;
        this.maxZ = 20000;
        this.inspectableCustomProperties = [];
        this.inspectableCustomProperties.push({
            label: 'Orbit Behaviour',
            propertyName: 'orbitBehaviourEnabled',
            type: InspectableType.Checkbox
        });
        this.inspectableCustomProperties.push({
            label: 'Zoom Behaviour',
            propertyName: 'zoomBehaviourEnabled',
            type: InspectableType.Checkbox
        });
        this.inspectableCustomProperties.push({
            label: 'Position',
            propertyName: 'position',
            type: InspectableType.Vector3
        });
        this.inspectableCustomProperties.push({
            label: 'Lower alpha limit degrees',
            propertyName: 'lowerAlphaLimitDegrees',
            type: InspectableType.Slider,
            min: 0,
            max: 359
        });
        this.inspectableCustomProperties.push({
            label: 'Upper alpha limit degrees',
            propertyName: 'upperAlphaLimitDegrees',
            type: InspectableType.Slider,
            min: 0,
            max: 359
        });
        this.inspectableCustomProperties.push({
            label: 'FOV (radians)',
            propertyName: 'fov',
            type: InspectableType.Slider,
            min: 0,
            max: 50
        });
        this.inspectableCustomProperties.push({
            label: 'Alpha (radians)',
            propertyName: 'alpha',
            type: InspectableType.Slider,
            min: 0,
            max: 10
        });
    }

    /**
     * Freeze camera with sets inertial values to zero
     */
    public freeze(): void {
        this.inertialAlphaOffset = 0.0;
        this.inertialBetaOffset = 0.0;
        this.inertialPanningX = 0.0;
        this.inertialPanningY = 0.0;
        this.inertialRadiusOffset = 0.0;
    }

    /**
     * Locks the camera rotation. Only required for better usability in editor.
     */
    public lockRotation(): void {
        this.lowerBetaLimit = this.beta;
        this.upperBetaLimit = this.beta;
        this.lowerAlphaLimit = this.alpha;
        this.upperAlphaLimit = this.alpha;
    }

    /**
     * Unlocks the camera rotation. Only required for better usability in editor.
     */
    public unlockRotation(): void {
        this.lowerBetaLimit = null;
        this.upperBetaLimit = null;
        this.lowerAlphaLimit = null;
        this.upperAlphaLimit = null;
    }

    /**
     * Locks the camera zoom. Only required for better usability in editor.
     */
    public lockZoom(): void {
        this.lowerRadiusLimit = this.radius;
        this.upperRadiusLimit = this.radius;
    }

    /**
     * Unlocks the camera zoom. Only required for better usability in editor.
     */
    public unlockZoom(): void {
        this.lowerRadiusLimit = null;
        this.upperRadiusLimit = null;
    }
}
