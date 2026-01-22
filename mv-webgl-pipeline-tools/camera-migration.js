var fs = require('fs');
var fsPath = require('path');
const sizeOf = require('image-size');
const sharp = require('sharp');

let targetDimensionOverwritesForFiles;
let targetSettingsForDirectories;
let conversionTarget;
const conversionSettings = [];

const ensureDirectoryExists = (path) => {
    if (!fs.existsSync(path)){
        fs.mkdirSync(path, {
            recursive: true
        });
    }
}

const analyzeFiles = async (inputDirectory, outputDirectory) => {
    const pathsInInputDir = fs.readdirSync(inputDirectory);

    ensureDirectoryExists(outputDirectory);

    for (path of pathsInInputDir) {
        const extension = fsPath.extname(path).replace('.', '');
        const fullInputPath = inputDirectory + path;
        const fullOutputPath = outputDirectory + path;
        const pathIsDirectory = fs.lstatSync(fullInputPath).isDirectory();

        if (!pathIsDirectory && extension == 'json') {
            const json = require(fullInputPath );
            if (json.cameraShotUrlsRelative && json.cameraShotUrlsRelative.length > 0) {
                for (cameraUrl of json.cameraShotUrlsRelative) {
                    console.log(cameraUrl);

                    const cameraShotId = fsPath.basename(cameraUrl).replace('.json', '')
                    const cameraShotIdWithoutMobileSuffix = cameraShotId.replace('_mobile', '')

                    if (!json.cameraShots) {
                        json.cameraShots = {}
                    }

                    if (!json.cameraShots[cameraShotIdWithoutMobileSuffix]) {
                        json.cameraShots[cameraShotIdWithoutMobileSuffix] = {}
                    }

                    if (cameraUrl.includes('_mobile')) {
                        json.cameraShots[cameraShotIdWithoutMobileSuffix].mobileUrlRelative = cameraUrl;
                    } else {
                        json.cameraShots[cameraShotIdWithoutMobileSuffix].urlRelative = cameraUrl;
                    }
                }

                // delete json.cameraShotUrlsRelative;

                var outputJson = JSON.stringify(json, null, 2);
                fs.writeFileSync(fullOutputPath, outputJson);
            }
        }
    }
}


const setupScript = async function() {
    const arguments = process.argv.slice(2);
    console.log('Migrating cameras');
    console.log(`arguments: ${arguments}`);
    
    if (arguments && arguments.length >= 2) {
        let inputDirectory = arguments[0];
        let outputDirectory = arguments[1];
    
        if (!fs.existsSync(inputDirectory)) {
            console.error(`Input directory ${inputDirectory} does not exist`);
            return;
        }
    
        if (!inputDirectory.endsWith('/')) {
            inputDirectory += '/';
        }
        if (!outputDirectory.endsWith('/')) {
            outputDirectory += '/';
        }

        analyzeFiles(inputDirectory, outputDirectory);

    } else {
        console.error(`
            Missing command line arguments (expected 2).
            First argument is the input directory.
            Second argument is the output directory.
        `);
    }
}

setupScript();


