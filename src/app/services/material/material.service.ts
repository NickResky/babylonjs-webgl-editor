import { Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import {
    AbstractMesh,
    BaseTexture,
    InputBlock,
    Material,
    NodeMaterial,
    PBRMaterial,
    PBRMetallicRoughnessBlock,
    Scene,
    Texture,
    TextureBlock
} from 'babylonjs';
import {
    Core,
    loadJson,
    MVEntity,
    MVEntityConfig,
    MVMaterial,
    MVMaterialMappingJson,
    MVMaterialMappingsJson,
    MVSwitchMaterialMapping
} from 'mv-core';
import { createCanvas } from 'canvas';
import * as PNG from 'pngjs';
import * as jpeg from 'jpeg-js';
import { Buffer } from 'buffer';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { NewAllocatorComponent } from '../../view-components/material-editor/allocator-new/allocator-new.component';
import { MappingEditorComponent } from '../../view-components/material-editor/mapping-editor/mapping-editor.component';
import { DataService, ProjectSettings } from '../data/data.service';
import { ElectronService } from '../electron/electron.service';
import {
    FileAccessService,
    FileType
} from '../file-access/file-access.service';
import { NotifierService } from '../notifier/notifier.service';

@Injectable({
    providedIn: 'root'
})
export class MaterialService {
    public editedMapping: MVMaterialMappingJson;

    private _activeEntity: MVEntity;
    private _lightmapsActive = true;
    private _vertexColorOverwriteActive = false;

    private _materialMappingsJSON: MVMaterialMappingsJson;
    private _materialMappingsJSON$: BehaviorSubject<MVMaterialMappingsJson> =
        new BehaviorSubject({
            materialAllocators: [],
            switchMaterials: []
        });
    public materialMappingsJSON$ = this._materialMappingsJSON$.asObservable();
    private _unmappedMaterials: string[] = [];
    private _unmappedMaterials$: BehaviorSubject<string[]> =
        new BehaviorSubject([]);
    public unmappedMaterials$ = this._unmappedMaterials$.asObservable();
    public materialMappingForm?: FormGroup;
    private projectSettings: ProjectSettings;
    private core: Core;
    private _newMaterialName: string = '';
    private _newMaterialName$ = new BehaviorSubject('');
    public newMaterialName = this._newMaterialName$.asObservable();
    public loading = true;

    public defaultMaterialsUrl$: BehaviorSubject<string> = new BehaviorSubject(
        null
    );

    constructor(
        private fileService: FileAccessService,
        private electronService: ElectronService,
        private notifier: NotifierService,
        private formBuilder: FormBuilder,
        private modal: MatDialog,
        private dataService: DataService
    ) {
        combineLatest([
            this.dataService.projectSettings$,
            this.dataService.core$,
            this.dataService.activeEntity$
        ]).subscribe(async ([projectSettings, core, activeEntity]) => {
            this.projectSettings = projectSettings;
            this.core = core;
            await this.setupActiveEntity(activeEntity);
            this.loading = false;
        });
    }

    public async setupActiveEntity(entity: MVEntity) {
        this._activeEntity = entity;
        this.defaultMaterialsUrl$.next(
            this.projectSettings.baseProjectUrl.replace('file://', '') +
                this._activeEntity.entityConfig.materialsUrlRelative
        );
        await this.loadMaterialMappings();
        this.setUnmappedMaterials();
    }

    public async loadMaterialMappings() {
        const materialMappingsJSON = await this.getMaterialMapping(
            this.projectSettings.baseProjectUrl,
            this._activeEntity.entityConfig.materialMappingsUrlRelative
        );
        materialMappingsJSON.materialAllocators.sort(
            (a: MVMaterialMappingJson, b: MVMaterialMappingJson) => {
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            }
        );
        materialMappingsJSON.switchMaterials.sort(
            (a: MVSwitchMaterialMapping, b: MVSwitchMaterialMapping) => {
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            }
        );
        this.setMaterialMappingsJSON(materialMappingsJSON);
    }

    public async onMaterialSavedClicked(
        basePath: string,
        material: MVMaterial | NodeMaterial
    ): Promise<void> {
        await this.updateMaterial(basePath, material.name, material);
        this.notifier.notify('success', `Material ${material.name} saved`);
    }

    public getMaterialMapping(
        basePath: string,
        fileName: string
    ): Promise<MVMaterialMappingsJson> {
        const newPath = basePath.replace('file://', '');
        const newFileName = fileName.replace('.json', '');
        return new Promise((resolve, reject) => {
            this.fileService
                .getFile(newPath, newFileName, FileType.JSON)
                .then((data: string) => {
                    try {
                        const mappings = JSON.parse(data);
                        resolve(mappings);
                    } catch (e) {
                        reject(e);
                    }
                });
        });
    }

    public safeNewMaterialMapping(
        basePath: string,
        fileName: string,
        data: string
    ): Promise<void> {
        const newPath = basePath.replace('file://', '');
        const newFileName = fileName.replace('.json', '');
        return new Promise((resolve, reject) => {
            this.fileService
                .updateFile(newPath, newFileName, FileType.JSON, data)
                .then(() => {
                    this.notifier.notify(
                        'success',
                        `Material Mapping ${fileName} saved`
                    );
                    resolve();
                });
        });
    }

    public createMaterial(
        basePath: string,
        fileName: string,
        isNodeMaterial?: boolean
    ): Promise<void> {
        const newPath = basePath.replace('file://', '');
        const newFileName = fileName.replace('.json', '');
        let data = {};
        if (isNodeMaterial) {
            const scene = this.core.getScene();
            const newNodeMaterial = new NodeMaterial(newFileName, scene);
            newNodeMaterial.setToDefault();
            newNodeMaterial.build();
            data = newNodeMaterial.serialize();
        }
        return this.fileService.addFile(
            newPath,
            newFileName,
            FileType.JSON,
            JSON.stringify(data)
        );
    }

    collectSerializedTextures(serializedMaterial: any) {
        const out_set: any[] = [];
        // --- Standard PBR textures ---
        const standard = [
            'albedoTexture',
            'metallicTexture',
            'bumpTexture',
            'emissiveTexture',
            'ambientTexture',
            'opacityTexture'
        ];

        for (const texProp of standard) {
            const tex = serializedMaterial[texProp];
            if (tex) {
                out_set.push(tex);
            }
        }

        // --- Clear Coat textures ---
        const cc = serializedMaterial.clearCoat;
        if (cc) {
            if (cc.texture) {
                out_set.push(cc.texture);
            }
            if (cc.bumpTexture) {
                out_set.push(cc.bumpTexture);
            }
            if (cc.textureRoughness) {
                out_set.push(cc.textureRoughness);
            }
        }
        return out_set;
    }

    collectMaterialTextures(material: PBRMaterial) {
        const out_set: BaseTexture[] = [];
        // --- Standard PBR textures ---
        const standard = [
            'albedoTexture',
            'metallicTexture',
            'bumpTexture',
            'emissiveTexture',
            'ambientTexture',
            'opacityTexture'
        ];

        for (const texProp of standard) {
            const tex = material[texProp];
            if (tex) {
                out_set.push(tex);
            }
        }

        // --- Clear Coat textures ---
        const cc = material.clearCoat;
        if (cc) {
            if (cc.texture) {
                out_set.push(cc.texture);
            }
            if (cc.bumpTexture) {
                out_set.push(cc.bumpTexture);
            }
            if (cc.textureRoughness) {
                out_set.push(cc.textureRoughness);
            }
        }
        return out_set;
    }

    public async updateMaterial(
        basePath: string,
        fileName: string,
        material: MVMaterial | NodeMaterial
    ): Promise<void> {
        fileName = material['parentMaterialName']
            ? material['parentMaterialName']
            : fileName;

        const materialClassName = material.getClassName();

        if (material instanceof PBRMaterial) {
            // Collect from materials
            if (material.name.includes('Wood')) {
                debugger;
            }
            const textureSet = this.collectMaterialTextures(material);

            const path_relative = 'materials/suv/textures';
            const outDir = `${basePath.replace('file://', '')}`;

            for (const tex of textureSet) {
                if (!tex) continue;

                // Get the raw pixel data
                const buffer: any = await tex.readPixels();

                // Create a canvas to write the PNG
                const width = tex.getSize().width;
                const height = tex.getSize().height;
                const canvas = createCanvas(width, height);
                const ctx = canvas.getContext('2d');
                const imageData = ctx.createImageData(width, height);
                imageData.data.set(buffer);
                ctx.putImageData(imageData, 0, 0);

                let hasAlpha = false;
                for (let i = 3; i < buffer.length; i += 4) {
                    if (buffer[i] < 255) {
                        hasAlpha = true;
                        break;
                    }
                }
                const ext = hasAlpha ? 'png' : 'jpg';
                const texName = `${tex.name}.${ext}`;
                const filePathRelative = path_relative + '/' + texName;
                const filePath = outDir + '/' + filePathRelative;
                console.log(' → Exporting texture:', texName);

                const mime: any = hasAlpha ? 'image/png' : 'image/jpeg';
                const dataUrl = canvas.toDataURL(
                    mime,
                    hasAlpha ? undefined : 0.95
                );

                // Strip base64 header
                const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
                const fileBuffer = Buffer.from(base64, 'base64');

                (window as any).electronAPI.fsWriteFileSync(
                    filePath,
                    fileBuffer
                );
                tex.gammaSpace = true;
                tex['url'] = filePathRelative;
                if (tex['base64String']) {
                    delete tex['base64String'];
                }
            }
        }

        const materialSerialized: any = material.serialize();
        const textureSet = this.collectMaterialTextures(materialSerialized);
        for (const tex of textureSet) {
            if (!tex) continue;
            tex.gammaSpace = true;
        }
        if (material instanceof MVMaterial) {
            materialSerialized['indexOfRefraction'] =
                material.indexOfRefraction;
            if (material.detailMap.texture) {
                materialSerialized.detailMap = {
                    texture: material.detailMap
                        ? material.detailMap.texture.serialize()
                        : null,
                    bumpLevel: material.detailMap.bumpLevel,
                    diffuseBlendLevel: material.detailMap.diffuseBlendLevel,
                    isEnabled: material.detailMap.isEnabled,
                    normalBlendMethod: material.detailMap.normalBlendMethod,
                    roughnessBlendLevel: material.detailMap.roughnessBlendLevel
                };
            }
        }
        materialSerialized.name = fileName;
        materialSerialized.id = fileName;

        if (materialClassName == 'NodeMaterial') {
            /**
             * the following lines are necessary beacuse the node material serialization function does not save the
             * properties "environmentIntensity" and "directIntensity" of the block PBRMetallicRoughnessBlock
             **/
            const nodeMaterial: NodeMaterial = material as NodeMaterial;
            const pbrBlock: any = nodeMaterial.getBlockByName(
                'PBRMetallicRoughness'
            ) as any;
            if (pbrBlock) {
                const serializedPbrBlock = materialSerialized.blocks.find(
                    (b) => b.name == 'PBRMetallicRoughness'
                );
                serializedPbrBlock['environmentIntensity'] =
                    pbrBlock.environmentIntensity;
                serializedPbrBlock['directIntensity'] =
                    pbrBlock.directIntensity;
            }
        }
        const newPath = basePath.replace('file://', '');
        const newFileName = fileName.replace('.json', '');
        return this.fileService.updateFile(
            newPath,
            newFileName,
            FileType.JSON,
            JSON.stringify(materialSerialized, null, 2),
            true
        );
    }

    public async renameMaterial(
        material: MVMaterial | NodeMaterial,
        newMaterialName: string,
        entityUrls: string[]
    ): Promise<void> {
        const oldMaterialName = material.name;
        material.name = newMaterialName;
        material.id = newMaterialName;
        const materialSerialized: any = material.serialize();
        const url: string = material['url'];
        const lastSlashIndex = url.lastIndexOf('/');
        const materialPath = url
            .slice(0, lastSlashIndex)
            .replace('file://', '');
        const newMaterialFileName = newMaterialName.replace('.json', '');

        entityUrls.forEach(async (entityUrl: string) => {
            const entityConfig = await loadJson<MVEntityConfig>(entityUrl);
            const lastSlashIndex = entityUrl.lastIndexOf('/');
            if (entityConfig && lastSlashIndex) {
                const entityBaseUrl = entityUrl.slice(0, lastSlashIndex + 1);
                const materialMappingsUrl =
                    entityBaseUrl + entityConfig.materialMappingsUrlRelative;
                await this.applyMaterialNameUpdateToMaterialMappingsFile(
                    materialMappingsUrl,
                    oldMaterialName,
                    newMaterialName
                );
            }
        });

        // rename the material
        await this.fileService.renameFile(
            materialPath,
            oldMaterialName.replace('.json', ''),
            FileType.JSON,
            newMaterialFileName
        );
        await this.fileService.updateFile(
            materialPath,
            newMaterialFileName,
            FileType.JSON,
            JSON.stringify(materialSerialized, null, 2)
        );
    }

    public getMaterial(basePath: string, fileName: string): Promise<any> {
        const newPath = basePath.replace('file://', '');
        return new Promise((resolve, reject) => {
            this.fileService
                .getFile(newPath, fileName, FileType.JSON)
                .then((data: string) => {
                    try {
                        const material = JSON.parse(data);
                        resolve(material);
                    } catch (e) {
                        reject(e);
                    }
                });
        });
    }

    public async updateTextureOnMaterial(
        absoluteTextureUrl: string,
        relativeTextureUrl: string,
        basePath: string,
        materialFileName: string,
        materialTextureProperty: string,
        scene: Scene,
        material: any,
        textureBasePath: string
    ): Promise<Texture> {
        // create new texture
        const texture = new Texture('file://' + absoluteTextureUrl, scene);
        // rewrite texture
        texture.name = relativeTextureUrl;
        texture.url = relativeTextureUrl;
        texture.vScale = -1;

        // apply texture to material
        const materialClassName = material.getClassName();
        if (materialClassName == 'PBRMaterial') {
            if (materialTextureProperty == 'detailMap') {
                material.detailMap.texture = texture;
                material.detailMap.isEnabled = true;
            } else {
                material[materialTextureProperty] = texture;
            }
        } else if (materialClassName == 'NodeMaterial') {
            const nodeMaterial = material as NodeMaterial;
            const block = nodeMaterial.getBlockByName(materialTextureProperty);
            if (block) {
                block['texture'] = texture;
            }
            if (materialTextureProperty == 'Albedo Texture') {
                const albedoTextureEnabledBlock = nodeMaterial.getBlockByName(
                    'Albedo Texture Enabled'
                ) as InputBlock;
                albedoTextureEnabledBlock.value.r = 1;
                albedoTextureEnabledBlock.value.g = 1;
                albedoTextureEnabledBlock.value.b = 1;
            }
        }

        if (materialTextureProperty == 'opacityTexture') {
            texture.getAlphaFromRGB = true;
        }

        // Update material in file system
        // await this.updateMaterial(basePath, materialFileName, material);
        return texture;
    }

    private async addAllMaterialsToScene(
        materialBaseUrl: string,
        textureBaseUrl: string,
        scene: Scene,
        materials: string[]
    ): Promise<boolean> {
        for (const mat of materials) {
            try {
                await this.createMaterial(materialBaseUrl, textureBaseUrl);
            } catch (e) {
                console.log(`Skip ${mat} Already in scene.`);
            }
        }

        const sceneMaterials = scene.materials.map((mat: Material) => mat.name);

        const arraysMatch = function (
            materials: string[],
            sceneMaterials: string[]
        ) {
            // Check if the arrays are the same length
            if (materials.length !== sceneMaterials.length) return false;

            // Check if all items exist and are in the same order
            for (let i = 0; i < materials.length; i++) {
                const includes = sceneMaterials.includes(materials[i]);
                if (!includes) {
                    return false;
                }
            }

            // Otherwise, return true
            return true;
        };
        return arraysMatch(materials, sceneMaterials);
    }

    public setMaterialMappingsJSON(
        materialMappingsJSON: MVMaterialMappingsJson
    ) {
        this._materialMappingsJSON = materialMappingsJSON;
        this._materialMappingsJSON$.next(this._materialMappingsJSON);
    }

    public openNewAllocatorDialog() {
        this.materialMappingForm = this.formBuilder.group({
            name: ['', Validators.required],
            mapping: ['']
        });

        const dialogRef = this.modal.open(NewAllocatorComponent, {
            data: {
                availableMaterials: this._unmappedMaterials,
                allocatorForm: this.materialMappingForm
            }
        });

        dialogRef.afterClosed().subscribe((result) => {
            result && this.onSaveAllocatorMapping();
        });
    }

    public async onSaveAllocatorMapping(): Promise<void> {
        if (this.materialMappingForm.valid) {
            const copyMappingFile = JSON.parse(
                JSON.stringify(this._materialMappingsJSON)
            );
            const originalMaterialName = this.materialMappingForm.value.name;
            const targetMaterialUrl = this.materialMappingForm.value.mapping;
            copyMappingFile.materialAllocators.unshift({
                name: originalMaterialName,
                mapping: targetMaterialUrl
            });

            // update material mapping json file
            this.updateActiveMaterialMappingFile(copyMappingFile);
            this._materialMappingsJSON = copyMappingFile;
            this._materialMappingsJSON$.next(this._materialMappingsJSON);
            await this.updateActiveMaterialMappingFile(
                this._materialMappingsJSON
            );

            // update scene without reloading
            await this.updateMaterialMapping(
                this._materialMappingsJSON,
                originalMaterialName,
                targetMaterialUrl
            );
        }
    }

    public async updateMaterialMapping(
        updatedMaterialMappingsJson: MVMaterialMappingsJson,
        originalMaterialName: string,
        relativeTargetMaterialUrl: string,
        slotName?: string
    ) {
        const copyOfUpdatedMaterialMappingsJson = JSON.parse(
            JSON.stringify(updatedMaterialMappingsJson)
        );
        copyOfUpdatedMaterialMappingsJson.materialAllocators.forEach((ma) => {
            ma.mapping = `${this._activeEntity.entityConfig.materialsUrlRelative}${ma.mapping}`;
        });

        copyOfUpdatedMaterialMappingsJson.switchMaterials.forEach((sm) => {
            sm.slots.forEach((slot) => {
                slot.mapping = `${this._activeEntity.entityConfig.materialsUrlRelative}${slot.mapping}`;
            });
        });

        await this.core.updateMaterialMapping(
            this._activeEntity,
            copyOfUpdatedMaterialMappingsJson,
            originalMaterialName,
            relativeTargetMaterialUrl,
            slotName
        );
    }

    private async updateActiveMaterialMappingFile(
        mappingFile: MVMaterialMappingsJson
    ): Promise<void> {
        const stringMapping = JSON.stringify(mappingFile, null, 2);
        mappingFile.materialAllocators.sort(
            (a: MVMaterialMappingJson, b: MVMaterialMappingJson) => {
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            }
        );
        mappingFile.switchMaterials.sort(
            (a: MVSwitchMaterialMapping, b: MVSwitchMaterialMapping) => {
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            }
        );
        await this.safeNewMaterialMapping(
            this.projectSettings.baseProjectUrl,
            this._activeEntity.entityConfig.materialMappingsUrlRelative,
            stringMapping
        );
    }

    private async applyMaterialNameUpdateToMaterialMappingsFile(
        materialMappingFileUrl,
        oldMaterialName,
        newMaterialName
    ) {
        materialMappingFileUrl.replace(/\\/g, '/');
        const lastSlashIndexOfMaterialMappingFileUrl =
            materialMappingFileUrl.lastIndexOf('/');
        const materialMappingFileBasePath = materialMappingFileUrl.slice(
            0,
            lastSlashIndexOfMaterialMappingFileUrl
        );
        const materialMappingFileName = materialMappingFileUrl
            .slice(lastSlashIndexOfMaterialMappingFileUrl + 1)
            .replace('.json', '');
        const materialMappingFile: MVMaterialMappingsJson = await loadJson(
            materialMappingFileUrl
        );

        if (
            !materialMappingFile.materialAllocators ||
            !materialMappingFile.switchMaterials
        ) {
            this.notifier.notify(
                'error',
                `Unvalid file selected: ${materialMappingFileUrl}`
            );
            return;
        }

        // update material mappings
        materialMappingFile.materialAllocators.map((allocator) => {
            if (allocator.mapping === oldMaterialName)
                allocator.mapping = newMaterialName;
        });

        materialMappingFile.switchMaterials.map((switchMaterial) => {
            switchMaterial.slots.map((slot) => {
                if (slot.mapping === oldMaterialName)
                    slot.mapping = newMaterialName;
            });
        });

        const activeMaterialMappingsUrl =
            this._activeEntity.entityConfig.materialMappingsUrlRelative;
        const isActiveMappingsFile = materialMappingFileUrl.includes(
            activeMaterialMappingsUrl
        );

        if (isActiveMappingsFile) {
            await this.setMaterialMappingsJSON(materialMappingFile);
            await this.updateActiveMaterialMappingFile(materialMappingFile);
        } else {
            await this.fileService.updateFile(
                materialMappingFileBasePath,
                materialMappingFileName,
                FileType.JSON,
                JSON.stringify(materialMappingFile, null, 2)
            );
        }
    }

    public async setUnmappedMaterials(): Promise<string[]> {
        this._unmappedMaterials = [];
        const scene = this.core.getScene();

        scene.meshes.forEach((mesh: AbstractMesh) => {
            const material = mesh.material;
            if (
                material &&
                !(material as any).isMVMaterial &&
                this._unmappedMaterials.indexOf(material.name) === -1 &&
                this._materialMappingsJSON.materialAllocators.findIndex(
                    (el) => el.name === material.name
                ) === -1
            ) {
                const x = this._materialMappingsJSON.materialAllocators.find(
                    (el: MVMaterialMappingJson) => el.name === material.name
                );
                console.log(x);
                this._unmappedMaterials.push(mesh.material.name);
                this._unmappedMaterials$.next(this._unmappedMaterials);
            }
        });

        this._unmappedMaterials.sort();
        return this._unmappedMaterials;
    }

    public async openEditAllocatorDialog(allocator: MVMaterialMappingJson) {
        this.materialMappingForm = this.formBuilder.group({
            name: '',
            mapping: ''
        });

        const dialogRef = this.modal.open(MappingEditorComponent, {
            data: {
                mapping: allocator,
                availableMaterials: this._unmappedMaterials,
                allocatorForm: this.materialMappingForm
            }
        });

        dialogRef.afterClosed().subscribe((result) => {
            result && this.onSaveEditedAllocatorMapping(allocator);
        });
    }

    public async onSaveEditedAllocatorMapping(
        allocator: MVMaterialMappingJson
    ): Promise<void> {
        const value = this.materialMappingForm.value;
        if (!value.mapping || value.mapping.length == 0) {
            return;
        }
        const materialMappingsCopy = JSON.parse(
            JSON.stringify(this._materialMappingsJSON)
        );

        const i = materialMappingsCopy.materialAllocators.findIndex(
            (el: MVMaterialMappingJson) => el.name === allocator.name
        );
        const materialMapping = materialMappingsCopy.materialAllocators[i];

        // update material mapping json file
        materialMapping.mapping = value.mapping
            ? value.mapping
            : allocator.mapping;
        this._materialMappingsJSON$.next(materialMappingsCopy);
        await this.updateActiveMaterialMappingFile(materialMappingsCopy);

        // update scene without reloading
        await this.updateMaterialMapping(
            materialMappingsCopy,
            materialMapping.name,
            materialMapping.mapping
        );
    }

    public async deleteAllocator(allocator: MVMaterialMappingJson) {
        const i = this._materialMappingsJSON.materialAllocators.findIndex(
            (el: MVMaterialMappingJson) =>
                el.name === allocator.name && allocator.mapping
        );
        const copyMapping = { ...this._materialMappingsJSON };
        copyMapping.materialAllocators.splice(i, 1);
        this._materialMappingsJSON$.next(copyMapping);
        await this.updateActiveMaterialMappingFile(copyMapping);
        this.setUnmappedMaterials();
    }

    public async addNewMaterial(newMaterialName: string, isNodeMaterial) {
        // TODO use file system dialog

        newMaterialName = this.fileService.sanitizeFileName(newMaterialName);
        this.setNewMaterialName(newMaterialName);

        await this.createMaterial(
            this.defaultMaterialsUrl$.getValue(),
            this._newMaterialName,
            isNodeMaterial
        )
            .then(() => {
                this.notifier.notify(
                    'success',
                    `Material ${newMaterialName} saved`
                );
                this.setNewMaterialName('');
                this.setUnmappedMaterials();
                // Update file explorer
                this.dataService.requestUpdateFileExplorer();
            })
            .catch((error) => {
                this.notifier.notify('error', error);
            });
    }

    public setNewMaterialName(newMaterialName) {
        this._newMaterialName = newMaterialName;
        this._newMaterialName$.next(this._newMaterialName);
    }

    openEditSwitchDialog(data: {
        switchMaterialName: string;
        slot: MVMaterialMappingJson;
    }) {
        this.materialMappingForm = this.formBuilder.group({
            name: '',
            mapping: ''
        });
        const dialogRef = this.modal.open(MappingEditorComponent, {
            data: {
                mapping: data.slot,
                availableMaterials: this._unmappedMaterials,
                allocatorForm: this.materialMappingForm
            }
        });

        dialogRef.afterClosed().subscribe((result) => {
            result && this.onSaveEditedSwitchMapping(data);
        });
    }
    public async onSaveEditedSwitchMapping(data: {
        switchMaterialName: string;
        slot: MVMaterialMappingJson;
    }): Promise<void> {
        const value = this.materialMappingForm.value;
        if (
            value.mapping &&
            value.mapping.length > 0 &&
            value.mapping !== data.slot.mapping
        ) {
            const i = this._materialMappingsJSON.switchMaterials.findIndex(
                (el: MVSwitchMaterialMapping) =>
                    el.name === data.switchMaterialName
            );
            let currentSwitchMaterial =
                this._materialMappingsJSON.switchMaterials[i];
            const slot = currentSwitchMaterial.slots.find(
                (slot) => slot.name == data.slot.name
            );

            slot.mapping = value.mapping;
            this._materialMappingsJSON$.next(this._materialMappingsJSON);
            await this.updateActiveMaterialMappingFile(
                this._materialMappingsJSON
            );

            await this.updateMaterialMapping(
                this._materialMappingsJSON,
                data.switchMaterialName,
                slot.mapping,
                slot.name
            );
        }
    }

    public async syncMappingsWithCws() {
        const cwsMaterials = await this.dataService.getCwsMaterials();
        cwsMaterials.forEach((cwsMaterial) => {
            const existingMapping =
                this._materialMappingsJSON.switchMaterials.find(
                    (switchMaterial) =>
                        switchMaterial.name == cwsMaterial.switch_material_name
                );
            if (!existingMapping) {
                this._materialMappingsJSON.switchMaterials.push({
                    name: cwsMaterial.switch_material_name,
                    slots: cwsMaterial.material_slots.map((slot) => {
                        return {
                            name: slot.material_slot_name,
                            mapping: null
                        };
                    })
                });
            } else {
                cwsMaterial.material_slots.forEach((slot) => {
                    const existingSlot = existingMapping.slots.find(
                        (s) => s.name == slot.material_slot_name
                    );
                    if (!existingSlot) {
                        existingMapping.slots.push({
                            name: slot.material_slot_name,
                            mapping: null
                        });
                    }
                });
            }
        });
        this._materialMappingsJSON.switchMaterials.sort(
            (a: MVSwitchMaterialMapping, b: MVSwitchMaterialMapping) => {
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            }
        );
        this.updateActiveMaterialMappingFile(this._materialMappingsJSON);
        this._materialMappingsJSON$.next(this._materialMappingsJSON);
    }

    public toggleLightmaps() {
        if (this._lightmapsActive) {
            this.notifier.notify('info', 'Lightmaps deactivated');
        } else {
            this.notifier.notify('info', 'Lightmaps activated');
        }
        this.core.getScene().materials.forEach((material) => {
            if (material['BJSNODEMATERIALEDITOR']) {
                const vcaoIntensityBlock = (
                    material as NodeMaterial
                ).getBlockByName('VCAO Intensity');

                if (vcaoIntensityBlock) {
                    const vacoValue = (vcaoIntensityBlock as InputBlock).value;
                    if (material['vcaoIntensity'] == undefined) {
                        material['vcaoIntensity'] = vacoValue;
                    }
                    (vcaoIntensityBlock as InputBlock).value =
                        vacoValue == 0 ? material['vcaoIntensity'] : 0;
                }
            } else {
                if (
                    material['lightmapTexture'] ||
                    material['lightmapTextureDeactivated']
                ) {
                    if (this._lightmapsActive) {
                        material['lightmapTextureDeactivated'] =
                            material['lightmapTexture'];
                        material['lightmapTexture'] = null;
                    } else {
                        material['lightmapTexture'] = material[
                            'lightmapTextureDeactivated'
                        ]
                            ? material['lightmapTextureDeactivated']
                            : material['lightmapTexture'];
                        material['lightmapTextureDeactivated'] = null;
                    }
                }
            }
        });
        this.core.getScene().meshes.forEach((mesh) => {
            if (mesh['vertexColorInUse']) {
                mesh.useVertexColors = !mesh.useVertexColors;
            }
        });
        this._lightmapsActive = !this._lightmapsActive;
    }

    public toggleVertexColorHighlight() {
        if (this._lightmapsActive) {
            this.notifier.notify('info', 'Vertex Color highlight active');
        } else {
            this.notifier.notify('info', 'Vertex Color highlight disabled');
        }
        this.core.getScene().materials.forEach((material) => {
            if (material['BJSNODEMATERIALEDITOR']) {
                const nodeMaterial = material as NodeMaterial;
                material['vertexColorHightlightActive'] =
                    !this._vertexColorOverwriteActive;
                const vertexColorSplitterBlock = nodeMaterial.getBlockByName(
                    'VertexColorSplitter'
                );
                const fragmentOutputBlock =
                    nodeMaterial.getBlockByName('FragmentOutput');
                const vcaoMultiplyBlock = nodeMaterial.getBlockByName(
                    'VCAO Multiply Final'
                );

                if (
                    vertexColorSplitterBlock &&
                    fragmentOutputBlock &&
                    vcaoMultiplyBlock
                ) {
                    if (this._vertexColorOverwriteActive) {
                        vcaoMultiplyBlock.connectTo(fragmentOutputBlock, {
                            input: 'rgb'
                        });
                    } else {
                        vertexColorSplitterBlock.connectTo(
                            fragmentOutputBlock,
                            {
                                input: 'rgb',
                                output: 'rgb'
                            }
                        );
                    }
                }
                if (nodeMaterial.isFrozen) {
                    nodeMaterial.unfreeze();
                    nodeMaterial.build();
                    nodeMaterial.freeze();
                } else {
                    nodeMaterial.build();
                }
            }
        });
        this._vertexColorOverwriteActive = !this._vertexColorOverwriteActive;
    }

    public gradeLightmapTextures(level: number) {
        this.core.getScene().materials.forEach((material) => {
            if (material['lightmapTexture']) {
                material['lightmapTexture'].level = level;
            }
        });
    }

    public getParentAndAffectedMaterials(material: Material): {
        affectedMaterials: Material[];
        parentMaterial: Material;
    } {
        const isLightmapMaterial = material['isLightmapMaterial'];
        const hasChildMaterials =
            material['isMVMaterial'] &&
            material['childMaterialNames'] &&
            material['childMaterialNames'].length > 0;
        const parentMaterialName = material['parentMaterialName'];
        const scene: Scene = this.core.getScene();
        let affectedMaterials: Material[] = [];
        let parentMaterial: Material = material;

        if (isLightmapMaterial) {
            parentMaterial = scene.materials.find(
                (material) => material.name == parentMaterialName
            );
            const affectedChildMaterials: Material[] = scene.materials.filter(
                (material) =>
                    material['parentMaterialName'] == parentMaterialName
            );
            affectedMaterials = [parentMaterial, ...affectedChildMaterials];
        } else if (hasChildMaterials) {
            const affectedChildMaterials: Material[] = scene.materials.filter(
                (material) => material['parentMaterialName'] == material.id
            );
            affectedMaterials = affectedChildMaterials;
        }

        return {
            affectedMaterials: affectedMaterials,
            parentMaterial: parentMaterial
        };
    }

    public removeTextureFromNodeMaterial(
        material: NodeMaterial,
        textureType: string
    ) {
        const textureBlock = material.getBlockByName(
            textureType
        ) as TextureBlock;
        const pbrMetallicRoughnessBlock = material.getBlockByName(
            'PBRMetallicRoughness'
        ) as PBRMetallicRoughnessBlock;
        if (textureBlock) {
            textureBlock.texture = null;
        }
        if (textureType == 'Albedo Texture') {
            const albedoTextureEnabledBlock = material.getBlockByName(
                'Albedo Texture Enabled'
            ) as InputBlock;
            albedoTextureEnabledBlock.value.r = 0;
            albedoTextureEnabledBlock.value.g = 0;
            albedoTextureEnabledBlock.value.b = 0;
        } else if (textureType == 'Bump Texture') {
            const perturbNormalBlock =
                material.getBlockByName('Perturb normal');
            const normalInput = pbrMetallicRoughnessBlock.inputs;
        }
        material.build();
    }
}
