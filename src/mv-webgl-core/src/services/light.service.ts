import {
    Animation,
    Color3,
    DirectionalLight,
    HemisphericLight,
    InspectableType,
    Light,
    PointLight,
    Scene,
    SpotLight,
    Vector3
} from 'babylonjs';
import { inject, injectable } from 'inversify';
import { isBoolean, isNumber, isString, isVector3Array } from '../helper';
import { TYPES } from '../ioc/types';
import { MVLogger } from '../logging';

/**
 * The class for all Babylon related Light functionality
 */

@injectable()
export class LightService {
    /**
     * Creates a new LightService
     * @param scene -
     */
    constructor(@inject(TYPES.Scene) private _scene: Scene) {}

    /**
     * Parse lights
     * @param lightJSON -
     * @param entityUuid -
     */
    public parseLight(lightJSON: any, entityUuid: string): void {
        switch (lightJSON.type) {
            case 0:
                const pointLight = new PointLight(
                    lightJSON.name,
                    new Vector3(
                        lightJSON.position[0],
                        lightJSON.position[1],
                        lightJSON.position[2]
                    ),
                    this._scene
                );
                pointLight.inspectableCustomProperties = [];
                pointLight.inspectableCustomProperties.push({
                    label: 'Radius 0-10',
                    propertyName: 'radius',
                    type: InspectableType.Slider,
                    min: 0,
                    max: 10
                });
                pointLight.inspectableCustomProperties.push({
                    label: 'Radius 0-1',
                    propertyName: 'radius',
                    type: InspectableType.Slider,
                    min: 0,
                    max: 1
                });
                this.applyLightSettings(pointLight, lightJSON, entityUuid);
                break;
            case 1:
                const directionalLight = new DirectionalLight(
                    lightJSON.name,
                    new Vector3(
                        lightJSON.direction[0],
                        lightJSON.direction[1],
                        lightJSON.direction[2]
                    ),
                    this._scene
                );
                this.applyLightSettings(
                    directionalLight,
                    lightJSON,
                    entityUuid
                );
                break;
            case 2:
                const spotLight = new SpotLight(
                    lightJSON.name,
                    new Vector3(
                        lightJSON.position[0],
                        lightJSON.position[1],
                        lightJSON.position[2]
                    ),
                    new Vector3(
                        lightJSON.direction[0],
                        lightJSON.direction[1],
                        lightJSON.direction[2]
                    ),
                    lightJSON.angle,
                    lightJSON.exponent,
                    this._scene
                );
                this.applyLightSettings(spotLight, lightJSON, entityUuid);
                break;
            case 3:
                const hemisphericLight = new HemisphericLight(
                    lightJSON.name,
                    new Vector3(
                        lightJSON.direction[0],
                        lightJSON.direction[1],
                        lightJSON.direction[2]
                    ),
                    this._scene
                );
                this.applyLightSettings(
                    hemisphericLight,
                    lightJSON,
                    entityUuid
                );
                break;
            default:
                MVLogger.error('Light needs a type! ' + lightJSON);
        }
    }

    /**
     * Applies settings to an existing light
     * @param light - a Babylon light
     * @param settings - settings
     * @param entityUuid -
     */
    public applyLightSettings(
        light: PointLight | DirectionalLight | SpotLight | HemisphericLight,
        settings: Light,
        entityUuid: string
    ): void {
        // Link light to entity it belongs to
        if (!light.inspectableCustomProperties) {
            light.inspectableCustomProperties = [];
        }
        light.inspectableCustomProperties.push({
            label: 'Entity Reference',
            propertyName: 'entityReference',
            type: InspectableType.String
        });
        light['entityReference'] = entityUuid;

        for (const [key, value] of Object.entries(settings)) {
            if (key.toLowerCase() === 'direction') {
                // handle light direction
                if (isVector3Array(value)) {
                    light.direction = new Vector3(value[0], value[1], value[2]);
                }
            } else if (key.toLowerCase() === 'position') {
                if (isVector3Array(value)) {
                    light['position'] = new Vector3(
                        value[0],
                        value[1],
                        value[2]
                    );
                }
            } else if (isVector3Array(value)) {
                // handle light colors
                light[key] = new Color3(value[0], value[1], value[2]);
            } else if (key.toLowerCase() === 'animations' && false) {
                // handle animations
                light[key] = [];
                value.map((animation: Animation) => {
                    light[key].push(
                        new Animation(
                            animation.name,
                            animation.targetProperty,
                            animation.framePerSecond,
                            animation.dataType,
                            isNumber(animation.loopMode)
                                ? animation.loopMode
                                : null,
                            isBoolean(animation.enableBlending)
                                ? animation.enableBlending
                                : null
                        )
                    );
                });
            } else if (
                key.toLowerCase() == 'intensity' &&
                (isString(value) || isNumber(value) || isBoolean(value))
            ) {
                light[key] = value;
            }
        }
    }
}
