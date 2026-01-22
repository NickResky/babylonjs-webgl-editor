import os
import sys
import json
import datetime
import argparse
import subprocess
import bpy
import json
import uuid
from mathutils import Matrix, Vector
from math import radians, degrees
import bmesh


absolute_path = os.path.dirname(__file__)
sys.path.append(absolute_path)

path_to_config = os.path.join(absolute_path, '..', "config.json")
config = json.load(open(path_to_config))
productionBuild = config['productionBuild']

outputDirectory = config["outputDirectory"]
if not outputDirectory.endswith('/'):
    outputDirectory = outputDirectory + '/'

inputDirectory = config["inputDirectory"]

if not inputDirectory.endswith('/'):
    inputDirectory = inputDirectory + '/'

entityConfig = False

assetsBaseUrl = config['assetsBaseUrl']
entityConfigFile = config['entityConfigFile']
if assetsBaseUrl and len(assetsBaseUrl) > 0 and entityConfigFile and len(entityConfigFile) > 0:
    entityConfigPath = os.path.join(assetsBaseUrl, entityConfigFile)
    entityConfig = json.load(open(entityConfigPath))

meshSettings = False
fbxFileSettings = False
productionMeshSettings = {}
glbMetaData = {}
lightmapsRegistry = []

if (entityConfig):
    
    if ("lightmapTexturesUrlRelative" in entityConfig and len(entityConfig['lightmapTexturesUrlRelative'])):
        lightmapsRegistryPath = os.path.join(assetsBaseUrl, entityConfig['lightmapTexturesUrlRelative'], 'registry.json')
        lightmapsRegistry = json.load(open(lightmapsRegistryPath))['files']
        print('lightmaps registry:')
        print(lightmapsRegistry)

    inputMeshSettingsUrl = entityConfig.get('meshSettingsRelative')

    if productionBuild and assetsBaseUrl and inputMeshSettingsUrl:
        inputMeshSettingsUrl = assetsBaseUrl + '/' + inputMeshSettingsUrl
        meshSettings = json.load(open(inputMeshSettingsUrl))
        if "fbxFileSettings" in meshSettings:
            fbxFileSettings = meshSettings['fbxFileSettings']
        if "meshes" in meshSettings:
            meshSettings = meshSettings['meshes']
        
        print('production mesh settings')
        print(productionMeshSettings)


import bpy_utils
import data_utils
bpy_utils.reset()



# fileName = config["fileName"]
# scaling = config["scaling"]
mergeInstances = config["mergeInstances"]

# if config["materialMappingsJsonPath"] and len(config["materialMappingsJsonPath"]) > 0:
#     print('OPTIMIZE WITH MATERIAL MAPPINGS')
#     path_to_material_mappings = os.path.join(absolute_path, '..', '_tmp', 'mappings.json')
#     materialMappings = json.load(open(path_to_material_mappings))

fileNames = [f for f in os.listdir(inputDirectory) if os.path.isfile(os.path.join(inputDirectory, f))]
fileNames = sorted(fileNames) # sort alphabetically

processedMeshes = {}

def getLightmapName(fileName, layerName):
    print('get lightmap name for file ' + fileName + ', layer ' + layerName)
    if (not entityConfig):
        return False

    lightmapFileName = ''
    if (layerName + '.jpg') in lightmapsRegistry:
        lightmapFileName = layerName + '.jpg'
    lightmap_overwrites = entityConfig.get('lightmapOverwrites')
    fileName = fileName.replace('_part_mirror', '')
    if (lightmap_overwrites):
        lightmap_overwrite = lightmap_overwrites.get(fileName)
        if lightmap_overwrite:
            print('lightmap overwrite found')
            lightmapFileName = lightmap_overwrite
            return lightmapFileName
      
        
    if len(fileName) == 0:
        return False
    return lightmapFileName

def createProductionMeshSettingEntry(meshName):
    if not meshName in productionMeshSettings:
        productionMeshSettings[meshName] = {}

def convertLinearToSRGB(color):
    a = 0.055
    convertedColor = color
    if color < 0.0031308:
        convertedColor = color * 12.92
    else:
        convertedColor = (1 + a) * pow(color, 1 / 2.4) - a
    return convertedColor

def convertSRGBToLinear(color):
    a = 0.055
    convertedColor = color
    if color < 0.04045:
        convertedColor = color / 12.92
    else:
        convertedColor = pow((color + a) / (1 + a), 2.4)
    return convertedColor

def convertObjVertexColorsFromLinearToSRGB(obj):

    obj_data = obj.data
    vertex_colors = obj_data.vertex_colors

    if (not vertex_colors):
        return

    color_layer = vertex_colors.get("Col")

    if (not color_layer):
        return

    i = 0
    for poly in obj_data.polygons:
        for idx in poly.loop_indices:
         
            vertexColor = color_layer.data[i].color
            
            r = vertexColor[0]
            g = vertexColor[1]
            b = vertexColor[2]
            a = vertexColor[3]

            color_layer.data[i].color = (convertSRGBToLinear(r), convertSRGBToLinear(g), convertSRGBToLinear(b), convertSRGBToLinear(a))
            i += 1

def processFiles(groupedFiles, outputfileName):
    outputFilePath = ''
    exportAnimation = '_anim.' in groupedFiles[0] or '_rig.' in groupedFiles[0]
    atLeastOneFileInGroupExists = False

    tn = False 

    glbMetaData[outputfileName] = {
        "materials": {},
        "lightmaps": {}
    }

    # print(fileNames)
    for fileName in groupedFiles:
        fullFileName = fileName
        print('Check if file ' + fullFileName)
        fileName = fileName.replace('.fbx', '').replace('.FBX', '').replace('.glb', '')
        print('File name ' + fileName)
        layerName = fileName
        if ('_RT_' in layerName):
            layerName = layerName.split('_RT')[0]
        elif ('_part_' in layerName):
            layerName = layerName.split('_part_')[0]    
        elif ('_socket_' in layerName):
            layerName = layerName.split('_socket_')[0]
        print('layer name: ' + layerName)

        socketName = False
        if ('_socket_' in fileName):
            socketName = fileName.split('_socket_')[1]
            print('socket name: '+ socketName)
        
        if fullFileName in fileNames:
            print('File exists')
            atLeastOneFileInGroupExists = True
            outputFilePath = inputDirectory + '/blender_fbx_export/' + outputfileName
            # outputFilePath = outputFilePath[:-4] + '.glb'
            inputFilePath = inputDirectory + fullFileName

            mirrorSocketName = False
            fileSetting = False
            preventMerging = False

            if "_instanced" in fileName:
                preventMerging = True
                print('Prevent merging')

            if fbxFileSettings and 'mirrorSocketMappings' in fbxFileSettings:
                mirrorSocketMappings = fbxFileSettings['mirrorSocketMappings']

                if mirrorSocketMappings and socketName and socketName in mirrorSocketMappings:
                    mirrorSocketName = mirrorSocketMappings[socketName]
                    print('mirrorSocketName: ' + mirrorSocketName)
        
            if (data_utils.isFileGlb(inputFilePath) or data_utils.isFileFbx(inputFilePath)):
                if (data_utils.isFileGlb(inputFilePath)):
                    bpy.ops.import_scene.gltf(filepath=inputFilePath)
                elif (data_utils.isFileFbx(inputFilePath)):
                    bpy.ops.import_scene.fbx(filepath=inputFilePath,use_custom_props=False)
                
                imported_objects = bpy.context.selected_objects.copy()

                for obj in imported_objects:
                    if obj.type == "MESH":
                        bpy.context.view_layer.objects.active = obj
                        obj.select_set(True)
                        if bpy.context.mode != 'EDIT':            #if not in edit mode
                            bpy.ops.object.editmode_toggle()      #enters in edit mode
                            bpy.ops.mesh.separate(type='MATERIAL')   #separate it by material parts
                            bpy.ops.object.editmode_toggle()      #exit edit mode
                        else :                                    #else
                            bpy.ops.mesh.separate(type='MATERIAL')   #separate it by material parts

                for obj in imported_objects:
                    if obj.type == "MESH":

                        print('processing object ' + obj.name)
                        uniqueMeshName = obj.name
                        if obj.name in processedMeshes:
                            print("Creating unique mesh name:")
                            uniqueMeshName = str(uuid.uuid4())
                            print(uniqueMeshName)
                        processedMeshes[uniqueMeshName] = uniqueMeshName



                        if preventMerging:
                            obj['preventMerging'] = True

                        obj_data = obj.data
                        vertex_colors = obj_data.vertex_colors
                        # delete vertex colors
                        if entityConfig and not entityConfig.get('convertPBRToNodeMaterials') and not entityConfig.get('preventVertexColorDeletionDuringBuild') and not entityConfig.get('useVCAOForPBRMaterials'):
                            while vertex_colors:
                                vertex_colors.remove(vertex_colors[0])

                        color_layer = 0
                        
                        if (obj_data.vertex_colors):
                            color_layer = obj_data.vertex_colors.get("Col")

                        if entityConfig and (entityConfig.get('convertPBRToNodeMaterials') or entityConfig.get('useVCAOForPBRMaterials')) and not color_layer:
                            obj_data.vertex_colors.new()
                            color_layer = obj_data.vertex_colors.get("Col")

                            i = 0
                            for poly in obj_data.polygons:
                                for idx in poly.loop_indices:
                                    color_layer.data[i].color = (1, 0, 0, 1.0)
                                    i += 1

                        elif data_utils.isFileGlb(inputFilePath):
                            convertObjVertexColorsFromLinearToSRGB(obj)


                        meshSetting = False
                        if meshSettings:
                            for setting in meshSettings:
                                if (setting['id'] == obj.name):
                                    meshSetting = setting

                            if meshSetting and 'alphaIndex' in meshSetting:
                                obj['alphaIndex'] = meshSetting['alphaIndex']

                        # if meshSetting:
                        #     if "alphaIndex" in meshSetting:
                        #         productionMeshSettings[uniqueMeshName]['alphaIndex'] = meshSetting['alphaIndex']
                        #     if 'hideOnCameraIntersect' in meshSetting:
                        #         productionMeshSettings[uniqueMeshName]['hideOnCameraIntersect'] = meshSetting['hideOnCameraIntersect']
                        #     if 'boundingBoxScale' in meshSetting:
                        #         productionMeshSettings[uniqueMeshName]['boundingBoxScale'] = meshSetting['boundingBoxScale']

                        

                        obj.name = uniqueMeshName

                        new_obj = False
                        # if '_part_mirror' in fileName:
                            # obj['mirror'] = True
                            # print('mirror object')

                            # new_obj = obj.copy()
                            # new_obj.name = str(uuid.uuid4())
                            # new_obj.data = obj.data.copy()
                            # bpy.context.collection.objects.link(new_obj)

                            # tn_mesh = bpy.data.meshes.new('transform_node')
                            # tn = bpy.data.objects.new('transform_node', tn_mesh)
                            # bpy.context.collection.objects.link(tn)
                            # tn.parent = obj.parent
                            # new_obj.parent = tn
                            # tn.scale = (1, -1, 1)

                            # scene = bpy.context.scene
                            # bpy.ops.object.select_all(action='DESELECT')
                            # bpy.context.view_layer.objects.active = new_obj

                            # bpy.ops.object.mode_set(mode='EDIT')
                            # bpy.ops.mesh.flip_normals()
                            # bpy.ops.object.mode_set(mode='OBJECT')


                            
                            # me = new_obj.data
                            # bm = bmesh.new()
                            # bm.from_mesh(me)
                            # axis = 1 # x, y, z = 0, 1, 2
                            # T = Matrix.Scale(-1, 4, Matrix.Identity(3)[axis])
                            # pp = Vector()
                            # A = Matrix.Translation(-pp) * T * Matrix.Translation(pp)
                            # # lpp = new_obj.matrix_world.inverted() * pp
                            # bmesh.ops.transform(bm, matrix=T, space=Matrix.Translation(-pp), verts=bm.verts)
                            # bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
                            # bm.to_mesh(me)
                            # me.update()
                            # bm.clear()
                            # bm.free()
                            # productionMeshSettings[uniqueMeshName]['mirror'] = True

                        if socketName:
                            obj['socketName'] = socketName
                            # if new_obj:
                            #     new_obj['socketName'] = socketName


                        # if mirrorSocketName:
                            # if new_obj:
                            #     new_obj['socketName'] = mirrorSocketName                            
                            # obj['mirrorSocketName'] = mirrorSocketName
                            # productionMeshSettings[uniqueMeshName]['mirrorSocketName'] = mirrorSocketName

                        # ob.data.transform(ob.matrix_world)
                        # obj.matrix_world = Matrix()
                        # obj.name = 'FILENAME_' + fileName
                        lightmapFileName = getLightmapName(fullFileName, layerName)
                        print('lightmap file name: ')
                        print(lightmapFileName)
                        materialName = ""
                        if (obj.active_material):
                            materialName = obj.active_material.name
                        # if materialName and len(materialName) > 0:
                        #     print('material name: ')
                        #     print(materialName)

                        if lightmapFileName and materialName:
                            print('----')
                            obj['lightmapFileName'] = lightmapFileName
                            # if new_obj:
                            #     new_obj['lightmapFileName'] = lightmapFileName
                            # obj.name = 'LIGHTMAP_' + lightmapFileName + '#'
                            # productionMeshSettings[uniqueMeshName]['lightmapFileName'] = lightmapFileName   
                            # 


                
                bpy.ops.object.select_all(action='DESELECT')

            # root_objects = []
            # for obj in bpy.context.scene.objects:
            #     print (obj.name)
            #     if not obj.parent:
            #         root_objects.append(obj)
            # for obj in root_objects:
                #obj.scale = (scaling, scaling, scaling)
                #print('scaling root object ' + obj.name + ': ' + str(obj.scale))
    

    
    if atLeastOneFileInGroupExists:

        # if config["materialMappingsJsonPath"] and len(config["materialMappingsJsonPath"]) > 0:
        #     print ('optimizing materials:')
        #     for material in bpy.data.materials:
        #         try:
        #             optimizedMaterialName = materialMappings[material.name]
        #             print (material.name + ' mapped to:')
        #             print (optimizedMaterialName)
        #             material.name = optimizedMaterialName
        #         except KeyError:
        #             print (material.name + ' was not mapped')
                
        bpy_utils.clean_duplicated_materials()
        bpy_utils.fixUVNaming()
        if config["mergeBySameMaterial"] == True:
            bpy_utils.merge_by_same_material_and_lightmap2()

        for selected_obj in bpy.data.objects:
            meshName = selected_obj.name

            # productionMeshSettings[meshName]['originalFileName'] = fullFileName
            # productionMeshSettings[meshName]['originalMeshId'] = obj.name

            print('Processing obj:' + selected_obj.name)
            targetName = str(uuid.uuid4())
            selected_obj.name = targetName
            print('target name: ' + selected_obj.name)

            createProductionMeshSettingEntry(targetName)

            lightmapFileName = selected_obj.get('lightmapFileName')
            if (lightmapFileName):
                productionMeshSettings[targetName]['lightmapFileName'] = lightmapFileName
                glbMetaData[outputfileName]['lightmaps'][lightmapFileName] = lightmapFileName
            if (selected_obj.active_material and selected_obj.active_material.name):
                materialName = selected_obj.active_material.name
                selected_obj.active_material.name = selected_obj.active_material.name.split('.')[0]
                materialName = selected_obj.active_material.name
                glbMetaData[outputfileName]['materials'][materialName] = materialName
                productionMeshSettings[targetName]['materialName'] = materialName
            mirror = selected_obj.get('mirror')
            if (mirror):
                productionMeshSettings[targetName]['mirror'] = mirror
            socketName = selected_obj.get('socketName')
            if (socketName):
                productionMeshSettings[targetName]['socketName'] = socketName
            mirrorSocketName = selected_obj.get('mirrorSocketName')
            if (mirrorSocketName):
                productionMeshSettings[targetName]['mirrorSocketName'] = mirrorSocketName
            
            alphaIndex = selected_obj.get('alphaIndex')
            if (alphaIndex or alphaIndex == 0):
                productionMeshSettings[targetName]['alphaIndex'] = alphaIndex

        #delete mateials in production mode
        # if config['productionBuild']:
        #     for material in bpy.data.materials:
        #         material.user_clear()
        #         bpy.data.materials.remove(material)

        # bpy.ops.export_scene.gltf(
        #     filepath=outputFilePath + '.glb',
        #     export_animations=exportAnimation,
        #     export_colors=True
        # )

        bpy.ops.export_scene.fbx(
            filepath=outputFilePath + '.fbx',
        )
    
    bpy_utils.reset()


tmpPath = os.path.join(absolute_path, '..', '_tmp')
if ("tmpPath" in config and len(config["tmpPath"])):
    tmpPath = config["tmpPath"]

print('tmp path: ' + tmpPath)

path_to_file_groups = os.path.join(tmpPath, 'file_groups.json')
print('file groups path: ' + path_to_file_groups)

fileGroups = json.load(open(path_to_file_groups))
fileGroups = fileGroups['groups']
print('file groups:')
print(fileGroups)
#  TODO if entity has mesh settings
# meshSettingsPath = os.path.join(config["assetsBaseUrl"], entityConfigFile[''])


i = 0
for fileGroup in fileGroups:
    print('### processing file group' + ' ' + str(i + 1) + '/' + str(len(fileGroups)) + ' ' + '---' + ' ' + fileGroup['name'])
    if len(fileGroup['files']) > 0:
        processFiles(fileGroup['files'], fileGroup['outputFileName'])
        print('')
    i = i + 1

outputMeshSettingsUrl = config.get('outputMeshSettingsUrl')
outputMeshSettingsDirectory = os.path.dirname(outputMeshSettingsUrl)
if (outputMeshSettingsUrl and len(outputMeshSettingsUrl)):
    if not os.path.exists(outputMeshSettingsDirectory):
        os.makedirs(outputMeshSettingsDirectory)
    with open(config['outputMeshSettingsUrl'], "w") as write_file:
        json.dump(productionMeshSettings, write_file)   

glbMetaDataUrl = config.get('glbMetaDataUrl')
if (glbMetaDataUrl and len(glbMetaDataUrl)):
    with open(glbMetaDataUrl, "w") as write_file:
        json.dump(glbMetaData, write_file)

# with open(outputMeshSettingsUrl, "w") as write_file:
#     json.dump(productionMeshSettings, write_file)   


    # if config["ruleEnginePath"] and len(config["ruleEnginePath"]) > 0:
    #     print('OPTIMIZE WITH RULE ENGINE')
    #     path_to_file_groups = os.path.join(absolute_path, '..', '_tmp', 'file_groups.json')
    #     fileGroups = json.load(open(path_to_file_groups))
    #     for i, fileGroup in enumerate(fileGroups):
    #         print('---> processing file group' + ' ' + str(i + 1) + '/' + str(len(fileGroups)) + ' ' + '---' + ' ' + fileGroup[0])
    #         processFiles(fileGroup)

    # else:
    #     print('DO NOT OPTIMIZE WITH RULE ENGINE')
    #     for i, fileName in enumerate(fileNames):
    #         print('---> processing file' + ' ' + str(i + 1) + '/' + str(len(fileNames)) + ' ' + '---' + ' ' + fileName)
    #         if data_utils.isFileFbx(fileName) or data_utils.isFileObj(fileName):
    #             processFiles([fileName])


