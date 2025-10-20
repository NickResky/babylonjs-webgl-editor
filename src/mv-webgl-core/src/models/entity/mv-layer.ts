import { AbstractMesh, AssetContainer } from 'babylonjs';

/**
 * Layer class to manage a set of meshes or VSE (visualization unit)
 */
export class MVLayer {
  public name: string;
  public meshes: AbstractMesh[] = [];
  public visibilityState: boolean;
  public previousVisibilityState: boolean;
  public layerPaths: string[] = [];
  public assetContainers: AssetContainer[] = [];

  /**
   * Creates a new MVLayer
   * @param layerName - Layer Name
   * @param layerPaths -
   */
  constructor(layerName: string, layerPaths: string[]) {
    this.name = layerName;
    this.visibilityState = false;
    this.previousVisibilityState = false;
    this.layerPaths = layerPaths || [];
  }

  /**
   * Adds an array of meshes to the layer
   * @param meshes - Meshes
   */
  public addMeshes(meshes: AbstractMesh[]): void {
    meshes.forEach(mesh => {
      this.addMesh(mesh);
    });
  }

  /**
   * Adds a single mesh to the layer
   * @param mesh - Mesh
   */
  public addMesh(mesh: AbstractMesh): void {
    const alreadyExists = this.meshes.some(p => p.id === mesh.id);
    if(!alreadyExists) {
      this.meshes.push(mesh);
    }
  }

  public disposeAssetContainers(): void {
    this.assetContainers.forEach((assetContainer: AssetContainer) => {
      assetContainer.dispose();
    });
    this.assetContainers = [];
  }
}
