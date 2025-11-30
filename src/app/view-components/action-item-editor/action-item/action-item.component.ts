import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { ActionItem } from 'mv-core';
import { MaterialUrlPickerComponent } from '../../material-editor/material-url-picker/material-url-picker.component';

@Component({
    selector: 'action-item',
    templateUrl: './action-item.component.html',
    styleUrls: ['./action-item.component.css'],
    imports: [
        MaterialUrlPickerComponent,
        MatFormFieldModule,
        CommonModule,
        MatDivider,
        MatTooltip,
        MatButtonModule,
        MatSelectModule,
        FormsModule
    ]
})
export class ActionItemComponent implements OnInit {
    public inputValue: string;
    public isEmpty: boolean = true;
    public currentValue: string;
    @Input() actionItem: ActionItem;
    @Output() onStateChange = new EventEmitter<{
        newStateID: string;
        actionItemID: string;
    }>();
    @Output() renameActionItem = new EventEmitter<{
        value: string;
        id: string;
    }>();
    @Output() renameActionCurrentState = new EventEmitter<{
        newStateID: string;
        currentStateID: string;
        actionItemID: string;
    }>();
    @Output() deleteActionItem = new EventEmitter<string>();
    @Output() addNewState = new EventEmitter<{
        actionItemID: string;
        newStateName: string;
    }>();

    ngOnInit() {
        this.currentValue = this.actionItem.getState().id;
    }

    onSelect(newState: { newStateID: string; actionItemID: string }) {
        this.onStateChange.emit(newState);
    }

    onInputEnter() {
        this.inputValue === '' ? (this.isEmpty = true) : (this.isEmpty = false);
    }

    onRenameActionItem(newActionItemNameData: { value: string; id: string }) {
        this.renameActionItem.emit(newActionItemNameData);
    }
    onRenameState(newStateNameData: {
        newStateID: string;
        currentStateID: string;
        actionItemID: string;
    }) {
        this.renameActionCurrentState.emit(newStateNameData);
    }

    onDeleteActionItem(id: string) {
        this.deleteActionItem.emit(id);
    }

    onAddNewState(newStateData: {
        actionItemID: string;
        newStateName: string;
    }) {
        this.addNewState.emit(newStateData);
    }
}
