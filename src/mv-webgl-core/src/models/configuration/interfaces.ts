export enum MVRuleEngineTypes {
    /** JSON-Type for MVRuleEngineTypes */
    'JSON' = 'JSON',
    /** CWS-Type for MVRuleEngineTypes */
    'CWS' = 'CWS',
}

/**
 * Interfaces for Rule Engine files
 * (productName_rule_engine.json)
 */
export interface MVRuleEngineJson {
    /** List of Configuration Codes that are activated by default after the entity is loaded in the Editor */
    defaultConfigurationCodes: string[];
    /** List of non configurable Layers/GLB Files that are always displayed */
    nonConfigurableLayers: string[];
    /** List of properties that define configuration options */
    properties: MVRuleEngineProperty[];
    /** */
    nonConfigurableFileName?: string;
}

export interface MVRuleEngineProperty {
    /** configuration code of the property */
    code: string;
    /** list of layers that are activated with this property */
    layerNames?: string[];
    /** list of material schemes that define switch materials */
    materialSchemes?: MVMaterialScheme[];
}

export interface MVMaterialScheme {
    /** defines switch material name */
    switchMaterialName: string;
    /** defines the name of the switch material slot that is supposed to be mapped */
    switchMaterialSlot: string;
    /** condition of the material schema (code that must be active) */
    condition?: string;
}

/**
 * Defines a mapping from original material name to target material url
 */
export interface MVMaterialMappingJson {
    /** Name of the original Material */
    name: string;
    /** URL of the target material */
    mapping: string;
}

/**
 * Interfaces for Switch Material Mapping files
 * (productName_material_mappings.json)
 */
export interface MVMaterialMappingsJson {
    /** List of material allocator mappings */
    materialAllocators: MVMaterialMappingJson[];
    /** List of the switch material mappings */
    switchMaterials: MVSwitchMaterialMapping[];
}

export interface MVSwitchMaterialMapping {
    /** Name of the switch material  */
    name: string;
    /** All available slots for switch material */
    slots: MVMaterialMappingJson[];
}

/**
 * Interface for preloading materials
 */
export interface GLBMaterialMapping {
    /** GLB file name as key and string array with materials */
    [key: string]: string[];
}
