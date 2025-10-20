import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { EntityService } from '../entity/entity.service';
import { DataService, ProjectSettings } from '../data/data.service';
import { Core, MVRuleEngineProperty, MVEntity } from 'mv-core';

@Injectable({
  providedIn: 'root',
})
export class ConfigurationService {
  
  private _core: Core;
  private _entityUUID: string;

  private _properties$: BehaviorSubject<string[]> = new BehaviorSubject([]);
  private _activeProperties$: BehaviorSubject<string[]> = new BehaviorSubject([]);
  public properties$ = this._properties$.asObservable();
  public activeProperties$ = this._activeProperties$.asObservable();

  constructor(
    private _dataService: DataService,
    private _entityService: EntityService) {

      combineLatest([this._dataService.projectSettings$, this._dataService.core$, this._dataService.activeEntity$]).subscribe(
        async (data: [ProjectSettings, Core, MVEntity]) => {
          // this.projectSettings = data[0];
          this._core = data[1];
          // this.entityConfig = data[0].entityConfigFile;
          this._entityUUID = data[2].uuid;
          const ruleEngineJson = data[2].mv_ruleEngineConfig;
          this._properties$.next(ruleEngineJson.properties.map((property: MVRuleEngineProperty) => property.code));
          this._activeProperties$.next(ruleEngineJson.defaultConfigurationCodes);
        }
      );
  }

  async toggleProperty(code: string): Promise<void> {
    let currentlyActiveProperties = this._activeProperties$.getValue();
    const codeIsAlradyActive = !!currentlyActiveProperties.includes(code);
    if (codeIsAlradyActive) {
      currentlyActiveProperties = currentlyActiveProperties.filter((_code : string) => _code !== code);
    } else {
      currentlyActiveProperties.push(code);
    }
    this._activeProperties$.next(currentlyActiveProperties);
    this._entityService.activeEntityConfigurtionCodes = currentlyActiveProperties;
    await this._entityService.updateConfiguration();
  }

}
