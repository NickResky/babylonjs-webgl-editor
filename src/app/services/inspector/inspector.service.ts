import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
    DebugLayer,
    IInspectorOptions,
    InspectableType,
    LensFlare,
    Material,
    Mesh,
    NodeMaterial,
    Observable,
    PBRMetallicRoughnessBlock,
    Scene,
    Texture,
    Tools
} from 'babylonjs';
import { NodeEditor } from 'babylonjs-node-editor';
import { Core, MVCamera, MVMaterial } from 'mv-core';
import { Subject, take } from 'rxjs';
import { BackgroundEditorComponent } from '../../view-components/background-editor/background-editor.component';
import { FileNameDialogComponent } from '../../view-components/file-name-dialog/file-name-dialog.component';
import { ActionItemService } from '../action-item/action-item.service';
import { CameraService } from '../camera/camera.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { DataService, ProjectSettings } from '../data/data.service';
import { EnvironmentService } from '../environment/environment.service';
import { FileAccessService } from '../file-access/file-access.service';
import { MaterialService } from '../material/material.service';
import { MeshService } from '../mesh/mesh.service';
import { NotifierService } from '../notifier/notifier.service';

@Injectable({
    providedIn: 'root'
})
export class InspectorService {
    private scene: Scene;
    private _core: Core;
    private _projectSettings: ProjectSettings;
    private _nodeEditorStylesheetAddedToDocument = false;
    public isInspectorOpen = false;
    public _fileNameDialogRef: MatDialogRef<FileNameDialogComponent>;

    constructor(
        private configurationService: ConfigurationService,
        private fileAccessService: FileAccessService,
        private materialService: MaterialService,
        private meshService: MeshService,
        private cameraService: CameraService,
        private environmentService: EnvironmentService,
        private dataService: DataService,
        private notifierService: NotifierService,
        private actionItemService: ActionItemService,
        private dialog: MatDialog,
        private _fileAccessService: FileAccessService
    ) {
        dataService.projectSettings$.subscribe((settings: ProjectSettings) => {
            this._projectSettings = settings;
        });

        dataService.core$.subscribe((core: Core) => {
            this._core = core;
        });
    }

    toggleInspector(scene: Scene, rootElement: HTMLElement) {
        if (this.isInspectorOpen) {
            this.scene.debugLayer.hide();
            this.isInspectorOpen = false;
        } else {
            this.openInspector(scene, rootElement);
        }
    }

    openInspector(scene: Scene, rootElement: HTMLElement) {
        this.isInspectorOpen = true;
        this.scene = scene;
        this.scene.debugLayer.show({
            globalRoot: rootElement,
            explorerExtensibility: [
                {
                    predicate: (material) =>
                        material.getClassName &&
                        material.getClassName().indexOf('Material') !== -1,
                    entries: [
                        {
                            label: 'Save',
                            action: (material) => {
                                const isLightmapMaterial =
                                    material['isLightmapMaterial'];

                                if (!isLightmapMaterial) {
                                    this.materialService.onMaterialSavedClicked(
                                        this._projectSettings.baseProjectUrl,
                                        material
                                    );
                                } else {
                                    const parentMaterial =
                                        this.scene.materials.find(
                                            (patentMaterial) =>
                                                patentMaterial.name ===
                                                material['parentMaterialName']
                                        ) as MVMaterial;
                                    this.materialService.onMaterialSavedClicked(
                                        this._projectSettings.baseProjectUrl,
                                        parentMaterial
                                    );
                                }
                                this.toggleInspector(scene, rootElement);
                                this.toggleInspector(scene, rootElement);
                                this.scene.debugLayer.select(material);
                            }
                        },
                        {
                            label: 'Rename',
                            action: (material) => {
                                this.toggleInspector(scene, rootElement);
                                this.toggleInspector(scene, rootElement);
                                this.scene.debugLayer.select(material);

                                this._fileNameDialogRef = this.dialog.open(
                                    FileNameDialogComponent,
                                    {
                                        hasBackdrop: false,
                                        disableClose: true,
                                        closeOnNavigation: false,
                                        data: {
                                            description: 'Material name',
                                            placeholder:
                                                'Enter new material name',
                                            fileName: material.name.replace(
                                                '.json',
                                                ''
                                            ),
                                            isRenameMaterialDialog: true
                                        }
                                    }
                                );

                                this._fileNameDialogRef
                                    .afterClosed()
                                    .subscribe(
                                        async (response: {
                                            fileName: string;
                                            selectedEntityUrls: string[];
                                        }) => {
                                            if (response.fileName) {
                                                const newName =
                                                    response.fileName.includes(
                                                        '.json'
                                                    )
                                                        ? response.fileName
                                                        : response.fileName.concat(
                                                              '.json'
                                                          ); // makes sure that .json is included in the name

                                                // check if material name already exists
                                                const newMaterialUrl =
                                                    material.url
                                                        .replace(
                                                            material.name,
                                                            newName
                                                        )
                                                        .replace('file://', '');
                                                const exists =
                                                    await this._fileAccessService.exists(
                                                        newMaterialUrl
                                                    );

                                                if (exists) {
                                                    return this.notifierService.notify(
                                                        'error',
                                                        `Material ${newName} already exists.`
                                                    );
                                                }

                                                await this.materialService.renameMaterial(
                                                    material,
                                                    newName,
                                                    response.selectedEntityUrls
                                                );
                                                this.notifierService.notify(
                                                    'success',
                                                    `Material successfully renamed to ${newName}.`
                                                );

                                                this.toggleInspector(
                                                    this.scene,
                                                    rootElement
                                                );
                                                this.toggleInspector(
                                                    this.scene,
                                                    rootElement
                                                );
                                                this.scene.debugLayer.select(
                                                    material
                                                );
                                            }
                                        }
                                    );
                            }
                        }
                    ]
                },
                {
                    predicate: (entity) =>
                        entity.getClassName &&
                        entity.getClassName().indexOf('ArcRotateCamera') !== -1,
                    entries: [
                        // {
                        //   label: 'Save Camera',
                        //   action: (entity) => this.cameraService.updateCamera(),
                        // },
                        {
                            label: 'Toggle Target Helper',
                            action: (entity) =>
                                this.cameraService.toggleMainCameraTargetHelper()
                        }
                    ]
                },
                {
                    predicate: (entity) =>
                        entity.getClassName &&
                        entity.getClassName().indexOf('Scene') !== -1,
                    entries: [
                        {
                            label: 'Save Environment',
                            action: (entity: Scene) =>
                                this.environmentService.onEnvironmentSavedClicked(
                                    this._projectSettings.baseProjectUrl,
                                    entity
                                )
                        },
                        {
                            label: 'Save Action Items',
                            action: () =>
                                this.actionItemService.updateActionItemsPosition()
                        }
                    ]
                },
                {
                    predicate: (mesh) =>
                        mesh.getClassName &&
                        mesh.getClassName().indexOf('Mesh') !== -1,
                    entries: [
                        {
                            label: 'Save Mesh Setting',
                            action: (mesh: Mesh) => {
                                this.toggleInspector(scene, rootElement);
                                this.toggleInspector(scene, rootElement);

                                this.meshService.onSaveMeshSettingsClicked(
                                    mesh
                                );

                                this.toggleInspector(scene, rootElement);
                                this.toggleInspector(scene, rootElement);
                                this.scene.debugLayer.select(mesh);
                            }
                        }
                    ]
                }
            ]
        });
        if (false && this.scene.debugLayer.onPropertyChangedObservable) {
            this.scene.debugLayer.onPropertyChangedObservable.add(
                (result: { object: any; property: string; value: any }) => {
                    const isMVCamera =
                        result.object.getClassName() == 'ArcRotateCamera' &&
                        result.object.isMVCamera;
                    const isTexture = result.object
                        .getClassName()
                        .toLowerCase()
                        .includes('texture');
                    const isLightmapTexture =
                        isTexture && result.object.isLightmapTexture;
                    const isMVNodeMaterial = result.object['isMVNodeMaterial'];
                    const isLensFlareSystemEmitter =
                        result.object.name == 'lensFlareSystemEmitter';
                    const isFlareHelper = result.object['lensFlare'];

                    if (isMVCamera) {
                        const mvCamera = result.object as MVCamera;
                        if (result.property == 'orbitBehaviourEnabled') {
                            if (result.value) {
                                mvCamera.unlockRotation();
                            } else {
                                mvCamera.lockRotation();
                            }
                        } else if (result.property == 'zoomBehaviourEnabled') {
                            if (result.value) {
                                mvCamera.unlockZoom();
                            } else {
                                mvCamera.lockZoom();
                            }
                        } else if (
                            result.property == 'lowerAlphaLimitDegrees'
                        ) {
                            mvCamera.lowerAlphaLimit = Tools.ToRadians(
                                result.value
                            );
                        } else if (
                            result.property == 'upperAlphaLimitDegrees'
                        ) {
                            mvCamera.upperAlphaLimit = Tools.ToRadians(
                                result.value
                            );
                        } else if (result.property == 'lowerAlphaLimit') {
                            mvCamera.lowerAlphaLimitDegrees = Tools.ToDegrees(
                                result.value
                            );
                        } else if (result.property == 'upperAlphaLimit') {
                            mvCamera.upperAlphaLimitDegrees = Tools.ToDegrees(
                                result.value
                            );
                        }

                        return;
                    }

                    if (result.object.isMVMaterial) {
                        const updatedMaterial: MVMaterial = result.object;

                        let affectedMaterials: Material[] =
                            this.materialService.getParentAndAffectedMaterials(
                                updatedMaterial
                            ).affectedMaterials;
                        affectedMaterials.forEach(
                            (material) =>
                                (material[result.property] = result.value)
                        );

                        // necessary for babylon version < 5.0.0-alpha.24 because of missing trashcan button to delete textures from materials
                        if (
                            result.property.startsWith('delete') &&
                            result.property.endsWith('Texture')
                        ) {
                            let textureType =
                                result.property.split('delete')[1];
                            textureType =
                                textureType.charAt(0).toLowerCase() +
                                textureType.slice(1); // to lower case
                            updatedMaterial[textureType] = null;
                            affectedMaterials.forEach(
                                (material) => (material[textureType] = null)
                            );

                            setTimeout(() => {
                                updatedMaterial[result.property] = false;
                            }, 700);
                        }
                    }

                    if (isLightmapTexture) {
                        if (result.property == 'level') {
                            this.materialService.gradeLightmapTextures(
                                result.value
                            );
                        }
                    }

                    if (isMVNodeMaterial) {
                        const nodeMaterial = result.object as NodeMaterial;
                        const pbrMetallicRoughnessBlock =
                            nodeMaterial.getBlockByName(
                                'PBRMetallicRoughness'
                            ) as PBRMetallicRoughnessBlock;
                        if (result.property == 'mv_environmentIntensity') {
                            pbrMetallicRoughnessBlock.environmentIntensity =
                                result.value;
                        }

                        if (result.property == 'mv_directIntensity') {
                            pbrMetallicRoughnessBlock.directIntensity =
                                result.value;
                        }

                        if (result.property == 'mv_specularIntensity') {
                            pbrMetallicRoughnessBlock.specularIntensity =
                                result.value;
                        }

                        if (result.property == 'mv_unlit') {
                            pbrMetallicRoughnessBlock.unlit = result.value;
                        }

                        if (result.property == '_metallicF0Factor') {
                            pbrMetallicRoughnessBlock['_metallicF0Factor'] =
                                result.value;
                        }

                        nodeMaterial.build();
                    }

                    if (isLensFlareSystemEmitter) {
                        if (result.property == 'lensFlareSystemIntensity') {
                            this._core.Environment.updateLensFlareIntensity(
                                result.value
                            );
                        }
                    }

                    if (isFlareHelper) {
                        const lensFlare: LensFlare = result.object['lensFlare'];

                        if (lensFlare) {
                            if (result.property == 'flareIntensity') {
                                lensFlare['flareIntensity'] = result.value;
                            }
                            if (result.property == 'flarePosition') {
                                lensFlare['position'] = result.value;
                            }
                            if (result.property == 'flareColor') {
                                lensFlare['color'] = result.value;
                            }
                            if (result.property == 'flareSize') {
                                lensFlare['size'] = result.value;
                            }
                        }
                    }
                }
            );
        }

        if (true) {
            const inspectorMaterialTextureChangeEvent = new Subject<{
                file: File;
                material: MVMaterial;
                propertyName: string;
            }>();
            (window as any)['textureCallback'] =
                inspectorMaterialTextureChangeEvent;

            (window as any)['textureCallback']
                ?.asObservable()
                .subscribe(
                    async (data: { file: File; material: any; props: any }) => {
                        // Handle Material texture event
                        const file = data.file;
                        const material = data.material;

                        const paths = (window as any).electronAPI.findFiles(
                            file.name,
                            [
                                this._projectSettings.baseProjectUrl.replace(
                                    'file://',
                                    ''
                                ) + '/materials',
                                this._projectSettings.baseProjectUrl.replace(
                                    'file://',
                                    ''
                                ) + '/textures',
                                this._projectSettings.baseProjectUrl.replace(
                                    'file://',
                                    ''
                                ) + '/environments'
                            ]
                        );

                        if (paths.length > 1) {
                            this.notifierService.notify(
                                'error',
                                `Multiple files with the name ${file.name} found in your project. Please make sure all your files have unique names.`
                            );
                            return;
                        }

                        let absoluteTextureUrl = paths[0].replace(/\\/g, '/'); // necessary for windows file system
                        const baseProjectUrl =
                            this._projectSettings.baseProjectUrl
                                .replace(/\\/g, '/')
                                .replace('file://', '');

                        if (!absoluteTextureUrl.includes(baseProjectUrl)) {
                            this.notifierService.notify(
                                'error',
                                'Please select a texture within your project directory.'
                            );
                            return;
                        }

                        let relativeTexturePath = absoluteTextureUrl.replace(
                            baseProjectUrl,
                            ''
                        );
                        relativeTexturePath = relativeTexturePath.replace(
                            this.dataService.getActiveEntity().entityConfig
                                .texturesUrlRelative,
                            ''
                        );
                        if (!this.dataService.allowUppercase) {
                            if (
                                this.fileAccessService.hasUpperCase(file.name)
                            ) {
                                const errorMessage = `${relativeTexturePath} contains characters with capital letters. This can cause errors. Only "a-z","0-9","-","_" are allowed. Please rename the file before you import it!`;
                                this.notifierService.notify(
                                    'error',
                                    errorMessage
                                );
                                console.warn(errorMessage);
                                return;
                            }
                        }
                        if (
                            this.fileAccessService.hasInvalidCharacters(
                                file.name
                            )
                        ) {
                            const errorMessage = `${relativeTexturePath} includes forbidden characters. Only "a-z","0-9","-","_" are allowed. Please rename the file before you import it!`;
                            this.notifierService.notify('error', errorMessage);
                            console.warn(errorMessage);
                            return;
                        }

                        const materialName = material.name;
                        const textureBasePath =
                            baseProjectUrl +
                            this._projectSettings.entityConfigFile
                                .texturesUrlRelative;

                        let textureType = data.props.propertyName
                            ? data.props.propertyName
                            : data.props.label;

                        if (textureType.toLowerCase() == 'detailmap') {
                            textureType = 'detailMap';
                        }

                        const parentAndAffectedMaterials =
                            this.materialService.getParentAndAffectedMaterials(
                                material
                            );
                        const affectedMaterials =
                            parentAndAffectedMaterials.affectedMaterials;
                        const parentMaterial =
                            parentAndAffectedMaterials.parentMaterial;

                        const texture: Texture =
                            await this.materialService.updateTextureOnMaterial(
                                absoluteTextureUrl,
                                relativeTexturePath,
                                this._projectSettings.baseProjectUrl,
                                parentMaterial.id,
                                textureType,
                                this.scene,
                                parentMaterial,
                                textureBasePath
                            );

                        if (
                            textureType.includes('opacity') &&
                            (file as any).path.includes('.jpg')
                        ) {
                            texture.getAlphaFromRGB = true;
                        }

                        texture.inspectableCustomProperties = [];
                        texture.inspectableCustomProperties.push({
                            label: 'Get Alpha from RBG',
                            propertyName: 'getAlphaFromRGB',
                            type: InspectableType.Checkbox
                        });

                        affectedMaterials.forEach(
                            (affectedMaterial: Material) => {
                                affectedMaterial[textureType] = texture;
                            }
                        );

                        this.dataService.updateTexture$.next();

                        this.notifierService.notify(
                            'success',
                            `Material: ${materialName} updated with new ${textureType}`
                        );
                    }
                );
        }
        return;
        if (
            (this.scene.debugLayer as any)
                .getInspectorMaterialTextureRemovedEvent
        ) {
            const inspectorMaterialTextureRemovedEvent = (
                this.scene.debugLayer as any
            ).getInspectorMaterialTextureRemovedEvent();
            inspectorMaterialTextureRemovedEvent?.subscribe(
                async (data: { material: any; textureType: string }) => {
                    const materialType = data.material.getClassName();

                    if (data.material[data.textureType]) {
                        data.material[data.textureType] = null;
                    } else if (materialType == 'NodeMaterial') {
                        this.materialService.removeTextureFromNodeMaterial(
                            data.material,
                            data.textureType
                        );
                    }
                }
            );
        }
        if ((this.scene.debugLayer as any).getOpenNodeMaterialEditorEvent) {
            const openNodeMaterialEditorEvent = (
                this.scene.debugLayer as any
            ).getOpenNodeMaterialEditorEvent();
            (openNodeMaterialEditorEvent as any)?.subscribe(
                (nodeMaterial: NodeMaterial) => {
                    this.openNodeEditor(nodeMaterial);
                }
            );
        }

        if (
            (this.scene.debugLayer as any)
                .getInspectorEnvironmentTextureChangeEvent
        ) {
            const environmentTextureChangeEvent = (
                this.scene.debugLayer as any
            ).getInspectorEnvironmentTextureChangeEvent();
            environmentTextureChangeEvent?.subscribe((data: { file: File }) => {
                // Handle Material texture event
                const baseProjectUrl = this._projectSettings.baseProjectUrl
                    .replace(/\\/g, '/')
                    .replace('file://', '');
                const file = data.file;
                const filePath = (file as any).path.replace(/\\/g, '/'); // necessary for windows file system
                const texturePath = filePath.replace(file.name, '');
                if (!filePath.includes(baseProjectUrl)) {
                    this.notifierService.notify(
                        'error',
                        'Please select a texture within your project directory.'
                    );
                    return;
                }

                if (!this.dataService.allowUppercase) {
                    if (this.fileAccessService.hasUpperCase(file.name)) {
                        const errorMessage = `${file.name} contains characters with capital letters. This can cause errors. Only "a-z","0-9","-","_" are allowed. Please rename the file before you import it!`;
                        this.notifierService.notify('error', errorMessage);
                        console.warn(errorMessage);
                        return;
                    }
                }
                if (this.fileAccessService.hasInvalidCharacters(file.name)) {
                    const errorMessage = `${file.name} includes forbidden characters. Only "a-z","0-9","-","_" are allowed. Please rename the file before you import it!`;
                    this.notifierService.notify('error', errorMessage);
                    console.warn(errorMessage);
                    return;
                }

                this.environmentService.updateEnvironmentTexture(
                    texturePath,
                    file.name
                );
            });
        }
    }

    public openNodeEditor(nodeMaterial: NodeMaterial) {
        const dialog = this.dialog.open(BackgroundEditorComponent, {
            hasBackdrop: true,
            height: '90%',
            width: '100%'
        });

        dialog
            .afterOpened()
            .pipe(take(1))
            .subscribe(() => {
                // @ts-ignore
                const dialogContainerElement = (
                    dialog._containerInstance as any
                )._elementRef.nativeElement;

                const parentDocument = dialog._containerInstance['_document'];

                if (!this._nodeEditorStylesheetAddedToDocument) {
                    // Add font styles to document
                    const newLinkEl = parentDocument.createElement('link');
                    newLinkEl.rel = 'stylesheet';
                    newLinkEl.href = 'https://use.typekit.net/cta4xsb.css';
                    parentDocument.head!.appendChild(newLinkEl);
                    this._nodeEditorStylesheetAddedToDocument = true;
                }

                const nodeEditor = NodeEditor;

                nodeEditor.Show({
                    hostElement: dialogContainerElement,
                    nodeMaterial: nodeMaterial,
                    customSave: {
                        label: 'custom save',
                        action: async (data: string) => {}
                    }
                });
            });
    }
}

class MVInspector {
    private _textureCallback = new Subject<{
        file: File;
        material: MVMaterial;
        propertyName: string;
    }>();
    private _textureRemovedCallback = new Subject<{
        material: Material;
        textureType: string;
    }>();
    private _updateEnvironmentTextureCallback = new Subject<{ file: File }>();
    public materialTextureChangeEvent$ = this._textureCallback.asObservable();
    public materialTextureRemovedEvent$ =
        this._textureRemovedCallback.asObservable();
    public updateEnvironmentTextureCallback$ =
        this._updateEnvironmentTextureCallback.asObservable();

    private _openNodeMaterialEditorCallback = new Subject<any>();
    public openNodeMaterialEditorEvent$ =
        this._openNodeMaterialEditorCallback.asObservable();

    public Inspector;

    constructor() {
        this.setTextureCallBack();
        this.setTextureRemovedCallback();
        this.setOpenNodeMaterialEditorCallback();
        this.setEnvironmentTextureCallBack();
    }

    private setTextureCallBack(): void {
        window['textureCallback'] = this._textureCallback;
    }

    private setTextureRemovedCallback(): void {
        window['textureRemovedCallback'] = this._textureRemovedCallback;
    }

    private setOpenNodeMaterialEditorCallback(): void {
        window['openNodeMaterialEditorCallback'] =
            this._openNodeMaterialEditorCallback;
    }
    private setEnvironmentTextureCallBack(): void {
        window['updateEnvironmentTextureCallback'] =
            this._updateEnvironmentTextureCallback;
    }
}

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

    public getInspectorEnvironmentTextureChangeEvent(): Subject<{
        file: File;
    }> {
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
                this.BJSINSPECTOR.Inspector.OnPropertyChangedObservable.add(
                    observer
                );
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
            inspectorURL: 'assets/babylon.inspector.bundle.max.8.0.0.js',
            ...config
        };

        // @ts-ignore
        // this._scene.debugLayer.show();
        // @ts-ignore
        this.BJSINSPECTOR = this._scene.inspector as any;

        // // @ts-ignore
        // this.BJSINSPECTOR = new MVInspector();
        // // @ts-ignore
        // this.BJSINSPECTOR.Inspector.Show(this._scene, userOptions);
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
