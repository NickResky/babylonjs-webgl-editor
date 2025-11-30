import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import {
    FormBuilder,
    FormGroup,
    FormsModule,
    ReactiveFormsModule
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef
} from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ElectronService } from '../../services/electron/electron.service';
import { EntityService } from '../../services/entity/entity.service';
import { AllocatorTableComponent } from '../material-editor/allocator-table/allocator-table.component';
import { MaterialUrlPickerComponent } from '../material-editor/material-url-picker/material-url-picker.component';
import { SwitchTableComponent } from '../material-editor/switch-table/switch-table.component';

export interface FileNameDialog {
    description: string;
    placeholder: string;
    fileName: string;
    isRenameMaterialDialog?: boolean;
    isRenameCameraDialog?: boolean;
    reference?: string;
}

@Component({
    selector: 'app-file-name-dialog',
    templateUrl: './file-name-dialog.component.html',
    styleUrls: ['./file-name-dialog.component.css'],
    imports: [
        MaterialUrlPickerComponent,
        FormsModule,
        MatSelectModule,
        SwitchTableComponent,
        MatExpansionModule,
        AllocatorTableComponent,
        MatFormFieldModule,
        MatButtonModule,
        MatDialogModule,
        CommonModule,
        ReactiveFormsModule
    ]
})
export class FileNameDialogComponent implements OnInit {
    public form: FormGroup;
    public description: string;
    public placeholder: string;
    public fileName: string;
    public isRenameMaterialDialog: boolean;
    public isRenameCameraDialog: boolean;
    public reference: string;
    public selectedEntityUrls: string[];
    public addEntityUrl: string = '';

    constructor(
        private formBuilder: FormBuilder,
        private dialogRef: MatDialogRef<FileNameDialogComponent>,
        @Inject(MAT_DIALOG_DATA)
        {
            description,
            placeholder,
            fileName,
            isRenameMaterialDialog,
            isRenameCameraDialog,
            reference
        }: FileNameDialog,
        private _entityService: EntityService,
        private _electronService: ElectronService
    ) {
        this.description = description;
        this.placeholder = placeholder;
        this.fileName = fileName;
        this.isRenameMaterialDialog = isRenameMaterialDialog;
        this.isRenameCameraDialog = isRenameCameraDialog;
        this.reference = reference;
    }

    async ngOnInit(): Promise<void> {
        this.form = this.formBuilder.group({
            filename: this.fileName
        });

        if (this.isRenameMaterialDialog) {
            this.selectedEntityUrls = (
                await this._entityService.getAllEntityUrlsInBaseDirectory()
            ).map((mapping) => {
                return mapping.url;
            });
        }
        if (this.isRenameCameraDialog) {
            this.selectedEntityUrls = (
                await this._entityService.getAllEntityUrlsInBaseDirectory(
                    this.reference
                )
            ).map((mapping) => {
                return mapping.url;
            });
        }
    }

    async onAddEntityClicked() {
        const openDialogOptions: any = {
            title: 'Choose entity config file(s).',
            properties: ['openFile'],
            filters: [{ extensions: ['json'] }]
        };

        const urls: string[] = await (
            window as any
        ).electronAPI.showOpenDialogSync(openDialogOptions);

        debugger;
        urls.forEach((url: string) => {
            this.selectedEntityUrls.push(url.replace(/\\/g, '/'));
        });
    }

    rename() {
        this.dialogRef.close({
            fileName: this.form.value.filename,
            selectedEntityUrls: this.selectedEntityUrls
        });
    }
}
