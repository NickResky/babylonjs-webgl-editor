import { Injectable } from '@angular/core';
import { Mesh } from 'babylonjs';
import { MVEntityConfig, MVMeshSetting, MVMeshSettingsJson } from 'mv-core';
import { DataService, ProjectSettings } from '../data/data.service';
import { EntityService } from '../entity/entity.service';
import { EnvironmentService } from '../environment/environment.service';
import { FileAccessService, FileType } from '../file-access/file-access.service';
import { NotifierService } from '../notifier/notifier.service';

const ALPHA_INDEX_DEFAULT: number = 1.7976931348623157e308;
const HIDE_ON_CAMERA_DEFAULT: boolean = false;
const BOUNDING_BOX_SCALE_DEFAULT: number = 1.0;

@Injectable({
  providedIn: 'root',
})
export class MeshService {
  private project: ProjectSettings;
  private entityConfig: MVEntityConfig;

  constructor(
    private fileService: FileAccessService,
    private notifier: NotifierService,
    private dataService: DataService,
    private environmentService: EnvironmentService,
    private entityService: EntityService
  ) {
    this.dataService.projectSettings$.subscribe(async (project) => {
      this.project = project;
      this.entityConfig = project.entityConfigFile;
    });
  }

  /**
   * Callback function used to handle the 'Save Mesh Settings' user
   * interaction. Mesh settings are only saved in case at least one
   * setting differs from its default value or its previous value.
   *
   * @param {Mesh} mesh - The mesh for which the mesh settngs should be saved.
   */
  public async onSaveMeshSettingsClicked(mesh: Mesh): Promise<void> {
    const jsonFileData = await this.findMeshSettingsJSONPathAndName(mesh);

    if (jsonFileData.basePath == null || jsonFileData.fileName == null) {
      this.notifier.notify('error', 'Unable to identify correct mesh settings JSON.');
    } else {
      const meshSettingsJSON: MVMeshSettingsJson = await this.readMeshSettingsJSON(
        jsonFileData.basePath,
        jsonFileData.fileName
      );
      let meshSetting: MVMeshSetting = meshSettingsJSON.meshes.find((item) => {
        if ('id' in item && item.id == mesh.id) {
          return true;
        } else {
          return false;
        }
      });
      if (meshSetting == undefined) {
        meshSetting = {
          id: mesh.id,
        };
        meshSettingsJSON.meshes.push(meshSetting);
      }

      let meshSettingsUpdated = false;
      if (
        this.settingRequiresUpdate(mesh.alphaIndex, meshSetting.alphaIndex, ALPHA_INDEX_DEFAULT)
      ) {
        meshSetting.alphaIndex = mesh.alphaIndex;
        meshSettingsUpdated = true;
      }
      if (
        this.settingRequiresUpdate(
          mesh['hideOnCameraIntersect'],
          meshSetting.hideOnCameraIntersect,
          HIDE_ON_CAMERA_DEFAULT
        )
      ) {
        meshSetting.hideOnCameraIntersect = mesh['hideOnCameraIntersect'];
        meshSettingsUpdated = true;
      }
      if (
        this.settingRequiresUpdate(
          mesh['boundingBoxScale'],
          meshSetting.boundingBoxScale,
          BOUNDING_BOX_SCALE_DEFAULT
        )
      ) {
        meshSetting.boundingBoxScale = mesh['boundingBoxScale'];
        meshSettingsUpdated = true;
      }

      if (meshSettingsUpdated == true) {
        await this.fileService.updateFile(
          jsonFileData.basePath,
          jsonFileData.fileName,
          FileType.JSON,
          JSON.stringify(meshSettingsJSON, null, 2)
        );
        this.notifier.notify('success', 'Mesh settings succesfully saved.');
      } else {
        this.notifier.notify(
          'success',
          'Mesh settings do not contain changes and are therefore not saved.'
        );
      }
    }
  }

  /**
   * Determines the correct mesh settings file for the given mesh.
   *
   * @param {Mesh} mesh - The mesh for which the mesh settngs file is
   *                      determined.
   */
  private async findMeshSettingsJSONPathAndName(
    mesh: Mesh
  ): Promise<{ basePath: string; fileName: string }> {
    // The fileName property is a custom property on the mesh added by the editor.
    const meshFileName = mesh['fileName'];

    let fileData = {
      basePath: null,
      fileName: null,
    };

    // The mesh is either part of the current product or the current environment
    if (await this.entityService.isMeshFilePartOfActiveEntity(meshFileName)) {
      const fullPath = this.project.baseProjectUrl + this.entityConfig.meshSettingsRelative;
      fileData.basePath = this.fileService.getDirName(fullPath).replace('file://', '');
      fileData.fileName = this.fileService.getFileName(fullPath).replace(FileType.JSON, '');
    } else if (await this.environmentService.isMeshFilePartOfSelectedEnvironment(meshFileName)) {
      const fullPath =
        this.project.baseProjectUrl +
        this.environmentService.getSelectedEnvironmentEntity().entityConfig.meshSettingsRelative;
      fileData.basePath = this.fileService.getDirName(fullPath).replace('file://', '');
      fileData.fileName = this.fileService.getFileName(fullPath).replace(FileType.JSON, '');
    }

    return fileData;
  }

  /**
   * Reads a mesh settings JSON file.
   *
   * @param {string} basePath - The base path to the JSON file.
   * @param {string} fileName - The name of the mesh settings JSON file.
   */
  private async readMeshSettingsJSON(
    basePath: string,
    fileName: string
  ): Promise<MVMeshSettingsJson> {
    return JSON.parse(
      await this.fileService.getFile(basePath, fileName, FileType.JSON)
    ) as MVMeshSettingsJson;
  }

  /**
   * Checks if a mesh setting requires an update. A mesh setting
   * requires an update in case the new value differs from its old
   * value or in case it differs from the default value if it was
   * never stored before.
   *
   * @param {any} newValue - The new setting value.
   * @param {any} oldValue - The old setting value.
   * @param {any} defaultValue - The default value of the setting.
   */
  private settingRequiresUpdate(newValue: any, oldValue: any, defaultValue: any) {
    if (oldValue == undefined) {
      // Nothing was stored so far for this setting
      return newValue != defaultValue;
    } else {
      return newValue != oldValue;
    }
  }
}
