# mv-webgl-pipeline-tools

WebGL Pipeline Tools project.
This set of tools can be used to convert fbx files to draco compressed glb files and to apply several optimization options.

## Prerequesites
Currently the tools only work on Windows.
NodeJS (> v8.0.0) and Python have to be installed on your machine.

In case you have no permission to install NodeJS, download the latest Windows Binary zip from [NodeJS](https://nodejs.org/en/download/) and extract the content to /local_npm .

The resulting file structure is expected to look like this:

```
|-- mv-webgl-pipeline-tools
     |-- local_npm
        |-- npm.cmd
        |-- node.exe
        |-- ...
```

Start the npm_starter.bat for the installation and to run the conversion process.

## Installation
|Command|Description|
|--|--|
|`npm install`| Installs dependencies. |

## Included Commands

|Command|Description|
|--|--|
|`npm run fbx_to_draco_glb`| Starts the fbx to glb conversion process with the options provided in the file config.json |

When using the npm_start.bat it is possible to use `run` instead of `npm run fbx_to_draco_glb`.

## Options
The options for the conversion process can be modified in the file config.json.

|Option|Description|
|--|--|
|`inputDirectory`| (string) Path to the directory where the fbx files are saved. Slashes have to be used instead of backslashes. |
|`outputDirectory`| (string) Path to the directory where the converted glb files are supposed to be saved. Slashes have to be used instead of backslashes. |
|`fileName`| (string, (optional)) File name inside of the input directory that is supposed to be converted to the output directory. If this property is not defined then all the files inside of the input directory are converted. |
|`mergeBySameMaterial`| (boolean) If this property is set to true  meshes that use the same material are merged together. |
|`mergeInstances`| (boolean) If this property is set to true instanced meshes that use the same material are merged together. |
|`runBlenderInBackground`| (boolean) If this property is set to true blender is running in the background instead of opening a window during the conversion process. |
|`ruleEnginePath`| (string, (optional)) This is a property that should only be used during file conversions in production mode! If this property is defined and points to a json based rule engine file then this file is used to merge multiple glb files into one if possible. For example all non configurable glb files would be merged into one file. |
|`materialMappingsJsonPath`| (string, (optional)) This is a property that should only be used during file conversions in production mode! If this property is defined and points to a json based material mappings file then this file is used to merge multiple material allocators that point to the same target material. E.g. if the allocators "v_metal_black_shiny" and "v_metal_black_matt" both point to the target material "v_metal_black.json" then all meshes that use this allocator are assigned to the material "ALLOCATOR_v_metal_black.json". Beacuase the original materials are renamed during the conversion process the old material_mappings.json file can no longer be used inside of the core application. Because of this a new mappings file is produced and saved to ".tmp/productionMappings.json" relative to the current working directory. |

