import { Injectable } from '@angular/core';
import { Core, MVEntity, MVEntityConfig } from 'mv-core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class DataService {
    /* DATA */
    private _projectSettings$ = new Subject<ProjectSettings>();
    private _projectSettings: ProjectSettings;
    private _core$ = new Subject<Core>();
    private _core: Core;

    private _glbFilePath$ = new Subject<string>();
    public glbFilePath$ = this._glbFilePath$.asObservable();

    private _activeEntity: MVEntity;
    private _activeEntity$: Subject<MVEntity> = new Subject();
    public activeEntity$ = this._activeEntity$.asObservable();

    private _entities: MVEntity[] = [];
    private _entities$: BehaviorSubject<MVEntity[]> = new BehaviorSubject([]);
    public entities$ = this._entities$.asObservable();

    /* Expose data throw subjects */
    public projectSettings$ = this._projectSettings$.asObservable();
    public core$ = this._core$.asObservable();
    public updateTexture$ = new Subject<void>();

    /* Update Events */
    private _updateFileExplorer$ = new Subject<string>();
    public updateFileExplorer$ = this._updateFileExplorer$.asObservable();

    private _reloadScene$ = new Subject<string>();
    public reloadScene$ = this._reloadScene$.asObservable();

    private _loading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
        true
    );
    public loading$ = this._loading$.asObservable();

    private _loadingProgress$ = new Subject<number>();
    public loadingProgress$ = this._loadingProgress$.asObservable();

    private _showLoadingBackground$: BehaviorSubject<boolean> =
        new BehaviorSubject<boolean>(true);
    public showLoadingBackground$ = this._showLoadingBackground$.asObservable();

    private _resizeSidebar$ = new Subject<string>();
    public resizeSidebar$ = this._resizeSidebar$.asObservable();

    public allowUppercase = true;

    constructor() {
        this._projectSettings = {
            baseProjectUrl: '',
            entityConfigFileName: '',
            entityConfigFile: null,
            sessionId: null,
            productionMode: false
        };
    }

    set projectSettings(projectSettings: ProjectSettings) {
        this._projectSettings = projectSettings;
        this._projectSettings$.next(this._projectSettings);
    }

    public getProjectSettings(): ProjectSettings {
        return this._projectSettings;
    }

    public setGlbFilePath(glbFilePath: string) {
        this._glbFilePath$.next(glbFilePath);
    }

    setCore(core: Core) {
        this._core = core;
        this._core$.next(this._core);
    }

    getCore(): Core {
        return this._core;
    }

    public addEntity(entity: MVEntity) {
        this._entities.push(entity);
        this._entities$.next(this._entities);
    }

    public setActiveEntity(entity: MVEntity) {
        this._activeEntity = entity;
        this._activeEntity$.next(this._activeEntity);
    }

    public getActiveEntity(): MVEntity {
        return this._activeEntity;
    }

    /**
     * Request an update on file explorer
     * @param {string} path optional whre the path has be changed so that a reload of the tree can be faster
     */
    public requestUpdateFileExplorer(path: string = ''): void {
        this._updateFileExplorer$.next(path);
    }

    /**
     * Request an reload on scene
     */
    public requestReloadScene(): void {
        this._reloadScene$.next('1');
    }

    public resizeSidebar() {
        this._resizeSidebar$.next('1');
    }

    public async getCwsMaterials() {
        const rawResponse = await fetch(
            `http://localhost:3000/api/v1/coba_resources/${this._activeEntity.entityConfig.cwsId}/materials`,
            {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Authorization:
                        'Token  0dd216e266f30a4e0707f69cd8234b23592bddaf',
                    'Content-Type': 'application/json'
                }
            }
        );
        const content = await rawResponse.json();
        if (content.data == 'IN_PROGRESS') {
            return this.getCwsMaterials();
        }
        return content.data.materials;
    }

    public setLoading(loadingState: boolean) {
        this._loading$.next(loadingState);
    }

    public setShowLoadingBackground(showLoadingBackgroundState: boolean) {
        this._showLoadingBackground$.next(showLoadingBackgroundState);
    }

    public setLoadingProgress(loadingProgress: number) {
        this._loadingProgress$.next(loadingProgress);
    }
}

export interface ProjectSettings {
    baseProjectUrl: string;
    entityConfigFileName: string;
    entityConfigFile: MVEntityConfig;
    sessionId: string;
    productionMode: boolean;
}
