import { Injectable } from '@angular/core';
import { ElectronService } from '../electron/electron.service';
import { FileAccessService } from '../file-access/file-access.service';
import { UserService } from '../user/user.service';
import { ConversionConfigJSON } from './converter.service';

@Injectable({
  providedIn: 'root',
})
export class FileGroupSetupService {
  constructor(
    private fileService: FileAccessService,
    private electronService: ElectronService,
    private userService: UserService
  ) {}

  async setupFileGroups(configJson: ConversionConfigJSON): Promise<FileGroup[]> {
    var inputGlbFileRegistry = [];

    if (!configJson.inputDirectory.endsWith('/')) {
      configJson.inputDirectory += '/';
    }

    if (!configJson.outputDirectory.endsWith('/')) {
      configJson.outputDirectory += '/';
    }

    const tmpDir = configJson.tmpPath;

    console.log('### Setting up file groups in progress...');

    if (!(window as any).electronAPI.existsSync(tmpDir)) {
      (window as any).electronAPI.mkdirSync(tmpDir);
    }

    if ((window as any).electronAPI.fsExistsSync(configJson.inputDirectory)) {
      (window as any).electronAPI.fsRmdirSync(configJson.inputDirectory + '/blender_fbx_export', {
        recursive: true,
      });
      (window as any).electronAPI.fsRmdirSync(configJson.inputDirectory + '/glb_no_draco', {
        recursive: true,
      });
      (window as any).electronAPI.fsReaddirSync(configJson.inputDirectory).forEach((fileName) => {
        if (fileName.endsWith('.fbx')) {
          inputGlbFileRegistry.push(fileName);
        }
      });
    }

    var fileGroups: FileGroup[] = [];

    let entityConfig;
    if (configJson.assetsBaseUrl && configJson.entityConfigFile) {
      entityConfig = require(configJson.assetsBaseUrl + configJson.entityConfigFile);
    }

    if (configJson.productionBuild && entityConfig && entityConfig.cwsId) {
      console.log('PRODUCTION BUILD');

      var ruleEngine = require(configJson.assetsBaseUrl + entityConfig.ruleEngineConfigUrlRelative);
      let nonConfigurarableFileName = ruleEngine.nonConfigurableFileName;
      if (
        !nonConfigurarableFileName &&
        ruleEngine.nonConfigurableLayers &&
        ruleEngine.nonConfigurableLayers.length > 0
      ) {
        nonConfigurarableFileName = ruleEngine.nonConfigurableLayers[0];
      }

      var nonConfigurableFileGroup: FileGroup = {
        name: 'NonConfiguable',
        outputFileName: nonConfigurarableFileName,
        files: [],
      };

      const data = await this.cwsResolve(entityConfig.cwsId);
      const allLayers = data.layers;

      const nonConfigurableLayerNames = ruleEngine.nonConfigurableLayers;

      for (var nonConfigurableLayerName of nonConfigurableLayerNames) {
        const allFileNames = inputGlbFileRegistry.filter((entry) => {
          return (
            entry == nonConfigurableLayerName + '.fbx' ||
            entry.includes(nonConfigurableLayerName + '_part_') ||
            entry.includes(nonConfigurableLayerName + '_RT_') ||
            entry.includes(nonConfigurableLayerName + '_socket_')
          );
        });

        allFileNames.forEach((fileName) => {
          nonConfigurableFileGroup.files.push(fileName);
        });
      }

      if (nonConfigurableFileGroup.files.length > 0) {
        fileGroups.push(nonConfigurableFileGroup);
      }

      const configurableLayerNames = allLayers
        .filter((layer) => {
          return !nonConfigurableLayerNames.includes(layer.name);
        })
        .reduce((results, current) => {
          results.push(current.name);
          return results;
        }, []);

      for (var configurableLayerName of configurableLayerNames) {
        const allFileNames = inputGlbFileRegistry.filter((entry) => {
          return (
            entry == configurableLayerName + '.fbx' ||
            entry.includes(configurableLayerName + '_part_') ||
            entry.includes(configurableLayerName + '_RT_') ||
            entry.includes(configurableLayerName + '_socket_') ||
            (entry.includes(configurableLayerName + '_RT_') && entry.includes('_socket_')) ||
            (entry.includes(configurableLayerName + '_part_') && entry.includes('_socket_'))
          );
        });

        if (allFileNames && allFileNames.length > 0) {
          fileGroups.push({
            name: configurableLayerName,
            outputFileName: configurableLayerName,
            files: allFileNames,
          });
        }
      }
    } else {
      for (var fileName of inputGlbFileRegistry) {
        const name = fileName.replace('.fbx', '');
        fileGroups.push({
          name: name,
          outputFileName: name,
          files: [fileName],
        });
      }
    }

    fileGroups.sort(function (a, b) {
      var textA = a.name.toUpperCase();
      var textB = b.name.toUpperCase();
      return textA < textB ? -1 : textA > textB ? 1 : 0;
    });

    var outputFileGroups = {
      groups: fileGroups,
    };
    var fileGroupsJson = JSON.stringify(outputFileGroups, null, 2);
    var fileGroupsJsonPath = tmpDir + '/file_groups.json';
    (window as any).electronAPI.fsWriteFileSync(fileGroupsJsonPath, fileGroupsJson);
    console.log('Write ' + fileGroupsJsonPath);
    console.log('### File group setup complete');

    return fileGroups;
  }

  async cwsResolve(cwsId) {
    let configurationString = '';

    const rawResponse = await fetch(
      `https://cws.digital.accenture.com/api/v1/coba_resources/${cwsId}/resolve`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Token  0dd216e266f30a4e0707f69cd8234b23592bddaf',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          configuration_string: configurationString,
        }),
      }
    );

    const content = await rawResponse.json();
    if (content.data == 'IN_PROGRESS') {
      return this.cwsResolve(cwsId);
    }
    return content.data;
  }
}

export interface FileGroup {
  name: string;
  outputFileName: string;
  files: string[];
}
