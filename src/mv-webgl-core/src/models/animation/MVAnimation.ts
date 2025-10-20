import { AnimationGroup } from 'babylonjs';
import { Subject } from 'rxjs';
import { PlayAnimationOptions } from '.';
import { isNumber } from '../../helper';
import { MVLogger } from '../../logging';

/**
 * Enum for possible animation directions
 */
export enum MVAnimationDirection {
    FORWARDS,
    BACKWARDS,
}

/**
 * MVAnimation class for extended functionality for BabylonJS AnimationGroups
 */
export class MVAnimation {
    private _id: string;
    private _startFrame: number;
    private _endFrame: number;
    private _currentFrame: number;
    private _speedRatio: number;
    private _from: number | 'start' | 'end';
    private _to: number | 'start' | 'end';
    private _direction: MVAnimationDirection;
    private _animationQueue: number[] = [];
    private _animationFinished$: Subject<void> = new Subject<void>();

    /**
     * Creates a new MVAnimation
     * @param privateanimationGroup -
     * @param animationSpeedRatio -
     */
    constructor(
        private animationGroup: AnimationGroup,
        private animationSpeedRatio?: number,
    ) {
        this._id = animationGroup.name;
        this._from = animationGroup.from;
        this._to = animationGroup.to;
        this._endFrame = animationGroup.to;
        this._startFrame = 0;
        this._currentFrame = this._startFrame;
        this._direction = MVAnimationDirection.FORWARDS;
        this._speedRatio = animationSpeedRatio;
        this._currentFrame = animationGroup.from;
    }

    /**
     * Plays an animation from and to a specific frame. If only one or none of these frames are provided,
     * they will be calculated based on the current state of the animation
     * @param  options - from, to, speedRatio, loop
     */
    public async play(options: PlayAnimationOptions = {}): Promise<MVAnimation> {
        return new Promise(async (resolve: CallableFunction) => {
            const playAnimationUuid: number = Math.random();
            this._animationQueue.push(playAnimationUuid);
            await this.waitUntilFinishedPlaying(playAnimationUuid);

            // Before animation starts, set from & to

            options.to = isNumber(options.to)
                ? options.to
                : options.to === 'start'
                  ? this.startFrame
                  : options.to === 'end'
                    ? this.endFrame
                    : null;
            options.from = isNumber(options.from)
                ? options.from
                : options.from === 'start'
                  ? this.startFrame
                  : options.from === 'end'
                    ? this.endFrame
                    : null;

            if (options.to === this._currentFrame) {
                this.removeAnimationFromQueue(playAnimationUuid);
                return resolve(this);
            }

            if (options.to === undefined || options.to === null) {
                this.to = this._direction === MVAnimationDirection.FORWARDS ? this.endFrame : this.startFrame;
            } else {
                this.to = options.to;
            }
            if (options.from === undefined || options.from === null) {
                this.from = this._currentFrame;
            } else {
                this.from = options.from;
            }

            if (options.speedRatio) {
                this.animationGroup.speedRatio = options.speedRatio;
            } else {
                this.animationGroup.speedRatio = this._speedRatio;
            }

            this._direction = this.to > this.from ? MVAnimationDirection.FORWARDS : MVAnimationDirection.BACKWARDS;

            // After animation has finished
            this.animationGroup.onAnimationGroupEndObservable.addOnce((ag: AnimationGroup) => {
                MVLogger.info(this.id + ' finshed playing');
                const to = isNumber(this.to) ? (this.to as number) : this.endFrame;
                this._currentFrame = to;
                if (this._currentFrame >= this.endFrame) {
                    this._direction = MVAnimationDirection.BACKWARDS;
                    this.from = this.endFrame;
                    this.to = this.startFrame;
                } else if (this._currentFrame === this.startFrame) {
                    this._direction = MVAnimationDirection.FORWARDS;
                    this.from = this.startFrame;
                    this.to = this.endFrame;
                } else if (this._currentFrame >= to) {
                    this.from = this._currentFrame;
                }
                this.removeAnimationFromQueue(playAnimationUuid);
                resolve(this);
            });

            // Play animation
            this.animationGroup.play(options.loop);
        });
    }

    public removeAnimationFromQueue(playAnimationUuid: number) {
        const animationIndex = this._animationQueue.indexOf(playAnimationUuid);
        this._animationQueue.splice(animationIndex, 1);
        this._animationFinished$.next();
    }

    /**
     * Pauses an animation. To continue playing a paused animation, call play()
     */
    public async pause(): Promise<MVAnimation> {
        return new Promise((resolve: CallableFunction) => {
            this.animationGroup.pause();
            this.animationGroup.onAnimationGroupPauseObservable.addOnce(() => {
                resolve(this);
            });
        });
    }

    public isPlaying(): boolean {
        return this.animationGroup?.isPlaying;
    }

    /**
     * Stop an animation
     */
    public stop(): void {
        this.animationGroup.stop();
    }

    /**
     * Resets an animation to the startFrame
     */
    public async reset(): Promise<MVAnimation> {
        await this.play({
            to: 0,
            speedRatio: 100,
        });
        return this;
    }

    /**
     * Get the 'from' frame of the animation
     */
    public get from(): number | 'start' | 'end' {
        return this._from;
    }

    /**
     * Set the 'from' frame of the animation
     * @param value -
     */
    public set from(value: number | 'start' | 'end') {
        this.animationGroup['_from'] = value;
        this._from = value;
    }

    /**
     * Get the 'to' frame of the animation
     */
    public get to(): number | 'start' | 'end' {
        return this._to;
    }

    /**
     * Set the 'to' frame of the animation
     * @param value -
     */
    public set to(value: number | 'start' | 'end') {
        this.animationGroup['_to'] = value;
        this._to = value;
    }

    /**
     * Get the id of the animation
     */
    public get id(): string {
        return this._id;
    }

    /**
     * Gets the current frame of the animation
     */
    public getCurrentFrame(): number {
        return this._currentFrame;
    }

    /**
     * Get the start frame of the animation
     */
    public get startFrame(): number {
        return this._startFrame;
    }

    /**
     * Get the end frame of the animation
     */
    public get endFrame(): number {
        return this._endFrame;
    }

    public clone(newId: string): MVAnimation {
        const clonedAnimation = new MVAnimation(this.animationGroup.clone(newId), this._speedRatio);
        clonedAnimation._from = this.from;
        clonedAnimation._to = this.to;
        clonedAnimation._endFrame = this.endFrame;
        clonedAnimation._startFrame = this.startFrame;
        clonedAnimation._direction = this._direction;
        clonedAnimation._speedRatio = this._speedRatio;
        clonedAnimation._currentFrame = this._currentFrame;
        return clonedAnimation;
    }

    public async waitUntilFinishedPlaying(playAnimationId?: number): Promise<void> {
        if (this._animationQueue.length == 0 || this._animationQueue[0] == playAnimationId) {
            return;
        }

        MVLogger.debug(`Animation ${this.id} ${playAnimationId} is waiting for other animations to finish`);

        return new Promise((resolve: any, reject: any) => {
            this._animationFinished$.subscribe(() => {
                if (!playAnimationId && this._animationQueue.length == 0) {
                    return resolve();
                }
                if (playAnimationId && this._animationQueue[0] == playAnimationId) {
                    return resolve();
                }
            });
        });
    }
}
