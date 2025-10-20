import { SceneOptimizer } from "babylonjs";


export class MVSceneOptimizer extends SceneOptimizer {

    public override start() {
        this['_isRunning'] = true;
        this['_checkCurrentState']();
    }

    // private _mv_checkCurrentState() {
    //     if (!this['_isRunning']) {
    //         return;
    //     }

    //     let scene = this['_scene'];
    //     let options = this['_options'];

    //     this['_currentFrameRate'] = Math.round(scene.getEngine().getFps());

    //     if (this['_improvementMode'] && this['_currentFrameRate'] <= this['_targetFrameRate'] ||
    //         !this['_improvementMode'] && this['_currentFrameRate'] >= this['_targetFrameRate']) {
    //         this['_isRunning'] = false;
    //         this.onSuccessObservable.notifyObservers(this);
    //         return;
    //     }

    //     // Apply current level of optimizations
    //     var allDone = true;
    //     var noOptimizationApplied = true;
    //     for (var index = 0; index < options.optimizations.length; index++) {
    //         var optimization = options.optimizations[index];

    //         if (optimization.priority === this['_currentPriorityLevel']) {
    //             noOptimizationApplied = false;
    //             allDone = allDone && optimization.apply(scene, this);
    //             this.onNewOptimizationAppliedObservable.notifyObservers(optimization);
    //         }
    //     }

    //     // If no optimization was applied, this is a failure :(
    //     if (noOptimizationApplied) {
    //         this['_isRunning'] = false;
    //         this.onFailureObservable.notifyObservers(this);

    //         return;
    //     }

    //     // If all optimizations were done, move to next level
    //     if (allDone) {
    //         this['_currentPriorityLevel']++;
    //     }

    //     // Let's the system running for a specific amount of time before checking FPS
    //     scene.executeWhenReady(() => {
    //         setTimeout(() => {
    //             this._mv_checkCurrentState();
    //         }, this['_trackerDuration']);
    //     });
    // }
}