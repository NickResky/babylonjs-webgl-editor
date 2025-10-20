import { Scene, ActionManager, ExecuteCodeAction, Mesh, ActionEvent } from 'babylonjs';
import { injectable, inject } from 'inversify';
import { TYPES } from '../ioc/types';

/**
 * Service for configuring actionmanagers
 */
@injectable()
export class ActionsService {
  /**
   * Creates a new BabylonJS based CollisionSphere Service
   * @param scene - the Babylon scene
   */
  constructor(@inject(TYPES.Scene) private _scene: Scene) {}

  /**
   * Registers a OnPick on a specific mesh
   * @param mesh -
   * @param callback - Callback function that is called on every click
   */
  public registerOnPickTrigger(mesh: Mesh, callback: Function): void {
    if (!mesh.actionManager) {
      mesh = this.addActionManagerToMesh(mesh);
    }
    mesh.actionManager.registerAction(
      new ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, (event: ActionEvent) => callback()),
    );
  }

  /**
   * Registers a OnPointerOver on a specific mesh
   * @param mesh -
   * @param callback - Callback function that is called on every click
   */
  public registerOnPointerOverTrigger(mesh: Mesh, callback: Function): void {
    if (!mesh.actionManager) {
      mesh = this.addActionManagerToMesh(mesh);
    }
    mesh.actionManager.registerAction(
      new ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, (event: ActionEvent) => callback()),
    );
  }

  /**
   * Registers a OnPointerOut on a specific mesh
   * @param mesh -
   * @param callback - Callback function that is called on every click
   */
  public registerOnPointerOutTrigger(mesh: Mesh, callback: Function): void {
    if (!mesh.actionManager) {
      mesh = this.addActionManagerToMesh(mesh);
    }
    mesh.actionManager.registerAction(
      new ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, (event: ActionEvent) => callback()),
    );
  }

  /**
   * Adds a Babylon ActionManager to a mesh
   * @param mesh -
   *
   */
  private addActionManagerToMesh(mesh: Mesh): Mesh {
    mesh.actionManager = new ActionManager(this._scene);
    return mesh;
  }
}
