
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

const appendSlash = (path) => {
    if (!path.endsWith('/')) {
        path += '/';
    }
    return path;
}
var fs = require('fs');
const gltfPipeline = require('gltf-pipeline');
const fbx2gltf = require('fbx2gltf');

const setReadAndWritePermissions = (filePath) => {
    let mode = fs.statSync(filePath).mode;
    let newMode = mode | 0o666;
    fs.chmodSync(filePath, newMode);
  }

var convert = async function() {

    var configJson = require('./config.json');

    var fbxDirectory = appendSlash(configJson.inputDirectory) + 'blender_fbx_export/';
    var glbDirectory = appendSlash(configJson.inputDirectory) + 'glb_no_draco/';
    var outputDirectory = appendSlash(configJson.outputDirectory);

    if (fs.existsSync(glbDirectory)) {
        fs.rmdirSync(glbDirectory, {
            recursive: true
        });
    }

    fs.mkdirSync(glbDirectory);

    console.log('### Running GLB conversion')

    const fbxFilenames = fs.readdirSync(fbxDirectory)
   
    let fbxIndex = 1;
    for (const filename of fbxFilenames) {
        console.log(filename);
        console.log('### Running GLB conversion (' + fbxIndex + '/' + fbxFilenames.length + ')')
        if (filename.endsWith('.fbx')) {
            const inputFilePath = fbxDirectory + filename
            const outputFilePath = glbDirectory + filename.replace('.fbx', '.glb')
            
            if (fs.existsSync(outputFilePath)) {
                setReadAndWritePermissions(outputFilePath)
            }
            
            const conversionPromise = new Promise((resolve, reject) => {
                fbx2gltf(inputFilePath, outputFilePath, []).then(
                    destPath => {
                        resolve();
                    },
                    error => {
                        console.log(`### Error converting ${inputFilePath} to ${outputFilePath}`)
                        reject();
                    }
                );
            })

            await conversionPromise;

        }
        fbxIndex++;
    }


    console.log('### Running Draco compression')
   
    const glbFilenames = fs.readdirSync(glbDirectory)
  
    let glbIndex = 1;
    for (const filename of glbFilenames) {
        console.log(filename);
        console.log('### Running Draco compression (' + glbIndex + '/' + glbFilenames.length + ')')
        if (filename.endsWith('.glb')) {

            if (configJson.preventDracoCompressionDuringBuild) {
                console.log('Draco Compression prevented because of entity config entry')
                fs.copyFileSync(glbDirectory + filename, outputDirectory + filename)
            } else {
                var glb = fs.readFileSync(glbDirectory + filename);
                if (!glb) {
                    console.log('error processing ' + filename)
                    return;
                }
                console.log('Processing file ' + filename);
        
                var options = {
                    dracoOptions: {
                        compressionLevel: 10,
                        compressMeshes: true
                    }
                };
                const results = await gltfPipeline.processGlb(glb, options)
                const filepath = outputDirectory + filename;
                try {
                    if (fs.existsSync(filepath)) {
                        setReadAndWritePermissions(filepath)
                    }
                    } catch(err) {
                    // console.error(err)
                    }
                
                fs.writeFileSync(filepath, results.glb);
            }
        } 
        glbIndex++;  
    }  


    const outputFileNames = fs.readdirSync(outputDirectory)
    
    const glbRegistryJson = JSON.stringify(outputFileNames, null, 2);
    const glbRegistryJsonPath = outputDirectory + 'glbFileRegistry.json';
    fs.writeFileSync(glbRegistryJsonPath, glbRegistryJson);  
    console.log('Write ' + glbRegistryJsonPath);
    console.log('### Draco compression complete');
}

convert();