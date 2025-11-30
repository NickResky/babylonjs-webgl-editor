import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MVCameraShotMetaData, MVCameraShotsMetaData } from 'mv-core';
import { CameraService } from '../../services/camera/camera.service';
import { ElectronService } from '../../services/electron/electron.service';
import { EntityService } from '../../services/entity/entity.service';
import { FileNameDialogComponent } from '../file-name-dialog/file-name-dialog.component';
import { InfoDialogComponent } from '../info-dialog/info-dialog.component';
import { CameraFilterPipe } from './camera-filter.pipe';

@Component({
    selector: 'app-camera-editor',
    templateUrl: './camera-editor.component.html',
    styleUrls: ['./camera-editor.component.scss'],
    imports: [
        CommonModule,
        MatIcon,
        MatMenuModule,
        CameraFilterPipe,
        FormsModule
    ]
})
export class CameraEditorComponent implements OnInit {
    public cameraShotIds: string[];
    public cameraShotGlbs: string[];
    public cameraShotProperties: any;
    public isFreeCamera: boolean = false;
    public activeCameraShotId: string;
    public _fileNameDialogRef: MatDialogRef<FileNameDialogComponent>;
    public cameraShots: MVCameraShotMetaData[];
    public expandDetails = false;

    public filterSearch: string = '';
    public filterCategory: 'int' | 'ext' | undefined;

    constructor(
        private cameraService: CameraService,
        private dialog: MatDialog,
        private electronService: ElectronService,
        private entityService: EntityService
    ) {}

    ngOnInit(): void {
        this.cameraService.cameraShots$.subscribe(
            (cameraShots: MVCameraShotsMetaData) => {
                this.cameraShots = Object.values(cameraShots);
            }
        );
        this.cameraService.freeCameraActive.subscribe(
            (freeCameraActive: boolean) => {
                this.isFreeCamera = freeCameraActive;
            }
        );
    }

    hasMissingCameras(cameraShot: MVCameraShotMetaData) {
        if (cameraShot.urlRelative && !cameraShot.cameraShotSettings) {
            return true;
        }
        if (
            cameraShot.mobileUrlRelative &&
            !cameraShot.cameraShotSettingsMobile
        ) {
            return true;
        }
        return false;
    }

    toggleDetails(): void {
        this.expandDetails = !this.expandDetails;
    }

    toggleMobileCameraShot(cameraShot: MVCameraShotMetaData) {
        let mobileActive = cameraShot.mobileActiveInEditor ? true : false;
        this.requestCameraShot(cameraShot.id, !mobileActive);
    }

    public saveCameraShot(cameraShot: MVCameraShotMetaData) {
        this.cameraService.updateCamera(cameraShot);
    }

    public requestCameraShot(id: string, isMobile?: boolean): void {
        this.cameraService.requestCameraShot(id, isMobile);
    }
    public requestFreeCamera(): void {
        this.cameraService.requestFreeCamera();
    }
    public addNewCameraShotJSON(): void {
        this.cameraService.createNewCameraShotJSON();
    }
    public addNewCameraShot(): void {
        this._fileNameDialogRef = this.dialog.open(FileNameDialogComponent, {
            hasBackdrop: false,
            data: {
                description: 'Camera shot ID',
                placeholder: 'Enter new camera shot ID'
            }
        });

        this._fileNameDialogRef
            .afterClosed()
            .subscribe((response: { fileName: string }) =>
                this.cameraService.createNewCameraShot(response.fileName)
            );
    }

    public changeCameraShotJSON(id: string, isMobile: boolean) {
        this.cameraService.changeCameraShotJSON(id, isMobile);
    }
    public deleteCameraShot(id: string): void {
        this.cameraService.deleteCameraShot(id);
    }
    public deleteAnimation(id: string): void {
        this.cameraService.deleteAnimation(id);
    }
    public onAddCameraAnimationClicked(id: string): void {
        this.cameraService.openAddCameraAnimationDialog(id);
    }
    public openChangeCameraShotNameDialog(id: string): void {
        const dialogRef = this.dialog.open(FileNameDialogComponent, {
            hasBackdrop: false,
            data: {
                description: 'Camera shot ID',
                placeholder: 'Enter new camera shot ID',
                fileName: id
            }
        });

        dialogRef.afterClosed().subscribe((response: { fileName: string }) => {
            this.cameraService.updateCameraShotId(id, response.fileName);
        });
    }

    public async renameCameraShotJSON(
        cameraShot: MVCameraShotMetaData,
        isMobile: boolean
    ) {
        const oldFilePathRelative = isMobile
            ? cameraShot.mobileUrlRelative
            : cameraShot.urlRelative;
        const oldFileName = this.electronService.path
            .basename(oldFilePathRelative)
            .replace('.json', '');

        const affectedEntityUrls =
            await this.entityService.getAllEntityUrlsInBaseDirectory(
                oldFilePathRelative
            );
        const affectedEntityUrlsString = affectedEntityUrls.reduce(
            (result, entity) => {
                result += entity.url + '<br/>';
                return result;
            },
            ''
        );

        const fileNameDialogRef = this.dialog.open(FileNameDialogComponent, {
            hasBackdrop: false,
            data: {
                description: 'Rename camera shot JSON',
                placeholder: 'Enter new camera shot JSON name here',
                fileName: oldFileName
            }
        });

        fileNameDialogRef
            .afterClosed()
            .subscribe((response: { fileName: string }) => {
                if (!response.fileName) return;

                const infoDialog = this.dialog.open(InfoDialogComponent, {
                    hasBackdrop: false,
                    data: {
                        title: 'Affected Entities',
                        description: affectedEntityUrlsString
                    }
                });

                infoDialog
                    .afterClosed()
                    .subscribe((result: { submit: boolean }) => {
                        if (!result.submit) return;
                        this.cameraService.renameCameraShotJSON(
                            oldFilePathRelative,
                            response.fileName,
                            affectedEntityUrls
                        );
                    });
            });
    }

    public filterByCategory(value: 'int' | 'ext'): void {
        this.filterCategory = this.filterCategory === value ? undefined : value;
        console.warn('### filterCategory: ', this.filterCategory);
    }

    public clearFilter(): void {
        this.filterCategory = undefined;
        this.filterSearch = '';
    }
}
