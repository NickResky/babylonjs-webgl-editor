import { Component, OnInit } from '@angular/core';
import {
    EntityBuildMetaData,
    ProductionExportService
} from '../../services/production-export/production-export.service';
import { ConverterService } from '../../services/converter/converter.service';
import { CommonModule } from '@angular/common';
import { IncludesPipe } from '../configuration-editor/includes.pipe';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';

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
    entities: EntityBuildMetaData[] = [];

    log: string;
    blenderPath: string;
    nodePath: string;

    public convertTextures: boolean = true;

    constructor(
        private productionExportService: ProductionExportService,
        private converterService: ConverterService
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
