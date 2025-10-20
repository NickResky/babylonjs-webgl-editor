import { Injectable } from '@angular/core';
import { ElectronService } from '../electron/electron.service';
import { FileAccessService } from '../file-access/file-access.service';
import { UserService } from '../user/user.service';
import { ConversionConfigJSON } from './converter.service';
// const gltfPipeline = require("gltf-pipeline");

@Injectable({
  providedIn: 'root',
})
export class DracoCompressionService {
  constructor(
    private fileService: FileAccessService,
    private electronService: ElectronService,
    private userService: UserService
  ) {}

  appendSlash(path) {
    if (!path.endsWith('/')) {
      path += '/';
    }
    return path;
  }

  async convert(options: ConversionConfigJSON) {
    var inputDirectory = this.appendSlash(options.inputDirectory) + '/blender_fbx_export/';
    var outputDirectory = this.appendSlash(options.outputDirectory);

    (window as any).electronAPI.readdir(inputDirectory, async (err, filenames) => {
      if (err) {
        return;
      }
      for (const filename of filenames) {
        console.log(filename);
        if (filename.endsWith('.glb')) {
          var glb = (window as any).electronAPI.readFileSync(inputDirectory + filename);
          if (!glb) {
            console.log('error processing ' + filename);
            return;
          }
          console.log('Processing file ' + filename);
          var dracoFileName = filename.substring(0, filename.length - 4);
          dracoFileName = dracoFileName + '_draco.glb';

          var options = {
            dracoOptions: {
              compressionLevel: 10,
              compressMeshes: true,
            },
          };
          // const results = await gltfPipeline.processGlb(glb, options)
          // fs.writeFileSync(outputDirectory + filename, results.glb);
        }
      }
      (window as any).electronAPI.fsReaddir(outputDirectory, (err, outputFileNames) => {
        const glbRegistryJson = JSON.stringify(outputFileNames, null, 2);
        const glbRegistryJsonPath = outputDirectory + 'glbFileRegistry.json';
        (window as any).electronAPI.fsWriteFileSync(glbRegistryJsonPath, glbRegistryJson);
        console.log('Write ' + glbRegistryJsonPath);
      });
    });
  }
}
