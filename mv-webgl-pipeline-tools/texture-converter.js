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

const analyzeMobileTextures = async (inputDirectory, outputDirectory, currentRelativePath) => {
    const pathsInCurrentDirectory = fs.readdirSync(inputDirectory + currentRelativePath);

    for (path of pathsInCurrentDirectory) {
        const extension = fsPath.extname(path).replace('.', '');
        const relativePath = currentRelativePath + path;
        const fullInputPath = inputDirectory + relativePath;
        const fullOutputPath = outputDirectory + relativePath;
        const pathIsDirectory = fs.lstatSync(fullInputPath).isDirectory();
        const directoryPath = fsPath.dirname(fullOutputPath); 

        if (pathIsDirectory) {
            await analyzeMobileTextures(inputDirectory, outputDirectory, relativePath + '/');

        } else if (extension === 'jpg' || extension === 'jpeg' || extension === 'png') {
            console.log(`file: ${path}`);
            
            try {
                const imageWidth = sizeOf(fullInputPath).width;
                
                let targetWidth = imageWidth;

                if (conversionTarget == 'MOBILE') {
                    targetWidth = 256;
             
                    if (imageWidth > 1024) {
                        targetWidth = 512;
                    }
                    if (imageWidth > 2048) {
                        targetWidth = 1024;
                    }
                }                    
                
                if (targetSettingsForDirectories) {
                    for (directory of Object.keys(targetSettingsForDirectories)) {
                        var path = directory.replace('*', '')
                        if (fullInputPath.includes(path)) {
                            var directorySetting = targetSettingsForDirectories[directory];
                            var overwrite = getTargetWithFromDirectorySetting(directorySetting, imageWidth);
                            if (overwrite) {
                                console.log(`Directory overwrite dimensions (${directorySetting}) : ${overwrite}`);
                                targetWidth = overwrite;
                            }
                        }
                    }
                }

                const overwriteDimensions = targetDimensionOverwritesForFiles ? targetDimensionOverwritesForFiles[relativePath] : null;
                if (overwriteDimensions) {
                    console.log(`Overwrite dimensions: ${overwriteDimensions}`);
                    targetWidth = overwriteDimensions;
                }

                ensureDirectoryExists(directoryPath);

                conversionSettings.push({
                    extension: extension,
                    fullInputPath: fullInputPath,
                    targetWidth: targetWidth,
                    quality: 50,
                    fullOutputPath: fullOutputPath
                })
 
            } catch(error) {
                console.error(`Failed to convert ${fullInputPath}`)
                console.error(error);
            }

        } else {
            try {
                ensureDirectoryExists(directoryPath);
                fs.copyFileSync(fullInputPath, fullOutputPath);
            } catch(error) {
                console.error(`Failed to copy ${fullInputPath}`)
                console.error(error);
            }
        }
    }
}

const getTargetWithFromDirectorySetting = function(directorySetting, originalWidth) {
    var targetWidth = null;
    switch(directorySetting) {
        case "MOBILE_NO_COMPRESSION":
            targetWidth = originalWidth;
            if (originalWidth >= 2048) {
                targetWidth = 2048;
            }
            break;
        case "MOBILE_MEDIUM_COMPRESSION":
            targetWidth = 256;
          
            if (originalWidth >= 1024) {
                targetWidth = 512;
            }
            if (originalWidth >= 2048) {
                targetWidth = 1024;
            }
            if (originalWidth >= 4000) {
                targetWidth = 2048;
            }
            break;
        default:
            targetWidth = null;
    }

    return targetWidth;
}

const convertMobileTextures = async function() {
    let index = 0;
    for (var conversionSetting of conversionSettings) {
        console.log('### Converting texture ' + index + ' of ' + conversionSettings.length);
        if (conversionSetting.extension == 'png') {
            await sharp(conversionSetting.fullInputPath).resize(conversionSetting.targetWidth).png({
                quality: conversionSetting.quality
            }).resize(conversionSetting.targetWidth).toFile(conversionSetting.fullOutputPath);
        } else {
            await sharp(conversionSetting.fullInputPath).resize(conversionSetting.targetWidth).jpeg({
                quality: conversionSetting.quality
            }).resize(conversionSetting.targetWidth).toFile(conversionSetting.fullOutputPath);
        }

        index++;
    }
}

const setupScript = async function() {
    const arguments = process.argv.slice(2);
    console.log('Converting textures');
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

        if (arguments.length >= 3) {
            conversionTarget = arguments[2];
        }
    
        if (arguments.length >= 4) {
            if (!['DESKTOP', 'MOBILE'].includes(conversionTarget)) {
                console.error(`Conversion target has to be 'DESKTOP' or 'MOBILE'`);
                return;
            }
            console.log(`Conversion target: ${conversionTarget}`)
            if (conversionTarget == 'MOBILE') {
                console.log(`Conversion target is MOBILE`)
            } if (conversionTarget == 'DESKTOP') {
                console.log(`Conversion target is DESKTOP`)
            }
            const conversionSettingsPath = arguments[3];
            if (!fs.existsSync(conversionSettingsPath)) {
                console.error(`${conversionSettingsPath} does not exist`);
                return;
            }
            const conversionSettings = require(conversionSettingsPath);
            targetDimensionOverwritesForFiles = conversionSettings[conversionTarget] ? conversionSettings[conversionTarget].targetDimensionOverwritesForFiles : null;
            console.log(`using targetDimensionOverwritesForFiles:`);
            console.log(targetDimensionOverwritesForFiles);
            targetSettingsForDirectories = conversionSettings[conversionTarget] ? conversionSettings[conversionTarget].targetSettingsForDirectories : null;
            console.log(`using targetSettingsForDirectories:`);
            console.log(targetSettingsForDirectories);
        }
        await analyzeMobileTextures(inputDirectory, outputDirectory, '');
        await convertMobileTextures();
    } else {
        console.error(`
            Missing command line arguments (expected 2).
            First argument is the input directory.
            Second argument is the output directory.
            Third argument is the conversion mode (optional, can be 'MOBILE' or 'DESKTOP').
            Fourth argument is the path to the conversion settings file used to overwrite conversion settings (optional).
        `);
    }
}

setupScript();


