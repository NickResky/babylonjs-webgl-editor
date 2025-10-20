import { Injectable } from '@angular/core';
import {
  ActionItem,
  ActionItemOptionsJSON,
  ActionItemsOptionsJSON,
  Core,
  MVEntityConfig,
  PlayAnimationOptions,
} from 'mv-core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CameraService } from '../camera/camera.service';
import { ProjectSettings } from '../data/data.service';
import { EntityService } from '../entity/entity.service';
import { FileAccessService, FileType } from '../file-access/file-access.service';
import { NotifierService } from '../notifier/notifier.service';

@Injectable({
  providedIn: 'root',
})
export class ActionItemService {
  private _core: Core;
  private _actionItems: ActionItem[];
  private _actionItems$: BehaviorSubject<ActionItem[]> = new BehaviorSubject([]);
  public actionItems$: Observable<ActionItem[]> = this._actionItems$.asObservable();

  public entityConfigFile: MVEntityConfig;
  public entityBaseUrl: string;
  private _trimmedBaseUrl: string;
  private _trimmedActionItemFileName: string;

  constructor(
    private _fileService: FileAccessService,
    private _notifierService: NotifierService,
    private _entityService: EntityService,
    private _cameraService: CameraService
  ) {}

  public async setupActionItems(core: Core, project: ProjectSettings): Promise<void> {
    this.entityBaseUrl = project.baseProjectUrl;
    this.entityConfigFile = project.entityConfigFile;
    this._trimmedBaseUrl = this.entityBaseUrl.replace('file://', '');
    this._trimmedActionItemFileName = this.entityConfigFile.actionItemUrlRelative?.replace(
      '.json',
      ''
    );

    this._core = core;
    await this.updateActionItemOnScene(true);

    this._core.ActionItem.onPick$().subscribe(async (actionItem) => {
      actionItem.block();
      console.log(`[Frontend] ActionItem ${actionItem.id} clicked`);
      const hasMultipleStates = actionItem.getStates().length > 1;
      const cameraId = actionItem.getOptions()['cameraId'];
      if (hasMultipleStates || cameraId) {
        actionItem.playFadeAnimation();
      }

      const playAnimationOptions: PlayAnimationOptions = {};
      const to = actionItem.getNextState().animationFrame || null;
      if (to) {
        playAnimationOptions.to = to;
      }

      await core.Animation.play(actionItem.id, null, playAnimationOptions);

      const actionItemOptions = actionItem.getOptions();
      if (actionItemOptions.toggleProductConfigurationCodes) {
        this._entityService.toggleConfigurationCodes(
          actionItemOptions.toggleProductConfigurationCodes
        );
      }

      if (cameraId) {
        const isMobileCameraActive = this._cameraService.isMobileCameraActive();
        await this._cameraService.requestCameraShot(cameraId, isMobileCameraActive);
      }

      actionItem.nextState();
      actionItem.unblock();
    });
  }

  public changeActionItem(newStateID: string, actionItemID: string): void {
    const currentActionItem: ActionItem =
      this._actionItems &&
      this._actionItems.find((actionItem: ActionItem) => actionItem.id == actionItemID);
    currentActionItem.setState(newStateID);
  }

  private async readActionItemJSON(): Promise<ActionItemsOptionsJSON> {
    return JSON.parse(
      await this._fileService.getFile(
        this._trimmedBaseUrl,
        this._trimmedActionItemFileName,
        FileType.JSON
      )
    ) as ActionItemsOptionsJSON;
  }

  private async updateActionItemOnScene(isInit: boolean = false): Promise<void> {
    !isInit && this._core.ActionItem.resetAll();
    if (this.entityConfigFile.actionItemUrlRelative) {
      this._actionItems = await this._core.ActionItem.load(
        this.entityConfigFile.actionItemUrlRelative
      );
      this._actionItems$.next(this._actionItems);
    }
  }

  public async updateActionItemsPosition(): Promise<void> {
    const actionItemsJSON = await this.readActionItemJSON();
    this._actionItems.forEach((item) => {
      const updatedPositon = item.plane.position;
      const currentState = item.getState();

      const currentActionItemJSON = actionItemsJSON.actionItems.find(
        (actionItemJSON) => actionItemJSON.id === item.id
      );
      const currentActionItemStateJSON = currentActionItemJSON.states.find(
        (stateJSON) => stateJSON.id === currentState.id
      );
      currentActionItemStateJSON.position = updatedPositon.asArray();
    });
    await this._fileService.updateFile(
      this._trimmedBaseUrl,
      this._trimmedActionItemFileName,
      FileType.JSON,
      JSON.stringify(actionItemsJSON, null, 2)
    );
    await this.updateActionItemOnScene();
    this._notifierService.notify('success', 'Action Item succesfully saved.');
  }

  public async addNewActionItem(newDefaultActionItem: ActionItemOptionsJSON): Promise<void> {
    const actionItemsJSON = await this.readActionItemJSON();
    actionItemsJSON.actionItems.unshift(newDefaultActionItem);

    await this._fileService.updateFile(
      this._trimmedBaseUrl,
      this._trimmedActionItemFileName,
      FileType.JSON,
      JSON.stringify(actionItemsJSON, null, 2)
    );
    await this.updateActionItemOnScene();
    this._notifierService.notify('success', 'Action Item succesfully added.');
  }

  public async renameActionItem(id: string, newName: string) {
    const actionItemsJSON = await this.readActionItemJSON();
    const isNewNameInUse: boolean = actionItemsJSON.actionItems
      .map((actionItem) => actionItem.id.toLowerCase())
      .includes(newName.toLowerCase());
    if (!isNewNameInUse) {
      newName = this._fileService.sanitizeFileName(newName);
      actionItemsJSON.actionItems.forEach((item) => {
        if (item.id === id) {
          item.id = newName;
        }
      });

      await this._fileService.updateFile(
        this._trimmedBaseUrl,
        this._trimmedActionItemFileName,
        FileType.JSON,
        JSON.stringify(actionItemsJSON, null, 2)
      );
      await this.updateActionItemOnScene();
      this._notifierService.notify('success', 'Action Item succesfully renamed.');
    } else {
      this._notifierService.notify(
        'error',
        'This action item ID already in use. Please select a different name!'
      );
    }
  }

  public async renameCurrentState(
    newStateID: string,
    currentStateID: string,
    actionItemID: string
  ) {
    const actionItemsJSON = await this.readActionItemJSON();
    const currentItem = actionItemsJSON.actionItems.find(
      (actionItem) => actionItem.id === actionItemID
    );
    const isNewStateNameInUse: boolean = currentItem.states
      .map((state) => state.id)
      .includes(newStateID);

    if (!isNewStateNameInUse) {
      newStateID = this._fileService.sanitizeFileName(newStateID);
      currentItem.states.forEach((state) => {
        if (state.id === currentStateID) {
          state.id = newStateID;
        }
      });

      await this._fileService.updateFile(
        this._trimmedBaseUrl,
        this._trimmedActionItemFileName,
        FileType.JSON,
        JSON.stringify(actionItemsJSON, null, 2)
      );
      await this.updateActionItemOnScene();
      this._notifierService.notify('success', 'Action Item state succesfully renamed.');
    } else {
      this._notifierService.notify(
        'error',
        'This state name already in use. Please select a different state name.'
      );
    }
  }

  public async deleteActionItem(id: string): Promise<void> {
    const actionItemsJSON = await this.readActionItemJSON();
    const currentActionItemIndex: number = actionItemsJSON.actionItems.findIndex(
      (item) => item.id === id
    );
    actionItemsJSON.actionItems.splice(currentActionItemIndex, 1);

    await this._fileService.updateFile(
      this._trimmedBaseUrl,
      this._trimmedActionItemFileName,
      FileType.JSON,
      JSON.stringify(actionItemsJSON, null, 2)
    );
    await this.updateActionItemOnScene();
    this._notifierService.notify('success', 'Action Item succesfully deleted.');
  }

  public async addNewState(actionItemID: string, newStateName: string) {
    const actionItemsJSON = await this.readActionItemJSON();
    const currentActionItemJSON = actionItemsJSON.actionItems.find(
      (item) => item.id === actionItemID
    );
    const isNewStateNameInUse: boolean = currentActionItemJSON.states
      .map((state) => state.id.toLowerCase())
      .includes(newStateName.toLowerCase());

    if (!isNewStateNameInUse) {
      const currentActionItemStateJSON = currentActionItemJSON.states;
      newStateName = this._fileService.sanitizeFileName(newStateName);
      const newState = {
        id: newStateName,
        position: [1.5, 0, 1.5],
      };

      currentActionItemStateJSON.push(newState);

      await this._fileService.updateFile(
        this._trimmedBaseUrl,
        this._trimmedActionItemFileName,
        FileType.JSON,
        JSON.stringify(actionItemsJSON, null, 2)
      );
      await this.updateActionItemOnScene();
      this._notifierService.notify('success', 'New Action Item state succesfully created.');
    } else {
      this._notifierService.notify(
        'error',
        'This state name already in use. Please select a different state name.'
      );
    }
  }
}
