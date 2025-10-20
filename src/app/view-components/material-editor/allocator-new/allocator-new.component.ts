import { Component, Inject } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MaterialService } from '../../../services/material/material.service';
import { MaterialUrlPickerComponent } from '../material-url-picker/material-url-picker.component';

@Component({
  selector: 'app-allocator-new',
  templateUrl: 'allocator-new.component.html',
  styleUrls: ['../material-editor.component.scss'],
  imports: [
    MatDialogModule,
    MaterialUrlPickerComponent,
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
})
export class NewAllocatorComponent {
  public availableMaterialMappings: string[];
  public relativeMaterialMappingUrl: string;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: {
      availableMaterials: string[];
      allocatorForm: FormGroup;
    },
    private dialogRef: MatDialogRef<NewAllocatorComponent>,
    private materialService: MaterialService
  ) {}

  onSaveButtonClick() {
    this.dialogRef.close(true);
  }

  public async updateMaterialMappingUrl(url: any) {
    this.relativeMaterialMappingUrl = url;
    this.data.allocatorForm.value.mapping = url;
  }
}
