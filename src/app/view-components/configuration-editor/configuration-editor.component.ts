import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatCheckbox } from '@angular/material/checkbox';
import { ConfigurationService } from '../../services/configuration/configuration.service';
import { DataService, ProjectSettings } from '../../services/data/data.service';
import { IncludesPipe } from './includes.pipe';

@Component({
    selector: 'app-configuration-editor',
    templateUrl: './configuration-editor.component.html',
    styleUrls: ['./configuration-editor.component.css'],
    imports: [CommonModule, IncludesPipe, MatCheckbox]
})
export class ConfigurationEditorComponent implements OnInit {
    public properties: string[];
    public activeProperties: string[];
    public isCwsEntity: boolean = true;

    constructor(
        private configurationService: ConfigurationService,
        private dataService: DataService
    ) {}

    ngOnInit(): void {
        this.configurationService.properties$.subscribe((_properties) => {
            this.properties = _properties;
        });
        this.configurationService.activeProperties$.subscribe((_properties) => {
            this.activeProperties = _properties;
        });
        this.dataService.projectSettings$.subscribe(
            (project: ProjectSettings) => {
                this.isCwsEntity = project.entityConfigFile.cwsId
                    ? true
                    : false;
            }
        );
    }

    public toggleProperty(code: string): void {
        this.configurationService.toggleProperty(code);
    }
}
