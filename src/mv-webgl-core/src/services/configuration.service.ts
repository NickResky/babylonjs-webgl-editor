import { inject, injectable } from 'inversify';
import { ResolverLocator } from '../core';
import { TYPES } from '../ioc/types';
import { MVEntity } from '../models/entity/mv-entity';
import { MVLayer } from '../models/entity/mv-layer';
import { MVMaterialMapping } from '../models/material/mv-material-mapping';
import { ResolvedLayer, ResolvedMaterial } from '../resolvers/mv-resolver.interface';

/**
 * Configuration Service Class to update the layers and materials of an entity depending based on a CWS or JSON based rule engine
 */
@injectable()
export class ConfigurationService {
  /**
   * Resolves layers and materials
   * @param resolverLocator - Function that returns resolver based on entity data
   */
  constructor(@inject(TYPES.ResolverLocator) private resolverLocator: ResolverLocator) {}

  /**
   * Updates the current configuration of an entity
   * @param entity - Entity
   * @param configurationCodes - Configuration codes
   */
  public async updateConfiguration(entity: MVEntity, configurationCodes: string[]): Promise<MVEntity> {
    if(!entity) return entity;

    const resolver = this.resolverLocator(entity);

    const resolvedLayers: ResolvedLayer[] = await resolver.layers(entity, configurationCodes);
    resolvedLayers.forEach((resolvedLayer: ResolvedLayer) => {
      let layer = entity.layers.find((entityLayer: MVLayer) => entityLayer.name == resolvedLayer.layerName);
      if (!layer) {
        layer = new MVLayer(resolvedLayer.layerName, resolvedLayer.layerPaths);
        entity.addLayer(layer);
      }
      layer.visibilityState = resolvedLayer.isVisible;
    });

    const resolvedMaterials = await resolver.materials(entity, configurationCodes);
    resolvedMaterials.forEach((material: ResolvedMaterial) => {
      const { materialName, materialPath } = material;

      let materialMapping: MVMaterialMapping = entity.getMaterialMapping(materialName);

      if (!materialMapping) {
        materialMapping = new MVMaterialMapping(materialName, materialPath);
        entity.addMaterialMapping(materialMapping);
      } else {
        materialMapping.mapping = materialPath;
      }
    });

    entity.activeConfigurationCodes = configurationCodes;

    return Promise.resolve(entity);
  }

  disableAllLayers(entity: MVEntity) {
    entity.layers.forEach(layer => {
      layer.previousVisibilityState = false;
      layer.visibilityState = false;
    });

    entity.activeConfigurationCodes = null;
  }
}
