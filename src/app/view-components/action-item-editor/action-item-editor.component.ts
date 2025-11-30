import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ActionItem, ActionItemOptionsJSON } from 'mv-core';
import { ActionItemService } from '../../services/action-item/action-item.service';
import { AllocatorTableComponent } from '../material-editor/allocator-table/allocator-table.component';
import { SwitchTableComponent } from '../material-editor/switch-table/switch-table.component';
import { ActionItemComponent } from './action-item/action-item.component';

@Component({
    selector: 'app-action-item-editor',
    templateUrl: './action-item-editor.component.html',
    styleUrls: ['./action-item-editor.component.css'],
    imports: [
        FormsModule,
        MatSelectModule,
        SwitchTableComponent,
        MatExpansionModule,
        AllocatorTableComponent,
        MatFormFieldModule,
        CommonModule,
        MatButtonModule,
        ActionItemComponent,
        MatDivider
    ]
})
export class ActionItemEditorComponent implements OnInit {
    public actionItems: ActionItem[];

    constructor(private actionItemService: ActionItemService) {}

    ngOnInit(): void {
        this.actionItemService.actionItems$.subscribe(
            (actionItems: ActionItem[]) => {
                this.actionItems = actionItems;
            }
        );
    }

    changeActionItemConfig(newStateObject) {
        this.actionItemService.changeActionItem(
            newStateObject.newStateID,
            newStateObject.actionItemID
        );
    }

    changeActionItemName(newActionItemData: any) {
        this.actionItemService.renameActionItem(
            newActionItemData.id,
            newActionItemData.value
        );
    }

    changeCurrentStateName(newStateNameData: any) {
        this.actionItemService.renameCurrentState(
            newStateNameData.newStateID,
            newStateNameData.currentStateID,
            newStateNameData.actionItemID
        );
    }

    async onNewActionItem() {
        const numberOfItem = this.actionItems.length + 1;
        const newDefaultActionItem: ActionItemOptionsJSON = {
            id: `New Action Item${numberOfItem}`,
            size: 0.2,
            material: 'actionitem.material.json',
            states: [
                {
                    id: 'closed',
                    position: [1.5, 0, 1.5]
                }
            ]
        };
        await this.actionItemService.addNewActionItem(newDefaultActionItem);
    }

    deleteActionItem(id: any): void {
        this.actionItemService.deleteActionItem(id);
    }

    addNewState(newStateData: any) {
        this.actionItemService.addNewState(
            newStateData.actionItemID,
            newStateData.newStateName
        );
    }
}
