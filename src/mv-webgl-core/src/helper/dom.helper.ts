import { Camera, Engine, Tools } from 'babylonjs';
import { MVLogger } from '../logging';
import { MVStartRenderOptions } from '../models/camera';

export const takeScreenshot = async (engine: Engine, activeCamera: Camera, startedRendering) => {
    const screenshotContainer = document.getElementById('screenshot-container');
    if (screenshotContainer) {
        const screenshotContainerParent = screenshotContainer.parentElement;
        if (screenshotContainerParent) {
            screenshotContainerParent.removeChild(screenshotContainer);
        }
    }

    if (activeCamera && startedRendering) {
        const wrapper = document.getElementById('core-wrapper');
        if (!wrapper) {
            MVLogger.debug('core-wrapper element not found');
            return;
        }
        const screenshot = await Tools.CreateScreenshotAsync(engine, activeCamera, {
            width: wrapper.clientWidth,
            height: wrapper.clientHeight,
        });
        MVLogger.debug('Screenshot captured');
        const screenshotContainer = document.createElement('img');
        screenshotContainer.id = 'screenshot-container';
        screenshotContainer.style.display = 'block';
        screenshotContainer.style.position = 'absolute';
        screenshotContainer.style.top = '0';
        screenshotContainer.style.overflow = 'hidden';
        screenshotContainer.style.boxSizing = 'border-box';
        screenshotContainer.style.width = '100%';
        screenshotContainer.style.height = '100%';
        screenshotContainer.style.padding = '0';
        screenshotContainer.style.margin = '0';
        screenshotContainer.style.border = '0';
        screenshotContainer.style.fontSize = '0';
        screenshotContainer.src = screenshot;
        screenshotContainer.style.backgroundSize = '100%';
        screenshotContainer.style.opacity = '1';
        screenshotContainer.style.pointerEvents = 'none';
        screenshotContainer.style.transition = 'opacity ease-in-out 0.3s';
        screenshotContainer.style.webkitTransition = 'opacity ease-in-out 0.3s';
        screenshotContainer.ondragstart = () => {
            return false;
        };
        wrapper.appendChild(screenshotContainer);

        const screenshotReadyPromise = new Promise((resolve) => {
            screenshotContainer.onload = () => {
                resolve(null);
            };
        });

        await screenshotReadyPromise;
    }
};

export const removeScreenshot = async (options?: MVStartRenderOptions) => {
    const wrapper = document.getElementById('core-wrapper');
    const screenshotContainer = document.getElementById('screenshot-container');

    return new Promise((resolve: any) => {
        if (screenshotContainer) {
            if (options?.fadeOutDurationInMilliSeconds) {
                screenshotContainer.style.transition = `opacity ease-in-out ${options.fadeOutDurationInMilliSeconds}ms`;
                screenshotContainer.style.webkitTransition = `opacity ease-in-out ${options.fadeOutDurationInMilliSeconds}ms`;
            }
            if (options?.fadeOutPreviousFrame) {
                screenshotContainer.style.opacity = '0';
                setTimeout(
                    () => {
                        const screenshotContainerParent = screenshotContainer.parentElement;
                        if (screenshotContainerParent) {
                            screenshotContainerParent.removeChild(screenshotContainer);
                        }
                        return resolve();
                    },
                    options.fadeOutDurationInMilliSeconds ? options.fadeOutDurationInMilliSeconds : 300,
                );
            } else {
                const screenshotContainerParent = screenshotContainer.parentElement;
                if (screenshotContainerParent) {
                    screenshotContainerParent.removeChild(screenshotContainer);
                }
            }
        }
        return resolve();
    });
};

export const fadeOutScene = async (): Promise<void> => {
    const wrapper = document.getElementById('core-wrapper');
    const fadeContainer = document.createElement('div');
    fadeContainer.id = 'fade-container';
    fadeContainer.style.display = 'block';
    fadeContainer.style.backgroundColor = '#000';
    fadeContainer.style.position = 'absolute';
    fadeContainer.style.top = '0';
    fadeContainer.style.overflow = 'hidden';
    fadeContainer.style.boxSizing = 'border-box';
    fadeContainer.style.width = '100%';
    fadeContainer.style.height = '100%';
    fadeContainer.style.padding = '0';
    fadeContainer.style.margin = '0';
    fadeContainer.style.border = '0';
    fadeContainer.style.fontSize = '0';
    fadeContainer.style.opacity = '0';
    fadeContainer.style.transition = 'opacity ease-in-out 1s';
    fadeContainer.style.webkitTransition = 'opacity ease-in-out 1s';
    wrapper.appendChild(fadeContainer);

    return new Promise((resolve) => {
        setTimeout(() => {
            fadeContainer.style.opacity = '1';

            setTimeout(() => {
                return resolve();
            }, 1000);
        }, 300);
    });
};

export const fadeInScene = async () => {
    const wrapper = document.getElementById('core-wrapper');
    const fadeContainer = document.getElementById('fade-container');
    if (wrapper && fadeContainer) {
        return new Promise((resolve: any) => {
            fadeContainer.style.transition = 'opacity ease-in-out 500ms';
            fadeContainer.style.webkitTransition = 'opacity ease-in-out 500ms';
            fadeContainer.style.opacity = '0';
            setTimeout(() => {
                wrapper.removeChild(fadeContainer);
                return resolve(undefined);
            }, 500);
        });
    }
    return undefined
};

let statsLoopIsRunning = false;
let pdiStatsElement: HTMLElement;
let fpsStatsElement: HTMLElement;
let hwScalingIndicatorElement: HTMLElement;

export const toggleStats = async (engine: Engine) => {
    const statsWrapperElement = document.getElementById('core-stats-wrapper');

    if (statsWrapperElement) {
        removeStats(statsWrapperElement);
    } else {
        showStats(engine);
    }
};

const removeStats = (statsWrapperElement: HTMLElement) => {
    statsWrapperElement.remove();
};

const showStats = (engine: Engine) => {
    const statsWrapperElement = document.createElement('div');
    statsWrapperElement.id = 'core-stats-wrapper';
    statsWrapperElement.style.position = 'fixed';
    statsWrapperElement.style.bottom = '0';
    statsWrapperElement.style.fontSize = '12px';
    statsWrapperElement.style.paddingBottom = '70px';

    const coreWrapperElement = document.getElementById('core-wrapper');
    coreWrapperElement.appendChild(statsWrapperElement);

    pdiStatsElement = document.createElement('div');
    pdiStatsElement.innerHTML = 'DPI: ' + window.devicePixelRatio;
    pdiStatsElement.style.color = 'red';
    pdiStatsElement.style.display = 'inline-block';
    pdiStatsElement.style.marginLeft = '10px';
    statsWrapperElement.appendChild(pdiStatsElement);

    fpsStatsElement = document.createElement('div');
    fpsStatsElement.innerHTML = 'FPS: ' + engine.getFps().toFixed();
    fpsStatsElement.style.color = 'red';
    fpsStatsElement.style.display = 'inline-block';
    fpsStatsElement.style.marginLeft = '10px';
    statsWrapperElement.appendChild(fpsStatsElement);

    hwScalingIndicatorElement = document.createElement('div');
    hwScalingIndicatorElement.innerHTML = 'HW-Scaling: ' + engine.getHardwareScalingLevel().toFixed(2).toString();
    hwScalingIndicatorElement.style.color = 'red';
    hwScalingIndicatorElement.style.display = 'inline-block';
    hwScalingIndicatorElement.style.marginLeft = '10px';
    statsWrapperElement.appendChild(hwScalingIndicatorElement);

    if (!statsLoopIsRunning) {
        statsLoopIsRunning = true;
        setInterval(() => {
            if (hwScalingIndicatorElement) {
                hwScalingIndicatorElement.innerHTML =
                    'HW Scaling:' + engine.getHardwareScalingLevel().toFixed(2).toString();
            }
            if (fpsStatsElement) {
                fpsStatsElement.innerHTML = 'FPS:' + engine.getFps().toFixed();
            }
        }, 1000);
    }
};
