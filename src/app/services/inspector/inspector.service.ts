import { DebugLayer, IInspectorOptions, NodeMaterial, Observable, Scene } from 'babylonjs';
import { Subject } from 'rxjs';

// @ts-ignore
export class MVDebugLayer extends DebugLayer {
  constructor(scene: Scene) {
    super(scene);
  }

  public getOpenNodeMaterialEditorEvent(): Observable<NodeMaterial> {
    //@ts-ignore
    return this.BJSINSPECTOR.openNodeMaterialEditorEvent$;
  }

  public getInspectorMaterialTextureChangeEvent(): Subject<{
    file: File;
    material: any;
    props: any;
  }> {
    //@ts-ignore
    return this.BJSINSPECTOR.materialTextureChangeEvent$;
  }

  public getInspectorMaterialTextureRemovedEvent(): Subject<{
    material: any;
    textureType: string;
  }> {
    //@ts-ignore
    return this.BJSINSPECTOR.materialTextureRemovedEvent$;
  }

  public getInspectorEnvironmentTextureChangeEvent(): Subject<{ file: File }> {
    //@ts-ignore
    return this.BJSINSPECTOR.updateEnvironmentTextureCallback$;
  }

  private override _createInspector(config?: Partial<IInspectorOptions>) {
    if (this.isVisible()) {
      return;
    }

    // @ts-ignore
    if (this._onPropertyChangedObservable) {
      // @ts-ignore
      for (var observer of this._onPropertyChangedObservable!.observers) {
        // @ts-ignore
        this.BJSINSPECTOR.Inspector.OnPropertyChangedObservable.add(observer);
      }
      // @ts-ignore
      this._onPropertyChangedObservable.clear();
      // @ts-ignore
      this._onPropertyChangedObservable = undefined;
    }

    const userOptions: IInspectorOptions = {
      overlay: false,
      showExplorer: true,
      showInspector: true,
      embedMode: false,
      handleResize: true,
      enablePopup: true,
      inspectorURL: '',
      ...config,
    };

    // @ts-ignore
    this.BJSINSPECTOR = new MVInspector();
    // @ts-ignore
    this.BJSINSPECTOR.Inspector.Show(this._scene, userOptions);
  }

  /**
   * Launch the debugLayer.
   * @param config Define the configuration of the inspector
   * @return a promise fulfilled when the debug layer is visible
   */
  public override show(config?: IInspectorOptions): Promise<DebugLayer> {
    return new Promise((resolve, reject) => {
      this._createInspector(config);
      //@ts-ignore
      resolve(this);
    });
  }
}
