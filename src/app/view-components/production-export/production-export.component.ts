import { Component, OnInit } from '@angular/core';
import {
    EntityBuildMetaData,
    ProductionExportService
} from '../../services/production-export/production-export.service';
import { ConverterService } from '../../services/converter/converter.service';
import { MaterialService } from '../../services/material/material.service';
import { CommonModule } from '@angular/common';
import { IncludesPipe } from '../configuration-editor/includes.pipe';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { DataService } from '../../services/data/data.service';

@Component({
    selector: 'app-production-export',
    templateUrl: './production-export.component.html',
    styleUrls: ['./production-export.component.scss'],
    imports: [CommonModule, IncludesPipe, MatCheckbox, MatButtonModule]
})
export class ProductionExportComponent implements OnInit {
    buildInProgress: boolean = false;
    buildSuccessful: boolean = false;
    buildFailed: boolean = false;
    materialExportInProgress: boolean = false;
    materialExportSuccessful: boolean = false;
    materialExportFailed: boolean = false;
    entities: EntityBuildMetaData[] = [];

    log: string;
    blenderPath: string;
    nodePath: string;

    public convertTextures: boolean = true;

    constructor(
        private productionExportService: ProductionExportService,
        private converterService: ConverterService,
        private materialService: MaterialService,
        private dataService: DataService
    ) {}

    ngOnInit(): void {
        this.productionExportService.buildInProgress$.subscribe(
            (buildInProgress: boolean) => {
                this.buildInProgress = buildInProgress;
            }
        );
        this.productionExportService.entities$.subscribe(
            (entities: EntityBuildMetaData[]) => {
                this.entities = entities;
            }
        );
        this.productionExportService.log$.subscribe((log: string) => {
            this.log = log;
        });
        this.converterService.blenderPath$.subscribe((blenderPath: string) => {
            this.blenderPath = blenderPath;
        });
        this.converterService.nodePath$.subscribe((nodePath: string) => {
            this.nodePath = nodePath;
        });
    }

    selectEntities() {
        this.productionExportService.selectEntityFiles();
    }

    chooseBlenderPath() {
        this.converterService.chooseBlenderPath();
    }

    chooseNodePath() {
        this.converterService.chooseNodePath();
    }

    async exportMaterialsAsGlb() {
        const inputDialogOptions: Electron.OpenDialogSyncOptions = {
            title: 'Choose material input glb file',
            properties: ['openFile'],
            filters: [{ name: 'GLB', extensions: ['glb', 'gltf'] }]
        };

        const inputPaths = await (window as any).electronAPI.showOpenDialogSync(
            inputDialogOptions
        );
        if (!inputPaths || inputPaths.length === 0) return;

        const inputFile = inputPaths[0].replace(/\\/g, '/');

        const openDialogOptions: Electron.OpenDialogSyncOptions = {
            title: 'Choose material export folder',
            properties: ['openDirectory', 'createDirectory']
        };

        const paths = await (window as any).electronAPI.showOpenDialogSync(
            openDialogOptions
        );
        if (!paths || paths.length === 0) return;

        const path = paths[0].replace(/\\/g, '/');

        this.materialExportSuccessful = false;
        this.materialExportFailed = false;
        this.materialExportInProgress = true;
        try {
            const successful = await this.converterService.exportMaterialsAsGlb(
                inputFile,
                path
            );
            this.materialExportSuccessful = successful;
            this.materialExportFailed = !successful;
        } finally {
            this.materialExportInProgress = false;
        }
    }

    async startBuild() {
        this.buildSuccessful = false;
        this.buildFailed = false;
        const conversionSuccessful =
            await this.productionExportService.startBuild(this.convertTextures);
        if (conversionSuccessful == true) {
            this.buildSuccessful = true;
        } else {
            this.buildFailed = true;
        }
    }
}
