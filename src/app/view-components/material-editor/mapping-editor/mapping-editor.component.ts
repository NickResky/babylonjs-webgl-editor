import { Component, Inject } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MVMaterialMappingJson } from 'mv-core';
import { MaterialService } from '../../../services/material/material.service';
import { MaterialUrlPickerComponent } from '../material-url-picker/material-url-picker.component';

@Component({
  selector: 'app-mapping-editor',
  templateUrl: 'mapping-editor.component.html',
  styleUrls: ['../material-editor.component.scss'],
  imports: [
    MatDialogModule,
    MaterialUrlPickerComponent,
    MatDividerModule,
    MatFormFieldModule,
    ReactiveFormsModule,
  ],
})
export class MappingEditorComponent {
  public filterValue: string;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: {
      availableMaterials: string[];
      allocatorForm: FormGroup;
      mapping: MVMaterialMappingJson;
    },
    private dialogRef: MatDialogRef<MappingEditorComponent>,
    private materialService: MaterialService
  ) {}

  onSaveButtonClick() {
    this.dialogRef.close(true);
  }

  public async updateMaterialMappingUrl(url: string) {
    this.data.allocatorForm.value.mapping = url;
  }
}
