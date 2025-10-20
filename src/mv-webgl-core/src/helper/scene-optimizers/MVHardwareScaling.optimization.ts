import { Scene, SceneOptimization, SceneOptimizer } from "babylonjs";

/**
 * Defines an optimization used to increase or decrease the rendering resolution
 * @description More details at https://doc.babylonjs.com/how_to/how_to_use_qualityOptimizer
 */
 export class MVHardwareScalingOptimization extends SceneOptimization {
    private _currentScale = -1;
    private _directionOffset = 1;
  
    /**
     * Gets a string describing the action executed by the current optimization
     * @return description string
     */
    public override getDescription(): string {
        return "Setting hardware scaling level to " + this._currentScale;
    }
  
    /**
     * Creates the HardwareScalingOptimization object
     * @param priority defines the priority of this optimization (0 by default which means first in the list)
     * @param direction defines the direction of the optimization
     * @param minimumScale defines the minimum scale to use (0.35 by default)
     * @param maximumScale defines the maximum scale to use (1 by default)
     * @param step defines the step to use between two passes (0.25 by default)
     */
    constructor(
        /**
         * Defines the priority of this optimization (0 by default which means first in the list)
         */
        public override priority: number = 0,
        /**
         * Defines the direction of the optimization
         */
        public direction: number = 1,
        /**
         * Defines the minimum scale to use (0.35 by default)
         */
        public minimumScale: number = 0.2,
        /**
         * Defines the maximum scale to use (1 by default)
         */
         public maximumScale: number = 1,
        /**
         * Defines the step to use between two passes (0.25 by default)
         */
        public step: number = 0.25) {
        super(priority);
    }
  
    /**
     * This function will be called by the SceneOptimizer when its priority is reached in order to apply the change required by the current optimization
     * @param scene defines the current scene where to apply this optimization
     * @param optimizer defines the current optimizer
     * @returns true if everything that can be done was applied
     */
    public override apply(scene: Scene, optimizer: SceneOptimizer): boolean {
      this._currentScale = scene.getEngine().getHardwareScalingLevel();
  
      let newScale = this._currentScale + (this.direction * this.step);

      newScale = Math.max(this.minimumScale, Math.min(this.maximumScale, newScale));

      if (newScale !== this._currentScale) {
        this._currentScale = newScale;
        scene.getEngine().setHardwareScalingLevel(this._currentScale);
      }

      return this.direction === 1 ? this._currentScale <= this.minimumScale : this._currentScale >= this.maximumScale;
    }

  }