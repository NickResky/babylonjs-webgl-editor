import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MVEntityConfig } from 'mv-core';
import { DataService, ProjectSettings } from '../../services/data/data.service';

@Component({
    selector: 'app-liveswitcher',
    templateUrl: './liveswitcher.component.html',
    styleUrls: ['./liveswitcher.component.css'],
    imports: [CommonModule]
})
export class LiveswitcherComponent implements OnInit {
    private _entityConfigFile: MVEntityConfig;
    public isCwsEntity: boolean = false;
    private _sessionId: string;

    constructor(private dataService: DataService) {
        this.dataService.projectSettings$.subscribe(
            (project: ProjectSettings) => {
                this._entityConfigFile = project.entityConfigFile;
                this.isCwsEntity = this._entityConfigFile.cwsId ? true : false;
                this._sessionId = project.sessionId;
            }
        );
    }

    ngOnInit(): void {}

    openLiveswitcher() {
        if (
            this._entityConfigFile &&
            this._entityConfigFile.cwsId &&
            this._sessionId
        ) {
            //   open(`https://stateline-prod/liveswitcher.html?productId=${this._entityConfigFile.cwsId}&sessionId=${this._sessionId}`);
        }
    }
}
