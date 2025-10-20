import { inject, injectable } from 'inversify';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { TYPES } from '../ioc/types';
import { ActionItem } from '../models/action-item';
import { MVCameraShot } from '../models/camera';
import { CameraService } from '../services';
import { ActionItemService } from '../services/action-item.service';
import { CoreSettings } from '../settings';

/**
 * Action Item Controller
 */
@injectable()
export class ActionItemController {
    /**
     * Creates a new ActionItemController
     * @param actionItemManager -
     */
    constructor(
        @inject(TYPES.ActionItemService) private _actionItemManager?: ActionItemService,
        @inject(TYPES.CoreSettings) private _settings?: CoreSettings,
        @inject(TYPES.CameraService) private _cameraService?: CameraService,
    ) {}

    /**
     * Load Action Items
     * @param url -
     */
    public async load(url: string): Promise<ActionItem[]> {
        await this._actionItemManager.clear();
        const activeCameraShot: MVCameraShot = this._cameraService.getActiveCameraShot();
        return this._actionItemManager.createActionItemsFromJSON(url, activeCameraShot);
    }

    /**
     * Select Action Items
     * @param ids - Array of Action Item ids that you want to select -
     */
    public select(ids: string[]): void {
        const actionItems = this._actionItemManager.getActionItems();
        const filtered = actionItems.filter((p: ActionItem) => ids.includes(p.id));

        filtered.forEach((actionItem: ActionItem) => {
            this._actionItemManager.select(actionItem);
        });
    }

    /**
     * Show Action Items
     * @param ids - Array of Action Item ids that you want to show -
     */
    public show(ids?: string[]): void {
        const actionItems = this._actionItemManager.getActionItems();
        const filtered = !!ids ? actionItems.filter((p: ActionItem) => ids.includes(p.id)) : actionItems;

        filtered.forEach((actionItem: ActionItem) => {
            this._actionItemManager.show(actionItem);
        });
    }

    /**
     * Hide Action Items
     * @param ids - Array of Action Item ids that you want to hide -
     */
    public hide(ids?: string[]): void {
        const actionItems = this._actionItemManager.getActionItems();
        const filtered = !!ids ? actionItems.filter((p: ActionItem) => ids.includes(p.id)) : actionItems;

        filtered.forEach((actionItem: ActionItem) => {
            this._actionItemManager.hide(actionItem);
        });
    }

    public block(ids?: string[]) {
        const actionItems = this._actionItemManager.getActionItems();
        const filtered = !!ids ? actionItems.filter((p: ActionItem) => ids.includes(p.id)) : actionItems;

        filtered.forEach((actionItem: ActionItem) => {
            actionItem.block();
        });
    }

    public unblock(ids?: string[]) {
        const actionItems = this._actionItemManager.getActionItems();
        const filtered = !!ids ? actionItems.filter((p: ActionItem) => ids.includes(p.id)) : actionItems;

        filtered.forEach((actionItem: ActionItem) => {
            actionItem.unblock();
        });
    }

    /**
     * Observable fired when Action Item position has changed
     * @param ids - Array of Action Item ids that you want to subscribe to -
     */
    public onMove$(ids?: string[]): Observable<ActionItem> {
        return this._actionItemManager.onMoveTrigger$.pipe(
            filter((p: ActionItem) => !ids || (!!ids && ids.includes(p.id))),
        );
    }

    /**
     * Observable fired when pointer is over Action Item
     * @param ids - Array of Action Item ids that you want to subscribe to -
     */
    public onPointerOver$(ids?: string[]): Observable<ActionItem> {
        return this._actionItemManager.onPointerOverTrigger$.pipe(
            filter((p: ActionItem) => !ids || (!!ids && ids.includes(p.id))),
        );
    }

    /**
     * Observable fired when pointer leaves Action Item area
     * @param ids - Array of Action Item ids that you want to subscribe to -
     *
     */
    public onPointerOut$(ids?: string[]): Observable<ActionItem> {
        return this._actionItemManager.onPointerOutTrigger$.pipe(
            filter((p: ActionItem) => !ids || (!!ids && ids.includes(p.id))),
        );
    }

    /**
     * Observable fired when pointer selects Action Item
     * @param ids - Array of Action Item ids that you want to subscribe to -
     *
     */
    public onPick$(ids?: string[]): Observable<ActionItem> {
        return this._actionItemManager.onPickTrigger$.pipe(
            filter((p: ActionItem) => !ids || (!!ids && ids.includes(p.id))),
        );
    }

    /**
     * Resets all action items
     */
    public resetAll(): void {
        this._actionItemManager.resetActionItems();
    }
}
