import { MVLogger } from '../logging';
import {
    MVMaterialMappingJson,
    MVMaterialScheme,
    MVRuleEngineProperty,
    MVSwitchMaterialMapping,
} from '../models/configuration/interfaces';
import { MVEntity } from '../models/entity/mv-entity';
import { MVMaterialMapping } from '../models/material/mv-material-mapping';
import { ResolvedLayer, ResolvedMaterial } from './mv-resolver.interface';

/**
 * Resolver Base Class
 */
export class BaseResolver {
    file_registry: { [key: string]: Promise<string[]> } = {};

    /**
     * Assembles entity path based on entiy data
     * @param entity -
     *
     */
    public entityPath(entity: MVEntity): Promise<string> {
        let url = '';
        if (window?.location) {
            url = `${window.location.origin}/${entity.entityConfig.entityConfigBaseUrl}`;
        } else {
            url = `${entity.entityConfig.entityConfigBaseUrl}`;
        }

        return Promise.resolve(url);
    }

    /**
     * Resolves layers data
     * @param entity -
     * @param configuration -
     *
     */
    public async layers(
        entity: MVEntity,
        configuration: string[],
        withNonConfigurableLayers: boolean = true,
    ): Promise<ResolvedLayer[]> {
        if (!entity) return [];

        const configurationOptionsArray = !!configuration.length
            ? configuration
            : [...entity.mv_ruleEngineConfig.defaultConfigurationCodes];

        let registry;
        if (!entity.mv_glbMetaData) {
            try {
                const registryResponse = await fetch(entity.meshesBaseUrl + 'glbFileRegistry.json', {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                });
                registry = await registryResponse.json();
            } catch (error) {
                MVLogger.error(`glbFileRegistry.json not found in ${entity.meshesBaseUrl}`);
            }
        }

        // Add a new layer for every nonConfigurableLayer in the rule engine.
        let nonConfigurableLayers: ResolvedLayer[] = [];
        if (withNonConfigurableLayers) {
            nonConfigurableLayers = entity.mv_ruleEngineConfig.nonConfigurableLayers.reduce(
                (layers: ResolvedLayer[], nonConfigurableFileName: string) => {
                    const path = `${nonConfigurableFileName}.glb`;
                    if (entity.mv_glbMetaData) {
                        const layerFileExists = entity.mv_glbMetaData[nonConfigurableFileName];
                        if (layerFileExists) {
                            layers.push({ layerName: nonConfigurableFileName, isVisible: true, layerPaths: [path] });
                        }
                    } else if (registry) {
                        const files = registry.filter(
                            (fileName: string) =>
                                fileName == nonConfigurableFileName + '.glb' ||
                                fileName.startsWith(nonConfigurableFileName + '_socket_') ||
                                fileName.startsWith(nonConfigurableFileName + '_RT') ||
                                fileName.startsWith(nonConfigurableFileName + '_LOD') ||
                                fileName.startsWith(nonConfigurableFileName + '_part_'),
                        );
                        if (files.length > 0) {
                            layers.push({ layerName: nonConfigurableFileName, isVisible: true, layerPaths: files });
                        }
                    }

                    return layers;
                },
                [],
            );
        }

        const configurableLayers: ResolvedLayer[] = entity.mv_ruleEngineConfig?.properties.reduce(
            (acc: ResolvedLayer[], property: MVRuleEngineProperty) => {
                const propertyIsActive = configurationOptionsArray.includes(property.code);
                const layers = property.layerNames || [];

                const states = layers.map((p: string) => {
                    const path = `${p}.glb`;
                    let layerPaths = [path];
                    if (entity.mv_glbMetaData) {
                        const layerFileExists = entity.mv_glbMetaData[p];
                        if (!layerFileExists) {
                            layerPaths = [];
                        }
                    }
                    return { layerName: p, isVisible: propertyIsActive, layerPaths: layerPaths };
                });

                return [...acc, ...states];
            },
            [] as ResolvedLayer[],
        );

        const arr: ResolvedLayer[] = [...(nonConfigurableLayers || []), ...(configurableLayers || [])];
        return Promise.resolve(arr);
    }

    /**
     * Resolves materials data
     * @param entity -
     * @param configuration -
     *
     */
    public async materials(
        entity: MVEntity,
        configuration: string[],
        withAllocators: boolean = true,
    ): Promise<ResolvedMaterial[]> {
        if (!entity) return [];

        const configurationOptionsArray = !!configuration.length
            ? configuration
            : [...entity.mv_ruleEngineConfig.defaultConfigurationCodes];

        MVLogger.debug('CONFIGURATIONS: ', JSON.stringify(configurationOptionsArray));

        // Add the material allocators specified in the material_mappings.json file to the entity for better maintenance.
        let materialAllocators: ResolvedMaterial[] = [];
        if (withAllocators) {
            materialAllocators = entity.mv_materialMappings.materialAllocators.map(
                (materialAllocatorMapping: MVMaterialMappingJson) => {
                    return {
                        materialName: materialAllocatorMapping.name,
                        materialPath: materialAllocatorMapping.mapping,
                    };
                },
            );
        }

        const switchMaterials: ResolvedMaterial[] = entity.mv_ruleEngineConfig?.properties
            .filter((p: MVRuleEngineProperty) => configurationOptionsArray.includes(p.code) && p.materialSchemes)
            .reduce((acc: MVMaterialScheme[], property: MVRuleEngineProperty) => {
                acc = [...acc, ...property.materialSchemes];
                return acc;
            }, [] as MVMaterialScheme[])
            .reduce((acc: ResolvedMaterial[], materialScheme: MVMaterialScheme) => {
                if (materialScheme.condition && !configuration.includes(materialScheme.condition)) {
                    // condition is false
                    return acc;
                }
                const switchMaterialMapping = entity.mv_materialMappings.switchMaterials.find(
                    (p: MVSwitchMaterialMapping) => p.name === materialScheme.switchMaterialName,
                );
                if (!switchMaterialMapping) {
                    MVLogger.warn(
                        `No switch material mapping found for ${materialScheme.switchMaterialName} inside of ${entity.entityConfig.materialMappingsUrlRelative}`,
                    );
                    return acc;
                }
                const slot = switchMaterialMapping.slots.find(
                    (p: MVMaterialMapping) => p.name === materialScheme.switchMaterialSlot,
                );
                if (slot) {
                    const resolvedMaterial: ResolvedMaterial = {
                        materialName: materialScheme.switchMaterialName,
                        materialPath: slot.mapping,
                    };
                    const indexOfResolvedMaterial = acc.findIndex((mat: ResolvedMaterial) => {
                        return mat.materialName == materialScheme.switchMaterialName;
                    });
                    if (indexOfResolvedMaterial >= 0 && materialScheme.condition) {
                        acc[indexOfResolvedMaterial] = resolvedMaterial;
                    } else {
                        acc = [...acc, resolvedMaterial];
                    }
                }
                return acc;
            }, [] as ResolvedMaterial[]);

        const arr = [...(switchMaterials || []), ...(materialAllocators || [])];

        return Promise.resolve(arr);
    }
}
