import { Injectable } from '@angular/core';
import { Core, MVEntity, MVEntityConfig, MVRuleEngineJson } from 'mv-core';
import { DataService, ProjectSettings } from '../data/data.service';
import { ElectronService } from '../electron/electron.service';
import { FileAccessService, FileType } from '../file-access/file-access.service';
import { MaterialService } from '../material/material.service';
import { NotifierService } from '../notifier/notifier.service';
import { ProductionExportService } from './../production-export/production-export.service';
/**
 * Service to manage entities.
 */
@Injectable({
  providedIn: 'root',
})
export class EntityService {
  private _core: Core;
  private _entityBaseUrl: string;
  private _entityConfigFileName: string;
  private _entityConfigFile: MVEntityConfig;
  private _entities: MVEntity[] = [];
  private _activeEntity: MVEntity;
  private _activeCWSConfigurationCodes: string[];
  public activeEntityConfigurtionCodes: string[];
  private _sessionId: string;
  private _productionMode: boolean = false;
  public lightmapRegistryJSONFileName: string = 'registry';
  public glbFileRegistryJSONFileName: string = 'glbFileRegistry';

  constructor(
    private notifierService: NotifierService,
    private fileAccessService: FileAccessService,
    private dataService: DataService,
    private electronService: ElectronService,
    private materialService: MaterialService,
    private productionExportService: ProductionExportService
  ) {
    this.dataService.projectSettings$.subscribe((project: ProjectSettings) => {
      this._entityBaseUrl = project.baseProjectUrl;
      this._entityConfigFileName = project.entityConfigFileName;
      this._entityConfigFile = project.entityConfigFile;
      this._sessionId = project.sessionId;
      this._productionMode = project.productionMode;
    });
  }

  /**
   * Sets up the service. This function has to be called before the other service functions can be used.
   * @param {Core} core
   */
  public setup(core: Core) {
    this._core = core;
  }

  /**
   * Loads and displays an entity.
   */
  public async loadEntity(environmentId: string): Promise<MVEntity> {
    this._activeEntity = null;
    this.activeEntityConfigurtionCodes = [];
    this._activeCWSConfigurationCodes = [];

    const ruleEngine = await this.fileAccessService.getFile(
      this._entityBaseUrl.replace('file://', ''),
      this._entityConfigFile.ruleEngineConfigUrlRelative.replace('.json', ''),
      FileType.JSON
    );
    const ruleEngineJSON: MVRuleEngineJson = JSON.parse(ruleEngine);

    // let cwsWebSockt: Connection;
    this.activeEntityConfigurtionCodes = [
      ...ruleEngineJSON.defaultConfigurationCodes,
      environmentId,
    ];

    if (this._entityConfigFile.cwsId) {
      // cwsWebSockt = this.setupCwsWebSocket(this._entityConfigFile.cwsId);
      // console.log(`Requesting CWS configuration...`)
      // await new Promise((resolve) => {
      //   cwsWebSockt.onopen = async (session) => {
      //     this.subscribeToCWSConfigurationUpdates(session, this._entityConfigFile.cwsId);
      //     this._activeCWSConfigurationCodes = await this.getCurrentCWSConfiguration(session, this._entityConfigFile.cwsId);
      //     resolve(null);
      //   }
      //   cwsWebSockt.open();
      // });
    }

    const allConfigurationCodes = [
      ...this.activeEntityConfigurtionCodes,
      ...this._activeCWSConfigurationCodes,
    ];

    console.log(
      `Combining JSON files of entity ${
        this._entityBaseUrl.replace('file://', '') + this._entityConfigFileName
      } ...`
    );

    // const served_base = 'http://127.0.0.1:5500/';
    const served_base = this._entityBaseUrl.replace('file://', '');

    const combinedEntityConfigFile = await this.productionExportService.combineJsonFilesOfEntity({
      entityConfig: this._entityConfigFile,
      id: this._entityConfigFile.id,
      path: this._entityBaseUrl.replace('file://', '') + this._entityConfigFileName,
      root: this._entityBaseUrl.replace('file://', ''),
      log: '',
      status: null,
    });
    const combinedEntityConfigString = 'data:' + JSON.stringify(combinedEntityConfigFile);

    console.log(
      `Loading entity ${
        this._entityBaseUrl.replace('file://', '') + this._entityConfigFileName
      } ...`
    );

    const entity = await this._core.Product.loadProduct(
      combinedEntityConfigString,
      allConfigurationCodes,
      served_base
    );

    return entity;
  }

  // onchallenge(session, method, extra) {
  //   if (method === 'wampcra') {
  //     return auth_cra.sign('m1acke', extra.challenge);
  //   }
  // }

  // setupCwsWebSocket(cwsId: string): Connection {
  //   var options = {
  //       user: 'mackevision',
  //       password: '0koEWs!Dh7IXl?VfA',
  //       url: 'wss://stateline-prod/ws',
  //   }

  //   var cwsSocket = new Connection({
  //       url: options.url,
  //       realm: 'realm1',
  //       max_retries: -1, // -1 = unlimited
  //       initial_retry_delay: 1,
  //       max_retry_delay: 10,
  //       authmethods: ['wampcra', 'cookie'],
  //       authid: options.user,
  //       onchallenge: (session, method, extra) => {
  //           if (method === 'wampcra') {
  //               return auth_cra.sign(options.password, extra.challenge);
  //           }
  //           throw new Error('Unknown challenge method [' + method + '].');
  //       },
  //       protocols: ["wamp.2.msgpack"],
  //       serializers: [
  //           new serializer.MsgpackSerializer(),
  //           new serializer.JSONSerializer(),
  //       ],
  //   });

  //   return cwsSocket;
  // }

  subscribeToCWSConfigurationUpdates(cwsWebsocketSession, cwsId) {
    setTimeout(async () => {
      const newOptions = await this.getCurrentCWSConfiguration(cwsWebsocketSession, cwsId);
      if (this._activeEntity) {
        if (this._activeEntity?.entityConfig?.cwsId !== cwsId) {
          return;
        }
        if (!this.arraysEqual(newOptions, this._activeCWSConfigurationCodes)) {
          this._activeCWSConfigurationCodes = newOptions;
          this.dataService.setLoading(true);
          await this._core.stopRender();
          await this.updateConfiguration();
          this.dataService.setLoading(false);
          await this._core.startRender({
            fadeOutPreviousFrame: true,
          });
        }
      }

      this.subscribeToCWSConfigurationUpdates(cwsWebsocketSession, cwsId);
    }, 2000);
  }

  async updateConfiguration() {
    const allConfigurationCodes = [
      ...this.activeEntityConfigurtionCodes,
      ...this._activeCWSConfigurationCodes,
    ];
    await this._core.Product.updateConfiguration(this._activeEntity.uuid, allConfigurationCodes);
    this.materialService.setUnmappedMaterials();
  }

  public async toggleConfigurationCodes(codeToToggle: string[]) {
    if (!this._activeEntity) {
      return;
    }
    let activeOption: string;
    let activeOptionIndex: number = 0;
    let i = 0;
    this.activeEntityConfigurtionCodes.forEach((code: string) => {
      if (codeToToggle.includes(code)) {
        activeOption = code;
        activeOptionIndex = i;
      }
      i++;
    });
    if (activeOption) {
      const currentOptionIndex = codeToToggle.indexOf(activeOption);
      const nextOptionIndex =
        currentOptionIndex == codeToToggle.length - 1 ? 0 : currentOptionIndex + 1;
      const nextOption = codeToToggle[nextOptionIndex];
      this.activeEntityConfigurtionCodes[activeOptionIndex] = nextOption;
    } else {
      this.activeEntityConfigurtionCodes.push(codeToToggle[0]);
    }
    await this.updateConfiguration();
    this.materialService.setUnmappedMaterials();
  }

  public async updateEnvironmentConfigurationForProduct(
    previousEnvironmentId: string,
    nextEnvironmentId: string
  ) {
    if (this._activeEntity) {
      const environmentCodeIndex =
        this.activeEntityConfigurtionCodes?.indexOf(previousEnvironmentId);
      if (environmentCodeIndex >= 0) {
        this.activeEntityConfigurtionCodes[environmentCodeIndex] = nextEnvironmentId;

        await this.updateConfiguration();
        this.materialService.setUnmappedMaterials();
      }
    }
  }

  async getCurrentCWSConfiguration(session, cwsId: string) {
    const data = await session.call(
      `mv.commands.get_coba_ui_product_config.${cwsId}.${this._sessionId}`,
      [`{\\"productId\\":${cwsId}}`]
    );
    const json = JSON.parse(data);
    const chosenOptions = json?.chosenOptions;
    return chosenOptions;
  }

  /**
   * Create or update the registy.json of the Entity's lightmap textures.
   */
  public async updateLightmapRegistryJSON(): Promise<void> {
    const registryJSONUrl: string =
      this._entityBaseUrl.replace('file://', '') +
      this._entityConfigFile.lightmapTexturesUrlRelative;
    if (this._entityConfigFile.lightmapTexturesUrlRelative) {
      const getFilesFromLightmapTextureFolder = async (JSONUrl: string): Promise<string[]> => {
        return await this.fileAccessService.getFilesInDirectory(JSONUrl);
      };

      let fileListInFolder: string[] = await getFilesFromLightmapTextureFolder(registryJSONUrl);
      const lightmapRegistryExists: boolean =
        fileListInFolder.findIndex(
          (fileName) => fileName === this.lightmapRegistryJSONFileName + FileType.JSON
        ) > -1;

      fileListInFolder = fileListInFolder.filter((e) => e.includes(FileType.JPG));

      const newLightmapRegistry = {
        files: [],
      };

      if (lightmapRegistryExists) {
        for (let filename of fileListInFolder) {
          newLightmapRegistry.files.push(filename);
          let basename = filename.replace(FileType.JPG, '');
          if (!this.dataService.allowUppercase) {
            if (this.fileAccessService.hasUpperCase(basename)) {
              const errorMessage = `Lightmap texture: ${basename} contains characters with capital letters. This can cause errors. Only "a-z","0-9","-","_" are allowed. Please rename the file before you import it!`;
              //TODO At the moment the assets from artists do not follow the naming convention for materials, textures, meshes etc.
              // this.notifierService.notify('error', errorMessage);
              console.warn(errorMessage);
            }
          }

          if (this.fileAccessService.hasInvalidCharacters(basename)) {
            const errorMessage = `Lightmap texture: ${basename} includes forbidden characters. Only "a-z","0-9","-","_" are allowed. Please rename the file before you import it!`;
            this.notifierService.notify('warning', errorMessage);
            console.warn(errorMessage);
          }
        }

        await this.fileAccessService.updateFile(
          registryJSONUrl,
          this.lightmapRegistryJSONFileName,
          FileType.JSON,
          JSON.stringify(newLightmapRegistry, null, 2)
        );
      } else {
        await this.fileAccessService.addFile(
          registryJSONUrl,
          this.lightmapRegistryJSONFileName,
          FileType.JSON,
          JSON.stringify(newLightmapRegistry, null, 2)
        );
        fileListInFolder.length > 0 && this.updateLightmapRegistryJSON();
      }
    }
  }

  /**
   * Create or update the glbFileRegistry.json with glb files.
   */
  public async updateGlbFileRegistryJSON(entityConfigFile: MVEntityConfig): Promise<void> {
    let relativeMeshesUrl = entityConfigFile.meshesUrlRelative;
    if (this._productionMode && entityConfigFile.productionMeshesUrlRelative) {
      relativeMeshesUrl = entityConfigFile.productionMeshesUrlRelative;
    }
    const absoluteMeshesUrl: string =
      this._entityBaseUrl.replace('file://', '') + relativeMeshesUrl;

    if (relativeMeshesUrl) {
      let filesInMeshesDirectory: string[] = await this.fileAccessService.getFilesInDirectory(
        absoluteMeshesUrl
      );

      const glbFileRegistryExists: boolean = filesInMeshesDirectory.includes(
        this.glbFileRegistryJSONFileName + FileType.JSON
      );

      filesInMeshesDirectory = filesInMeshesDirectory.filter((fileName) =>
        fileName.includes(FileType.GLB)
      );

      const newGlbFileRegistry = [];

      if (!glbFileRegistryExists) {
        await this.fileAccessService.addFile(
          absoluteMeshesUrl,
          this.glbFileRegistryJSONFileName,
          FileType.JSON,
          JSON.stringify(newGlbFileRegistry, null, 2)
        );
      }
      for (let filename of filesInMeshesDirectory) {
        newGlbFileRegistry.push(filename);
        if (!this.dataService.allowUppercase) {
          if (this.fileAccessService.hasUpperCase(filename)) {
            const errorMessage = `glb files: ${filename} contains characters with capital letters. This can cause errors. Only "a-z","0-9","-","_" are allowed. Please rename the file before you import it!`;
            //TODO At the moment the assets from artists do not follow the naming convention for materials, textures, meshes etc.
            // this.notifierService.notify('error', errorMessage);
            console.warn(errorMessage);
          }
        }

        if (this.fileAccessService.hasInvalidCharacters(filename)) {
          const errorMessage = `glb files: ${filename} includes forbidden characters. Only "a-z","0-9","-","_" are allowed. Please rename the file before you import it!`;
          this.notifierService.notify('warning', errorMessage);
          console.warn(errorMessage);
        }
      }
      await this.fileAccessService.updateFile(
        absoluteMeshesUrl,
        this.glbFileRegistryJSONFileName,
        FileType.JSON,
        JSON.stringify(newGlbFileRegistry, null, 2)
      );
    }
  }

  /**
   * Removes an entity
   * @param {any} animationDetails
   */
  public async updateEntityAnimationsConfig(animationDetails: any): Promise<void> {
    for (let animation of this._entityConfigFile.animations) {
      if (animation.fileUrl.includes(animationDetails.name)) {
        animation.speedRatio = animationDetails.speedRatio;
      }
    }
    this.fileAccessService
      .updateFile(
        this._entityBaseUrl.replace('file://', ''),
        this._entityConfigFileName.replace('.json', ''),
        FileType.JSON,
        JSON.stringify(this._entityConfigFile, null, 2)
      )
      .then(
        () => {
          console.log('Success');
          this.notifierService.notify('success', 'The entity JSON has been saved successfully.');
        },
        () => {
          console.log('reject');
          this.notifierService.notify('error', 'Error while saving the entity JSON.');
        }
      );
  }

  /**
   * {MVEntity} Adds an entity
   * @param entity
   */
  public addEntity(entity: MVEntity) {
    this._entities.push(entity);
    this.dataService.addEntity(entity);
  }

  /**
   * Removes an entity
   * @param {MVEntity} entity
   */
  public removeEntity(entity: MVEntity): void {
    const removeIndex = this._entities.findIndex((entity) => entity.name == entity.name);
    if (removeIndex >= 0) {
      this._entities.splice(removeIndex, 1);
    }
  }

  public setActiveEntity(entity: MVEntity): void {
    this._activeEntity = entity;
    this.dataService.setActiveEntity(this._activeEntity);
  }

  public getActiveEntity(): MVEntity {
    return this._activeEntity;
  }

  arraysEqual(_arr1, _arr2) {
    if (!Array.isArray(_arr1) || !Array.isArray(_arr2) || _arr1.length !== _arr2.length)
      return false;

    var arr1 = _arr1.concat().sort();
    var arr2 = _arr2.concat().sort();

    for (var i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  }

  public async getAllEntityUrlsInBaseDirectory(
    reference?: string
  ): Promise<{ url: string; entityConfig: MVEntityConfig }[]> {
    const urlEntityConfigMapping: {
      url: string;
      entityConfig: MVEntityConfig;
    }[] = [];
    const entityBaseUrl = this._entityBaseUrl.replace('file://', '');

    const filesInBaseDirectory = await this.fileAccessService.getFilesInDirectory(entityBaseUrl);

    for (let fileName of filesInBaseDirectory) {
      if (fileName.endsWith('.json')) {
        const jsonString: any = await this.fileAccessService.getFile(
          entityBaseUrl,
          fileName.replace('.json', ''),
          FileType.JSON
        );
        const json = JSON.parse(jsonString);

        if (json['meshesUrlRelative']) {
          let conditionMet = true;
          if (reference) {
            conditionMet = jsonString.includes(reference);
          }

          if (conditionMet) {
            urlEntityConfigMapping.push({
              url: fileName,
              entityConfig: json,
            });
          }
        }
      }
    }

    return urlEntityConfigMapping;
  }

  /**
   * Checks if the given mesh file belongs to the active entity.
   *
   * @param {string} meshFileName - The name of the mesh file.
   */
  public async isMeshFilePartOfActiveEntity(meshFileName: string): Promise<boolean> {
    const fullPath =
      this._entityBaseUrl.replace('file://', '') +
      this._activeEntity.entityConfig.meshesUrlRelative;
    const filesInMeshDirectory: string[] = await this.fileAccessService.getFilesInDirectory(
      fullPath
    );

    return filesInMeshDirectory.includes(meshFileName);
  }
}
