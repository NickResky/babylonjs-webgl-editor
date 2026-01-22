import { CdkAccordionModule } from '@angular/cdk/accordion';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { ActionItemEditorComponent } from '../../action-item-editor/action-item-editor.component';
import { BackgroundEditorComponent } from '../../background-editor/background-editor.component';
import { CameraEditorComponent } from '../../camera-editor/camera-editor.component';
import { ConfigurationEditorComponent } from '../../configuration-editor/configuration-editor.component';
import { EnvironmentsEditorComponent } from '../../environment-editor/environments-editor.component';
import { HotkeysComponent } from '../../hotkeys/hotkeys.component';
import { LiveswitcherComponent } from '../../liveswitcher/liveswitcher.component';
import { MaterialEditorComponent } from '../material-editor.component';
import { ProductionExportComponent } from '../../production-export/production-export.component';

@Component({
    selector: 'app-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.scss'],
    imports: [
        HotkeysComponent,
        CdkAccordionModule,
        MatAccordion,
        MatExpansionModule,
        MatButtonModule,
        MaterialEditorComponent,
        HotkeysComponent,
        ConfigurationEditorComponent,
        LiveswitcherComponent,
        EnvironmentsEditorComponent,
        BackgroundEditorComponent,
        ActionItemEditorComponent,
        CameraEditorComponent,
        ProductionExportComponent
    ]
})
export class SidebarComponent implements OnInit {
    constructor() {}

    ngOnInit(): void {}

    onResizeEnd(event: any): void {
        console.log('Element was resized', event);
    }
}
