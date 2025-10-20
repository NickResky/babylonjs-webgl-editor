import { AssetContainer, Node } from 'babylonjs';
import { Subject } from 'rxjs';
import { EntityLoadingStatus } from '.';
import { AssetContainerResult } from '../..';
import { MVAnimation } from '../animation/MVAnimation';
import { MVCameraShot } from '../camera/MVCameraShot';
import { GLBMaterialMapping, MVMaterialMappingsJson, MVRuleEngineJson } from '../configuration/interfaces';
import { MVMaterialMapping } from '../material/mv-material-mapping';
import {
    GlbMetaData,
    MVEntityConfig,
    MVEnvironmentConfigs,
    MVMeshSettingsJson,
    MVProductionMeshSettingsJson,
} from './interfaces';
import { MVLayer } from './mv-layer';

/**
 * Entity class to manage a configurable product or environment.
 */
export class MVEntity {
    public readonly name: string;
    public readonly uuid: string;
    public isLoaded: boolean = false;
    public readonly cwsResourceId: string;
    public readonly cwsResourceVersionId: string;
    public readonly resourceId: string;
    public readonly entityConfig: MVEntityConfig;
    public readonly layers: MVLayer[] = [];
    public materialMappings: Map<string, MVMaterialMapping> = new Map<string, MVMaterialMapping>();
    public ruleEngineJson?: MVRuleEngineJson;
    public meshSettingsJson?: MVMeshSettingsJson;
    public productionMeshSettingsJson?: MVProductionMeshSettingsJson;
    public materialMappingsJson?: MVMaterialMappingsJson;
    public glbMaterialMapping?: GLBMaterialMapping;
    public activeConfigurationCodes: string[] = [];
    public rig: Node[];
    public rootNode: Node;
    public materialsBaseUrl: string;
    public texturesBaseUrl: string;
    public meshesBaseUrl: string;
    public meshesUrlRelative: string;
    public lightmapTexturesUrlRelative: string;
    public lightmapArrayJSON: string[] = null;
    public animations: MVAnimation[] = [];
    public assetContainers: AssetContainer[] = [];
    public loadingStatus: EntityLoadingStatus = {
        loadingProgressPercentage: 0,
        totalAssetsToLoad: 0,
        loadedAssetsCount: 0,
    };
    public onLoadingProgressUpdate$: Subject<number>;
    public readonly mv_id: string;
    public readonly mv_name: string;
    public readonly mv_actionItems: any[];
    public readonly mv_animations: any[];
    public readonly mv_animationsUrlRelative: string;
    public readonly mv_cameraCategoryTransitionsFromTo: any;
    public readonly mv_cameraShotsArr: MVCameraShot[];
    public readonly mv_lightmapOverwrites: any;
    public mv_materialMappings: MVMaterialMappingsJson;
    public readonly mv_materials: Map<string, any>;
    public readonly mv_materialsUrlRelative: string;
    public readonly mv_meshSettings: any;
    public readonly mv_productionMeshSettings: any;
    public readonly mv_meshesUrlRelative: string;
    public readonly mv_mobileTexturesUrlRelative: string;
    public readonly mv_postProcessingConfiguration: any;
    public readonly mv_productionMeshesUrlRelative: string;
    public readonly mv_rigOffset: any;
    public readonly mv_rigUrlRelative: string;
    public readonly mv_ruleEngineConfig: any;
    public readonly mv_texturesUrlRelative: string;
    public readonly mv_lightmapTextures: string[];
    public readonly mv_mobileLightmapTextures: string[];
    public readonly mv_environmentConfigs: MVEnvironmentConfigs;
    public readonly mv_glbMetaData: GlbMetaData;
    public loadNonConfigurableAssetContainerWithoutUncompressingPromise: Promise<AssetContainerResult> = null;

    /**
     * Creates a new MVEntity
     * @param entityConfig -
     * @param entityUuid -
     */
    constructor(obj: any, entityUuid: string, onLoadingProgressUpdate$: Subject<number>) {
        this.entityConfig = obj;
        this.name = obj.name;
        this.uuid = entityUuid || obj.id;
        this.onLoadingProgressUpdate$ = onLoadingProgressUpdate$;
        this.materialsBaseUrl = this.entityConfig.entityConfigBaseUrl + this.entityConfig.materialsUrlRelative;
        this.cwsResourceId = obj.cwsId;
        this.cwsResourceVersionId = obj.cwsResourceVersionId;

        this.mv_id = obj.id;
        this.mv_name = obj.name;
        this.mv_actionItems = obj.actionItems;
        this.mv_animations = obj.animations;
        this.mv_animationsUrlRelative = obj.animationsUrlRelative;
        this.mv_cameraCategoryTransitionsFromTo = obj.cameraCategoryTransitionsFromTo;
        this.mv_cameraShotsArr = obj.cameraShotsArr?.map(p => new MVCameraShot(p, p.id));
        this.mv_lightmapOverwrites = obj.lightmapOverwrites;
        this.mv_materialMappings = obj.materialMappings || [];
        this.mv_materials = obj.materials;
        this.mv_materialsUrlRelative = obj.materialsUrlRelative;
        this.mv_meshSettings = obj.meshSettings;
        this.mv_glbMetaData = obj.glbMetaData;
        this.mv_productionMeshSettings = obj.productionMeshSettings;
        this.mv_meshesUrlRelative = obj.meshesUrlRelative;
        this.mv_mobileTexturesUrlRelative = obj.mobileTexturesUrlRelative;
        this.mv_postProcessingConfiguration = obj.postProcessingConfiguration;
        this.mv_productionMeshesUrlRelative = obj.productionMeshesUrlRelative;
        this.mv_rigOffset = obj.rigOffset;
        this.mv_rigUrlRelative = obj.rigUrlRelative;
        this.mv_ruleEngineConfig = obj.ruleEngineConfig;
        this.mv_texturesUrlRelative = obj.texturesUrlRelative;
        this.mv_lightmapTextures = obj.lightmapTextures;
        this.mv_mobileLightmapTextures = obj.mobileLightmapTextures;
        this.mv_environmentConfigs = obj.environmentConfig;
    }

    /**
     * Gets the layers of the entity
     *
     */
    public getLayers(): MVLayer[] {
        return this.layers;
    }

    /**
     * Adds a layer to the entity
     * @param layer -
     */
    public addLayer(layer: MVLayer): void {
        this.layers.push(layer);
    }

    /**
     * Gets all material mappings of the entity
     *
     */
    public getMaterialMappings(): Map<string, MVMaterialMapping> {
        return this.materialMappings;
    }

    /**
     * Adds a material mapping to the entity
     * @param materialMapping -
     */
    public addMaterialMapping(materialMapping: MVMaterialMapping): void {
        this.materialMappings.set(materialMapping.name, materialMapping);
    }

    /**
     * Gets a material mapping by name
     * @param materialMappingName -
     *
     */
    public getMaterialMapping(materialMappingName: string): MVMaterialMapping {
        return this.materialMappings.get(materialMappingName);
    }

    /**
     * Gets an animation by id
     * @param id -
     */
    public getAnimation(id: string): MVAnimation {
        return this.animations.find((animation: MVAnimation) => animation.id == id);
    }

    /**
     * Gets all animations
     */
    public getAnimations(): MVAnimation[] {
        return this.animations;
    }

    /**
     * Adds an animation
     * @param animation -
     */
    public addAnimation(animation: MVAnimation): void {
        this.animations.push(animation);
    }
}
