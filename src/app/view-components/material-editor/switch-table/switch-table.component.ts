import { Component, OnInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MVMaterialMappingJson, MVSwitchMaterialMapping } from 'mv-core';
import { TableVirtualScrollDataSource } from 'ng-table-virtual-scroll';
import { DataService } from '../../../services/data/data.service';
import { MaterialService } from '../../../services/material/material.service';

@Component({
  selector: 'app-switch-table',
  templateUrl: './switch-table.component.html',
  styleUrls: ['../material-editor.component.scss'],
})
export class SwitchTableComponent implements OnInit {
  public switchMaterialSlots: { switchMaterialName: string, slotName: string, mapping: string }[];
  public switchMaterialColumns: string[] = ['switchMaterialName', 'slotName', 'mapping', 'action'];
  public dataSource = new TableVirtualScrollDataSource<any>();

  public isCwsEntity: boolean = false;
  public filterValue: string = '';


  constructor(
    private materialService: MaterialService,
    private dataService: DataService,
  ) {

  }

  ngOnInit() {
    this.materialService.materialMappingsJSON$.subscribe(materialMappings => {
      this.switchMaterialSlots = materialMappings.switchMaterials.reduce((acc, switchMaterial) => {
        switchMaterial.slots.forEach((slot) => {
          acc.push({
            switchMaterialName: switchMaterial.name,
            slotName: slot.name,
            mapping: slot.mapping
          });
        });
        return acc;
      }, []);
      this.dataSource = new TableVirtualScrollDataSource<any>(this.switchMaterialSlots);
      this.dataSource.filterPredicate =
        (data, filter: string) => data.switchMaterialName.toLowerCase().includes(filter) || data.slotName.toLowerCase().includes(filter) || data.mapping?.toLowerCase().includes(filter);
      this.applyFilter();

    });
    
    this.isCwsEntity = this.dataService.getProjectSettings().entityConfigFile.cwsId ? true : false;
  }

  public getTableDataSource(switchMaterialMappings: MVSwitchMaterialMapping[]) {
    return new MatTableDataSource<MVSwitchMaterialMapping>(switchMaterialMappings);
  }


  public onEditSwitchClicked(data: { switchMaterialName: string, slot: MVMaterialMappingJson }) {
    this.materialService.openEditSwitchDialog(data);
  }

  public async onSyncWithCWSClicked() {
    await this.materialService.syncMappingsWithCws();
  }

  applyFilter() {
    this.dataSource.filter = this.filterValue.trim().toLowerCase();
  }
}
