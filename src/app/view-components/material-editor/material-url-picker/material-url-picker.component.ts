import { Component, EventEmitter, Input, Output } from '@angular/core';
import { combineLatest } from 'rxjs';
import { ElectronService } from '../../../services/electron/electron.service';
import { MaterialService } from '../../../services/material/material.service';

@Component({
  selector: 'app-material-url-picker',
  templateUrl: 'material-url-picker.component.html',
  styleUrls: ['../material-editor.component.scss'],
})
export class MaterialUrlPickerComponent {
  public relativeMaterialMappingUrl: string;
  public defaultMaterialsBaseUrl: string;

  @Input() relativeUrl: string;
  @Output() urlChange = new EventEmitter<string>();

  constructor(private electronService: ElectronService, private materialService: MaterialService) {
    combineLatest([this.materialService.defaultMaterialsUrl$]).subscribe(
      ([defaultMaterialsUrl]) => {
        if (defaultMaterialsUrl) {
          this.defaultMaterialsBaseUrl = defaultMaterialsUrl.replace(/\\/g, '/');
        }
      }
    );
  }

  public ngOnInit() {
    this.relativeMaterialMappingUrl = this.relativeUrl;
  }

  public async selectMaterialsMappingUrl() {
    let defaultPath = this.relativeMaterialMappingUrl
      ? this.defaultMaterialsBaseUrl + this.relativeMaterialMappingUrl
      : this.defaultMaterialsBaseUrl;
    defaultPath = defaultPath.replace(/\//g, '\\');
    const openDialogOptions: Electron.OpenDialogOptions = {
      title: 'Select Material Mapping',
      properties: ['openFile'],
      defaultPath: defaultPath,
      filters: [
        {
          name: 'json',
          extensions: ['json'],
        },
      ],
    };
    const dialogResponse = await (window as any).electronAPI.showOpenDialogSync(openDialogOptions);
    if (dialogResponse) {
      let newUrl = dialogResponse[0];
      if (newUrl) {
        newUrl = newUrl.replace(/\\/g, '/');
        // TODO Validate if within project url!
        this.relativeMaterialMappingUrl = newUrl.replace(this.defaultMaterialsBaseUrl, '');
        this.urlChange.emit(this.relativeMaterialMappingUrl);
      }
    }
  }
}
