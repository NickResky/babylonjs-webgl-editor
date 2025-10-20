import { IAnimationKey } from "babylonjs";

export interface MVAnimationState {
    animationId: string;
    frame?: number;
    setToLastFrame?: boolean;
    actionItemState?: string;
}

export interface PlayAnimationOptions {
    speedRatio?: number;
    from?: number | 'start' | 'end';
    to?: number | 'start' | 'end';
    loop?: boolean;
}

export interface NodeMaterialAnimationOptions {
    id: string;
    blocks: NodeMaterialAnimationBlock[];
}

export interface NodeMaterialAnimationBlock {
    id: string;
    animationType: string;
    easingMode: string;
    keyframes: IAnimationKey[];
}