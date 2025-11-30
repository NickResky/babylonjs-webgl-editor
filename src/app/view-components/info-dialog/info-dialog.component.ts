import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef
} from '@angular/material/dialog';
import { ElectronService } from '../../services/electron/electron.service';
import { EntityService } from '../../services/entity/entity.service';

export interface InfoDialog {
    description: string;
    title: string;
}

@Component({
    selector: 'app-info-dialog',
    templateUrl: './info-dialog.component.html',
    styleUrls: ['./info-dialog.component.css'],
    imports: [CommonModule, MatDialogModule]
})
export class InfoDialogComponent implements OnInit {
    public description: string;
    public title: string;

    constructor(
        private dialogRef: MatDialogRef<InfoDialogComponent>,
        @Inject(MAT_DIALOG_DATA) { description, title }: InfoDialog,
        private _entityService: EntityService,
        private _electronService: ElectronService
    ) {
        this.description = description;
        this.title = title;
    }

    async ngOnInit(): Promise<void> {}

    submit() {
        this.dialogRef.close({
            submit: true
        });
    }

    cancel() {
        this.dialogRef.close({
            submit: false
        });
    }
}
