import os
import sys
import nuke
import argparse
import subprocess
import shutil


nRead = nuke.toNode('Read1')
nWrite = nuke.toNode('Write1')
nReformat = nuke.toNode('Reformat1')

print nWrite


inputDirectory = 'D:/Workspaces/Ferrari_WebGL_nreschke_DL143/content/textures/'
outputDirectory = 'D:/Workspaces/Ferrari_WebGL_nreschke_DL143/content/textures_mobile/'

# print nReformat


def convertFilesInDirectory(path):
    print "path: " + path
    fileNames = [f for f in os.listdir(path)]
    fileNames = sorted(fileNames) # sort alphabetically

    for i, fileName in enumerate(fileNames):
        imagePath = path + '/' + fileName
        relativeFilePath = imagePath.replace(inputDirectory + '/', '')
        print 'relative file path: ' + relativeFilePath

        print '---> processing file' + ' ' + str(i + 1) + '/' + str(len(fileNames)) + ' ' + '---' + ' ' + relativeFilePath

        if os.path.isdir(os.path.join(path, fileName)):
            if not os.path.exists(os.path.join(outputDirectory, relativeFilePath)):
                os.makedirs(os.path.join(outputDirectory, relativeFilePath))

            print 'path is directory: ' + imagePath
            convertFilesInDirectory(imagePath)
        elif os.path.isfile(os.path.join(path, fileName)):
            nRead.knob('file').setValue(imagePath)

            imageWidth = nRead.width()

            print 'input image width: '
            print imageWidth

            nReformat.knob('box_width').setValue(128)

            # if 'ferrari/_environments' in path:
            if imageWidth > 256:
                nReformat.knob('box_width').setValue(256)
            if imageWidth > 512:
                nReformat.knob('box_width').setValue(512)
            if imageWidth > 1024:
                nReformat.knob('box_width').setValue(1024)
            if imageWidth > 2048:
                nReformat.knob('box_width').setValue(2048)
            # if imageWidth > 3700:
            #     nReformat.knob('box_width').setValue(3800)

            outputImageWidth = nWrite.width()

            print 'output image width: '
            print outputImageWidth

            extension = fileName.split(".")[1] 
            print "writing file to " + outputDirectory + '/' + relativeFilePath

            if extension == 'png' or extension == 'jpg':
                print 'file is image'
                nWrite.knob('file').setValue(outputDirectory + '/' + relativeFilePath)

                if extension == 'png':
                    nWrite.knob('file_type').setValue('png')
                if extension == 'jpg':
                    nWrite.knob('file_type').setValue('jpg')
                    nWrite.knob('_jpeg_quality').setValue(0.5)

                nuke.execute ('Write1',1,1,1)
            elif not extension == 'tmp':
                print 'file is not an image'
                shutil.copy(imagePath,outputDirectory + '/' + relativeFilePath)

convertFilesInDirectory(inputDirectory)

