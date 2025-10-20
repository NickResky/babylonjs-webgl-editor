import { Component, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Core, MVEntity, MVMaterialMappingJson } from 'mv-core';
import { DataService, ProjectSettings } from '../../services/data/data.service';
import { EntityService } from '../../services/entity/entity.service';
import { MaterialService } from '../../services/material/material.service';
import { AllocatorTableComponent } from './allocator-table/allocator-table.component';
import { MaterialUrlPickerComponent } from './material-url-picker/material-url-picker.component';
import { SwitchTableComponent } from './switch-table/switch-table.component';

@Component({
  selector: 'app-material-editor',
  templateUrl: './material-editor.component.html',
  styleUrls: ['./material-editor.component.scss'],
  imports: [
    MaterialUrlPickerComponent,
    FormsModule,
    MatSelectModule,
    SwitchTableComponent,
    MatExpansionModule,
    AllocatorTableComponent,
    MatFormFieldModule,
    CommonModule,
  ],
})
export class MaterialEditorComponent implements OnInit {
  private projectSettings: ProjectSettings;
  public entities: MVEntity[] = [];
  public activeEntity: MVEntity;
  private core: Core;
  public materialsLoaded = false;

  public loading = true;
  private _switchMaterialColumns: string[] = ['name', 'mapping', 'action'];

  public newMaterialName: string;

  constructor(
    private dataService: DataService,
    private materialService: MaterialService,
    public modal: MatDialog,
    private entityService: EntityService
  ) {
    this.materialService.materialMappingsJSON$.subscribe((mappings) => {
      this.loading = false;
    });
  }

  async ngOnInit() {
    combineLatest([
      this.dataService.projectSettings$,
      this.dataService.core$,
      this.dataService.entities$,
      this.dataService.activeEntity$,
    ]).subscribe(async (data: [ProjectSettings, Core, MVEntity[], MVEntity]) => {
      this.projectSettings = data[0];
      this.core = data[1];
      this.entities = data[2];
      this.activeEntity = data[3];
      this.loading = false;
    });
  }

  loadMaterials() {
    this.materialsLoaded = true;
  }

  unloadMaterials() {
    this.materialsLoaded = false;
  }

  async onChangeEntityClicked(entity: MVEntity): Promise<void> {
    this.activeEntity = entity;
    if (this.activeEntity) {
      await this.materialService.setupActiveEntity(this.activeEntity);
    }
  }

  public onNewAllocatorClicked(): void {
    this.materialService.openNewAllocatorDialog();
  }

  public onDeleteAllocatorClicked(allocator: MVMaterialMappingJson): void {
    this.materialService.deleteAllocator(allocator);
  }

  public onNewMaterialClicked(isNodeMaterial: boolean): void {
    this.materialService.addNewMaterial(this.newMaterialName, isNodeMaterial);
  }
}
