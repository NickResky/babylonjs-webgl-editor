import {
    Component,
    EventEmitter,
    OnInit,
    Output,
    ViewChild
} from '@angular/core';
// import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MVMaterialMappingJson } from 'mv-core';
import {
    TableVirtualScrollDataSource,
    TableVirtualScrollModule
} from 'ng-table-virtual-scroll';
import { MaterialService } from '../../../services/material/material.service';

@Component({
    selector: 'app-allocator-table',
    templateUrl: './allocator-table.component.html',
    styleUrls: ['../material-editor.component.scss'],
    imports: [
        MatTooltipModule,
        MatTableModule,
        TableVirtualScrollModule,
        MatFormFieldModule,
        MatInputModule,
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule
    ]
})
export class AllocatorTableComponent implements OnInit {
    public allocatorColumns: string[] = ['name', 'mapping', 'action'];
    public data: MVMaterialMappingJson[] = [];
    public dataSource =
        new TableVirtualScrollDataSource<MVMaterialMappingJson>();
    @Output() public deleteAllocator =
        new EventEmitter<MVMaterialMappingJson>();

    @ViewChild(MatSort, { static: true }) sort: MatSort;

    ngOnInit() {}

    constructor(private materialService: MaterialService) {
        this.materialService.materialMappingsJSON$.subscribe(
            (materialMappings) => {
                this.dataSource =
                    new TableVirtualScrollDataSource<MVMaterialMappingJson>(
                        materialMappings.materialAllocators
                    );
                this.data = materialMappings.materialAllocators;
                // this.dataSource.sort = this.sort;
            }
        );
    }

    onEditClick(allocator: MVMaterialMappingJson) {
        this.materialService.openEditAllocatorDialog(allocator);
    }

    onDeleteClick(allocator: MVMaterialMappingJson) {
        this.materialService.deleteAllocator(allocator);
    }

    applyFilter(event: Event) {
        const filterValue = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }
}
