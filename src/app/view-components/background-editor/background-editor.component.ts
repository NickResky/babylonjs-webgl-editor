import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import {
    Core,
    MVEnvironmentConfig,
    MVEnvironmentConfigs,
    MVEnvironmentEntity
} from 'mv-core';
import { combineLatest } from 'rxjs';
import { DataService, ProjectSettings } from '../../services/data/data.service';
import { ElectronService } from '../../services/electron/electron.service';
import { EnvironmentService } from '../../services/environment/environment.service';
import { FileAccessService } from '../../services/file-access/file-access.service';
import { NotifierService } from '../../services/notifier/notifier.service';

@Component({
    selector: 'app-background-editor',
    templateUrl: './background-editor.component.html',
    styleUrls: ['./background-editor.component.scss'],
    imports: [CommonModule, MatCardModule]
})
export class BackgroundEditorComponent {
    private _baseURL: string;
    private _selectedEnvironmentEntity: MVEnvironmentEntity;
    public relativeEnvironmentBackgroundImageUrl = '';
    public environmentBackgroundImageUrl = '';
    private _core: Core;

    constructor(
        private notifierService: NotifierService,
        private fileAccessService: FileAccessService,
        private dataService: DataService,
        private electronService: ElectronService,
        private environmentService: EnvironmentService
    ) {
        combineLatest([
            this.dataService.projectSettings$,
            this.dataService.core$,
            this.environmentService.selectedEnvironmentEntity$
        ]).subscribe((data: any) => {
            const projectSettings: ProjectSettings = data[0];
            const core: Core = data[1];
            const environmentEntity: MVEnvironmentEntity = data[2];
            const localProjectSettings = projectSettings;
            this._core = core;
            this._selectedEnvironmentEntity = environmentEntity;
            this._baseURL = localProjectSettings.baseProjectUrl;
            const selectedEnvConfig =
                this._selectedEnvironmentEntity.activeEnvironmentSceneSetting;
            this.updateBackgroundImage(selectedEnvConfig);
        });
    }

    updateBackgroundImage(environmentConfig: MVEnvironmentConfig) {
        const environmentBackgroundImageUrl =
            environmentConfig?.backgroundImageUrl
                ? environmentConfig.backgroundImageUrl
                : '';

        if (environmentBackgroundImageUrl.length) {
            this.relativeEnvironmentBackgroundImageUrl =
                this._selectedEnvironmentEntity.entityConfig
                    .texturesUrlRelative + environmentBackgroundImageUrl;
            this.environmentBackgroundImageUrl =
                this._baseURL + this.relativeEnvironmentBackgroundImageUrl;
        } else {
            this.environmentBackgroundImageUrl = '';
        }
    }

    async onChangeBackgroundClick() {
        const openDialogOptions: any = {
            title: 'Choose background image.',
            properties: ['openFile'],
            filters: [{ name: 'Images', extensions: ['jpg', 'png'] }]
        };

        const backgroundImageToLoadUrlArray: string[] = await (
            window as any
        ).electronAPI.showOpenDialogSync(openDialogOptions);

        if (backgroundImageToLoadUrlArray) {
            let absoluteBackgroundImageUrl: string =
                backgroundImageToLoadUrlArray[0];
            absoluteBackgroundImageUrl = absoluteBackgroundImageUrl.replace(
                /\\/g,
                '/'
            ); // necessary for windows file system
            const baseProjectUrl = this._baseURL.replace('file://', '');

            if (!absoluteBackgroundImageUrl.includes(baseProjectUrl)) {
                this.notifierService.notify(
                    'error',
                    'Please select a file within your project'
                );
                return;
            }

            const relativeBackgroundImageUrl =
                absoluteBackgroundImageUrl.replace(baseProjectUrl, '');
            const backgroundImageName = relativeBackgroundImageUrl.substring(
                relativeBackgroundImageUrl.lastIndexOf('/') + 1
            );

            if (!this.dataService.allowUppercase) {
                if (
                    this.fileAccessService.hasUpperCase(
                        relativeBackgroundImageUrl
                    )
                ) {
                    const errorMessage = `${relativeBackgroundImageUrl} contains characters with capital letters. This can cause errors. Only "a-z","0-9","-","_" are allowed. Please rename the file before you import it!`;
                    this.notifierService.notify('error', errorMessage);
                    console.warn(errorMessage);
                    return;
                }
            }

            if (
                this.fileAccessService.hasInvalidCharacters(backgroundImageName)
            ) {
                const errorMessage = `${backgroundImageName} includes forbidden characters. Only "a-z","0-9","-","_" are allowed. Please rename the file before you import it!`;
                this.notifierService.notify('error', errorMessage);
                console.warn(errorMessage);
                return;
            }

            this.environmentBackgroundImageUrl =
                this._baseURL +
                this._selectedEnvironmentEntity.entityConfig
                    .texturesUrlRelative +
                relativeBackgroundImageUrl;

            this.changeBackgroundImage(relativeBackgroundImageUrl);
        }
    }

    async changeBackgroundImage(backgroundImageName: string) {
        const scene = this._core.getScene();

        const environmentSettings: MVEnvironmentConfigs =
            await this.environmentService.onEnvironmentSavedClicked(
                this._baseURL,
                scene,
                backgroundImageName
            );

        await this.environmentService.refreshEnvironment(environmentSettings);
    }

    onRemoveBackgroundClick() {
        this.environmentBackgroundImageUrl = '';
        this.changeBackgroundImage(null);
    }
}
