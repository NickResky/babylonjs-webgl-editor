import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MVEnvironmentEntity } from 'mv-core';
import { combineLatest } from 'rxjs';
import { DataService } from '../../services/data/data.service';
import { EnvironmentService } from '../../services/environment/environment.service';
import { AllocatorTableComponent } from '../material-editor/allocator-table/allocator-table.component';
import { MaterialUrlPickerComponent } from '../material-editor/material-url-picker/material-url-picker.component';
import { SwitchTableComponent } from '../material-editor/switch-table/switch-table.component';

@Component({
    selector: 'app-environments-editor',
    templateUrl: './environments-editor.component.html',
    styleUrls: ['./environments-editor.component.css'],
    imports: [
        MaterialUrlPickerComponent,
        FormsModule,
        MatSelectModule,
        SwitchTableComponent,
        MatExpansionModule,
        AllocatorTableComponent,
        MatFormFieldModule,
        CommonModule,
        MatButtonModule
    ]
})
export class EnvironmentsEditorComponent implements OnInit {
    environmentUrls: Array<string>;
    selectedEnvironmentUrl: string;
    selectedEnvironment: MVEnvironmentEntity;
    environmentConfigCodes: string[] = [];
    selectedEnvironmentConfigCode: string;

    constructor(
        private environmentService: EnvironmentService,
        private _dataService: DataService
    ) {}

    ngOnInit(): void {
        this.environmentUrls = this.environmentService.getEnvironmentUrls();
        this.selectedEnvironmentUrl =
            this.environmentService.getCurrentEnvironmentUrl();
        this.selectedEnvironment =
            this.environmentService.getSelectedEnvironmentEntity();

        for (const config in this.selectedEnvironment
            ?.environmentSceneSettings) {
            this.environmentConfigCodes.push(config);
        }

        combineLatest([
            this.environmentService.selectedEnvironmentConfigurationCode$
        ]).subscribe(([code]) => {
            this.selectedEnvironmentConfigCode = code;
        });
    }

    async changeEnvironment(environment: string) {
        this.selectedEnvironment =
            await this.environmentService.selectEnvironment(environment, true);
        // if( this.selectedEnvironmentConfigCode ) {
        //   await this.environmentService.selectEnvironmentConfig(this.selectedEnvironmentConfigCode);
        // }
    }

    async changeEnvironmentConfig(environmentConfigCode: string) {
        this.selectedEnvironmentConfigCode = environmentConfigCode;
        this.environmentService.selectEnvironmentConfig(environmentConfigCode);
        await this.environmentService.updateEnvironmentConfig();
    }
}
