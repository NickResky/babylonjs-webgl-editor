// require('@babel/register')({
//   presets: [
//     [
//       '@babel/preset-env',
//       {
//         targets: {
//           esmodules: true,
//         },
//       },
//     ],
//   ]
// });

// const { Connection, auth_cra, serializer } = require('autobahn');

var appendSlash = function (path) {
    if (!path.endsWith('/')) {
        path += '/';
    }
    return path;
};

onchallenge = (session, method, extra) => {
    if (method === 'wampcra') {
        return auth_cra.sign('m1acke', extra.challenge);
    }
};

setupCwsWebSocket = () => {
    var options = {
        user: '',
        password: '',
        url: ''
    };

    var cwsSocket = new Connection({
        url: options.url,
        realm: 'realm1',
        max_retries: -1, // -1 = unlimited
        initial_retry_delay: 1,
        max_retry_delay: 10,
        authmethods: ['wampcra', 'cookie'],
        authid: options.user,
        onchallenge: (session, method, extra) => {
            if (method === 'wampcra') {
                return auth_cra.sign(options.password, extra.challenge);
            }
            throw new Error('Unknown challenge method [' + method + '].');
        },
        protocols: ['wamp.2.msgpack'],
        serializers: [
            new serializer.MsgpackSerializer(),
            new serializer.JSONSerializer()
        ]
    });

    return cwsSocket;
};

var getCWSData = async (session, cwsId) => {
    const data = await session.call(
        `mv.commands.get_coba_ui_product_config.${cwsId}.${this._sessionId}`,
        [`{\\"productId\\":${cwsId}}`]
    );
    const json = JSON.parse(data);
    return json;
};

var cwsResolve = async (cwsId) => {
    let configurationString = '';
    // if (configurationCodes?.length > 0) {
    //   configurationString = configurationCodes.reduce((acc, code: string) => {
    //     acc += code + ',';
    //     return acc;
    //   }, '');
    // }
    const rawResponse = await fetch(
        `https://cws.digital.accenture.com/api/v1/coba_resources/${cwsId}/resolve`,
        {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization:
                    'Token  0dd216e266f30a4e0707f69cd8234b23592bddaf',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                /* eslint-disable @typescript-eslint/camelcase */
                configuration_string: configurationString
            })
        }
    );

    const content = await rawResponse.json();
    if (content.data == 'IN_PROGRESS') {
        return cwsResolve(cwsId);
    }
    return content.data;
};

var fs = require('fs');
var rimraf = require('rimraf');
var configJson = require('./config.json');
const { config } = require('process');
var tmpDir = './_tmp';
const fetch = require('node-fetch');
var inputGlbFileRegistry = [];

if (!configJson.inputDirectory.endsWith('/')) {
    configJson.inputDirectory += '/';
}

if (!configJson.outputDirectory.endsWith('/')) {
    configJson.outputDirectory += '/';
}

if (configJson.tmpPath) {
    tmpDir = configJson.tmpPath;
}

console.log('### Setting up file groups in progress...');
console.log('tmp dir: ' + tmpDir);
console.log('input directory: ' + configJson.inputDirectory);

if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir);
}

if (fs.existsSync(configJson.inputDirectory)) {
    console.log('input directory exists');
    rimraf.sync(configJson.inputDirectory + '/blender_fbx_export');
    fs.readdirSync(configJson.inputDirectory).forEach((fileName) => {
        if (
            fileName.endsWith('.glb') ||
            fileName.endsWith('.fbx') ||
            fileName.endsWith('.FBX')
        ) {
            inputGlbFileRegistry.push(fileName);
        }
    });
    console.log('input files: ' + inputGlbFileRegistry.toString());
}

var setupFileGroups = async () => {
    console.log('### Running file group setup...');

    var fileGroups = [];

    let entityConfig;
    if (configJson.assetsBaseUrl && configJson.entityConfigFile) {
        entityConfig = require(
            configJson.assetsBaseUrl + configJson.entityConfigFile
        );
    }

    if (configJson.productionBuild && entityConfig) {
        console.log('PRODUCTION BUILD');

        var ruleEngine = require(
            configJson.assetsBaseUrl + entityConfig.ruleEngineConfigUrlRelative
        );
        let nonConfigurarableFileName = ruleEngine.nonConfigurableFileName;
        if (
            !nonConfigurarableFileName &&
            ruleEngine.nonConfigurableLayers &&
            ruleEngine.nonConfigurableLayers.length > 0
        ) {
            nonConfigurarableFileName = ruleEngine.nonConfigurableLayers[0];
        }
        const nonConfigurableLayerNames = ruleEngine.nonConfigurableLayers;

        var nonConfigurableFileGroup = {
            name: 'NonConfiguable',
            outputFileName: nonConfigurarableFileName,
            files: []
        };

        for (var inputFileName of inputGlbFileRegistry) {
            const layerName = inputFileName
                .split('.glb')[0]
                .split('_part_')[0]
                .split('_RT')[0]
                .split('_socket_')[0];

            const existingFileGroup = fileGroups.find((fileGroup) => {
                return fileGroup.name == layerName;
            });

            if (nonConfigurableLayerNames.includes(layerName)) {
                nonConfigurableFileGroup.files.push(inputFileName);
            } else if (existingFileGroup) {
                existingFileGroup.files.push(inputFileName);
            } else {
                fileGroups.push({
                    name: layerName,
                    outputFileName: layerName,
                    files: [inputFileName]
                });
            }
        }

        if (nonConfigurableFileGroup.files.length > 0) {
            fileGroups.push(nonConfigurableFileGroup);
        }

        // const data = await cwsResolve(entityConfig.cwsId);
        // const allLayers = data.layers;

        // const nonConfigurableLayerNames = ruleEngine.nonConfigurableLayers;

        // for (var nonConfigurableLayerName of nonConfigurableLayerNames) {
        //   const allFileNames = inputGlbFileRegistry.filter((entry) => {
        //     return (
        //       entry == nonConfigurableLayerName + '.glb'
        //       || entry.includes(nonConfigurableLayerName + '_part_')
        //       || entry.includes(nonConfigurableLayerName + '_RT_')
        //       || entry.includes(nonConfigurableLayerName + '_socket_')
        //     )
        //   });

        //   allFileNames.forEach((fileName) => {
        //     nonConfigurableFileGroup.files.push(fileName);
        //   });

        // }

        // if (nonConfigurableFileGroup.files.length > 0) {
        //   fileGroups.push(nonConfigurableFileGroup);
        // }

        // configurableLayerNames = allLayers.filter((layer) => {
        //   return !nonConfigurableLayerNames.includes(layer.name)
        // }).reduce((results, current) => {
        //   results.push(current.name);
        //   return results;
        // }, []);

        // for (var configurableLayerName of configurableLayerNames) {

        //   const allFileNames = inputGlbFileRegistry.filter((entry) => {
        //     return (
        //       entry == configurableLayerName + '.glb'
        //       || entry.includes(configurableLayerName + '_part_')
        //       || entry.includes(configurableLayerName + '_RT_')
        //       || entry.includes(configurableLayerName + '_socket_')
        //       || (entry.includes(configurableLayerName + '_RT_') && entry.includes('_socket_'))
        //       || (entry.includes(configurableLayerName + '_part_') && entry.includes('_socket_'))
        //     )
        //   });

        //   if (allFileNames && allFileNames.length > 0) {
        //     const firstFileName = allFileNames[0].replace('.glb', '');
        //     fileGroups.push({
        //       name: configurableLayerName,
        //       outputFileName: configurableLayerName,
        //       files: allFileNames
        //     });
        //   }
        // }
    } else {
        for (var fileName of inputGlbFileRegistry) {
            const name = fileName.replace('.fbx', '').replace('.glb', '');
            fileGroups.push({
                name: name,
                outputFileName: name,
                files: [fileName]
            });
        }
    }

    fileGroups.sort(function (a, b) {
        var textA = a.name.toUpperCase();
        var textB = b.name.toUpperCase();
        return textA < textB ? -1 : textA > textB ? 1 : 0;
    });

    var outputFileGroups = {
        groups: fileGroups
    };
    var fileGroupsJson = JSON.stringify(outputFileGroups, null, 2);
    var fileGroupsJsonPath = tmpDir + '/file_groups.json';
    fs.writeFileSync(fileGroupsJsonPath, fileGroupsJson);
    console.log('Write ' + fileGroupsJsonPath);
    console.log('### File group setup complete');

    // if (configJson.materialMappingsJsonPath && configJson.materialMappingsJsonPath.length > 0) {
    //   var materialMappingsJson = require(configJson.materialMappingsJsonPath);

    //   var originalMaterialNameToOutputName = {};
    //   var optimizedMaterialAllocators = [];
    //   var productionMappings = {
    //     materialAllocators: optimizedMaterialAllocators,
    //     switchMaterials: materialMappingsJson.switchMaterials
    //   }

    //   materialMappingsJson.materialAllocators.forEach(materialAllocator => {
    //     const optimizedMaterialName = 'ALLOCATOR_' + materialAllocator.mapping;
    //     originalMaterialNameToOutputName[materialAllocator.name] = optimizedMaterialName;
    //     const existingMapping = optimizedMaterialAllocators.find(a => {
    //       return a.name == optimizedMaterialName;
    //     })
    //     if (!existingMapping) {
    //       optimizedMaterialAllocators.push({
    //         name: optimizedMaterialName,
    //         mapping: materialAllocator.mapping
    //       })
    //     }
    //   });

    //   materialMappingsJson.switchMaterials.forEach(switchMaterial => {
    //     let productionSwitchMaterial;
    //     // if (!switchMaterial.group) {
    //       productionSwitchMaterial = {
    //         name: 'SWITCHMAT_' + switchMaterial.name,
    //         slots: switchMaterial.slots
    //       }
    //       originalMaterialNameToOutputName[switchMaterial.name] = switchMaterial.name;
    //       // productionMappings.switchMaterials.push(productionSwitchMaterial);
    //     // } else {
    //     //   productionSwitchMaterial = productionMappings.switchMaterials.find((m => {
    //     //     return m.name == switchMaterial.name
    //     //   }))
    //     //   if (!productionSwitchMaterial) {
    //     //     productionSwitchMaterial = {
    //     //       name: 'SWITCHMAT_' + switchMaterial.group,
    //     //       slots: switchMaterial.slots
    //     //     }
    //     //     originalMaterialNameToOutputName[switchMaterial.name] = productionSwitchMaterial.name;
    //     //     productionMappings.switchMaterials.push(productionSwitchMaterial);
    //       // }
    //     // }
    //   });

    //   var mappingJson = JSON.stringify(originalMaterialNameToOutputName, null, 2);

    //   var mappingsJsonPath = tmpDir + '/mappings.json';
    //   fs.writeFileSync(mappingsJsonPath, mappingJson);
    //   console.log('Write ' + mappingsJsonPath);

    //   var productionMappingsJson = JSON.stringify(productionMappings, null, 2);

    //   var productionMappingsJsonPath = tmpDir + '/productionMappings.json';
    //   fs.writeFileSync(productionMappingsJsonPath, productionMappingsJson);
    //   console.log('Write ' + productionMappingsJsonPath);
    // }
};

console.log('2');

setupFileGroups();
