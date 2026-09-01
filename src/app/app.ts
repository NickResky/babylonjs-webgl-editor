import { Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterOutlet } from '@angular/router';
import { MVUserStore } from './models/mv-user-store';
import { DataService } from './services/data/data.service';
import {
    FileAccessService,
    FileType
} from './services/file-access/file-access.service';
import { UserService } from './services/user/user.service';
import { CameraFilterPipe } from './view-components/camera-editor/camera-filter.pipe';
import { IncludesPipe } from './view-components/configuration-editor/includes.pipe';
import { HomeComponent } from './view-components/home/home.component';
import { SidebarComponent } from './view-components/material-editor/sidebar/sidebar.component';

@Component({
    selector: 'app-root',
    imports: [
        RouterOutlet,
        HomeComponent,
        MatButtonModule,
        MatListModule,
        MatSelectModule,
        MatCheckboxModule,
        MatButtonToggleModule,
        FormsModule,
        MatFormFieldModule,
        MatSidenavModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        MatInputModule,
        MatIconModule,
        SidebarComponent,
        IncludesPipe,
        CameraFilterPipe
    ],
    templateUrl: './app.html',
    styleUrl: './app.scss'
})
export class App {
    public fullScreen: boolean = false;
    public isFileExplorerOpen: boolean = false;
    public sidebarWidth = '30%';
    public sidebarWidths = ['30%', '50%', '80%', '10%'];
    public sidebarWidthIndex = 0;

    @HostListener('window:keyup', ['$event'])
    keyEvent(event: KeyboardEvent) {
        switch (event.key) {
            case 'F11':
                event.stopPropagation();
                this.fullScreen = !this.fullScreen;
                break;
        }
    }

    constructor(
        private fileService: FileAccessService,
        private userService: UserService,
        private dataService: DataService
    ) {
        // Events from electron
        (window as any).electronAPI.onOpenNewEntityFile(() => {
            this.onLoadNewEntity();
        });
        (window as any).electronAPI.onOpenGLBFile(() => {
            this.onLoadGLBFile();
        });
        // ipcRenderer.on('open-new-production-entity-file', (e) => {
        //   this.onLoadNewEntity(true);
        // });
        // ipcRenderer.on('export-for-production', (e) => {
        //   remote.dialog
        //     .showOpenDialog(
        //       remote.getCurrentWindow(), {
        //       title: 'Select entity files',
        //       properties: ['multiSelections'],
        //       filters: [{ name: 'JSON', extensions: ['json'] }],
        //     })
        //     .then((result) => {
        //         const fs = this.es.fs;
        //         let root = this.es.path.dirname(result.filePaths[0]);
        //         var now = DateTime.local().toFormat('yyyy-LL-dd HH-mm-ss');
        //         const exportDir = `${root}/_EXPORT_/${now}/`;
        //         const arr = result.filePaths.map(p => this.generateExportFile(p))
        //         arr.forEach(file => {
        //           fs.ensureDirSync(`${exportDir}`);
        //           fs.writeJSONSync(`${exportDir}/mv_${file.id}.json`, file);
        //           // fs.copySync(root+'/', exportDir, { filter: (src, dest) => !result.filePaths.some(p => src === p) && src.includes('_EXPORT_')})
        //         });
        //     })
        //     .catch((err) => {
        //       MVLogger.error(err);
        //     });
        // });
        // load Entity
        this.loadEntityConfig();
        this.dataService.resizeSidebar$.subscribe(() => {
            this.resizeSidebar();
        });
    }

    private async onLoadNewEntity(productionMode?: boolean) {
        await this.openEntityFileSelector(productionMode);
    }

    private onLoadGLBFile() {
        this.openGLBFileSelector();
    }

    private async loadEntityConfig() {
        const store = await this.userService.getUserStore();

        if (store.entityBasePath) {
            const entityConfig = await this.fileService.getFile(
                store.entityBasePath,
                store.entityName,
                FileType.JSON
            );
            const configFile = JSON.parse(entityConfig);

            this.dataService.projectSettings = {
                // baseProjectUrl: 'http://127.0.0.1:5500/',
                baseProjectUrl:
                    'file://' + store.entityBasePath.replace(/\\/g, '/'), // necessary for windows file system
                entityConfigFileName: store.entityName + '.json',
                entityConfigFile: configFile,
                sessionId: store.sessionId,
                productionMode: store.productionMode ? true : false
            };
        } else {
            this.openEntityFileSelector();
        }
    }

    public async openGLBFileSelector(): Promise<void> {
        const openDialogOptions = {
            title: 'Open GLB File',
            filters: [{ name: 'GLB', extensions: ['glb'] }]
        };
        const result = await (window as any).electronAPI.showOpenDialogSync(
            openDialogOptions
        );
        console.log(result);
        const glbFilePath = result[0];
        this.dataService.setGlbFilePath(glbFilePath);
    }

    public async openEntityFileSelector(
        productionMode?: boolean
    ): Promise<void> {
        const openDialogOptions = {
            title: 'Open an entitiy config file in JSON Format',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        };
        const result = await (window as any).electronAPI.showOpenDialogSync(
            openDialogOptions
        );
        console.log(result);
        const entityConfig = await this.fileService.getFile(
            this.getBaseFilePath(result[0]),
            this.getFileName(result[0]).replace('.json', ''),
            FileType.JSON
        );
        let sessionId = Date.now().toString();
        const userStore: MVUserStore = await this.userService.getUserStore();
        if (userStore && userStore.sessionId) {
            sessionId = userStore.sessionId;
        }
        this.dataService.projectSettings = {
            baseProjectUrl: 'file://' + this.getBaseFilePath(result[0]),
            entityConfigFileName: this.getFileName(result[0]),
            entityConfigFile: JSON.parse(entityConfig),
            sessionId: sessionId,
            productionMode: productionMode ? true : false
        };
        userStore.entityBasePath = this.getBaseFilePath(result[0]);
        userStore.entityName = this.getFileName(result[0]).replace('.json', '');
        userStore.productionMode = productionMode ? true : false;
        this.userService.setUserStore(userStore);
    }

    public getBaseFilePath(url: string): string {
        return url.replace(this.getFileName(url), '');
    }

    public getFileName(url: string): string {
        return url.match(/[ \w-]+\.json/)[0];
    }

    public toggleFileExplorer(drawerFunction: any) {
        this.isFileExplorerOpen = !this.isFileExplorerOpen;
    }

    onResize(event: any): void {
        this.sidebarWidth = event.rectangle.width + 'px';
    }

    resizeSidebar(): void {
        this.sidebarWidthIndex =
            ++this.sidebarWidthIndex >= this.sidebarWidths.length
                ? 0
                : this.sidebarWidthIndex;
        this.sidebarWidth = this.sidebarWidths[this.sidebarWidthIndex];
    }
}
