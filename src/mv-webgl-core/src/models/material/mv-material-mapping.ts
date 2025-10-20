import { AbstractMesh } from 'babylonjs';

/**
 * Material mapping class for a switch material or material allocator.
 */
export class MVMaterialMapping {
  public name: string;
  public mapping: string;
  public meshes: AbstractMesh[] = [];

  /**
   * Creates a new material mapping for a material allocator or switch material.
   * Switch materials have to initialize the property "slots".
   * Material allocators have to initialize the property "mapping".
   * @param name -
   * @param mapping -
   * @param slots -
   */
  constructor(name: string, mapping: string | null) {
    this.name = name;
    if (mapping) {
      this.mapping = mapping;
    }
  }

  /**
   * Adds a mesh to the material mapping (only for switch materials)
   * @param mesh -
   */
  public addMesh(mesh: AbstractMesh): void {
    this.meshes.push(mesh);
  }

  public removeMesh(mesh: AbstractMesh): void {
    const index = this.meshes.indexOf(mesh);
    if (index !== -1) {
      this.meshes[index] = this.meshes[this.meshes.length -1];
      this.meshes.pop();
    }
  }
}
