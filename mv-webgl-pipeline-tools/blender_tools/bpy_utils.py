import bpy


def reset():
    """
    Sets up an empty scene without any data. Loads factory
    settings and deletes afterward all objects in the scene.
    The factory settings in Blender 2.8x
    include objects in the scene and need to be deleted.
    """
    # bpy.ops.wm.read_factory_settings()

    for bpy_data_iter in (
            bpy.data.objects,
            bpy.data.meshes,
            bpy.data.lights,
            bpy.data.cameras,
    ):
        for id_data in bpy_data_iter:
            bpy_data_iter.remove(id_data)


def remove_all_uvs():
    for selected_obj in bpy.data.objects:
        print(selected_obj.name)
        if selected_obj.type == "MESH":
            uv_layers = selected_obj.data.uv_layers
            if len(uv_layers) == 0:
                continue
            while uv_layers:
                for uv in uv_layers:
                    try:
                        uv_layers.remove(uv)
                    except Exception as e:
                        print(str(e))
                        break


def flatten_scene_scenegraph():
    for selected_object in bpy.data.objects:
        bpy.context.view_layer.objects.active = selected_object
        selected_object.select_set(True)
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
        bpy.ops.object.select_all(action='DESELECT')


def remove_all_empty():
    for selected_obj in bpy.data.objects:
        if selected_obj.type == "EMPTY":
            bpy.data.objects.remove(selected_obj, do_unlink=True)


def import_fbx_file(path=None):

    if path is None:
        print("No path")

    bpy.ops.import_scene.fbx(filepath=path)
    bpy.ops.object.select_all(action='DESELECT')


def export_scene_to_glb(path=None):
    bpy.ops.export_scene.gltf(filepath=path)


def merge_by_same_material(mergeInstances=None):
    material_to_object_map = _collect_by_same_material()
    bpy.ops.object.select_all(action='DESELECT')
    print('Merge instances: ') 
    print(mergeInstances)
    for selected_objects in material_to_object_map.values():
        if(len(selected_objects) == 1):
            continue

        objectsToMerge = []

        for selected_object in selected_objects:
            print("Processing " + selected_object.name)
            if mergeInstances:
                selected_object.select_set(True)
                objectsToMerge.append(selected_object)
            else:
                userCount = selected_object.data.users
                if userCount > 1: 
                    print("OBJECT IS INSTANCE")                
                else:
                    print("OBJECT IS NO INSTANCE")
                    selected_object.select_set(True)
                    objectsToMerge.append(selected_object)

        if len(objectsToMerge) > 0:
            bpy.context.scene.view_layers[0].objects.active = objectsToMerge[0]
            bpy.ops.object.join()
            new_obj = bpy.context.selected_objects[0]
            new_obj.name = new_obj.name.split(".")[0]
            bpy.ops.object.select_all(action='DESELECT')

def merge_by_same_material_and_lightmap():
    material_to_object_map = _collect_by_same_material_and_lightmap()
    bpy.ops.object.select_all(action='DESELECT')
    for (k, v) in material_to_object_map.items():
        selected_objects = v
        if(len(selected_objects) == 1):
            continue

        objectsToMerge = []

        for selected_object in selected_objects:
            print("Processing " + selected_object.name)
            selected_object.select_set(True)
            objectsToMerge.append(selected_object)

        if len(objectsToMerge) > 0:
            lightmapFileName = objectsToMerge[0].get('lightmapFileName')
            bpy.context.scene.view_layers[0].objects.active = objectsToMerge[0]
            bpy.ops.object.join()
            new_obj = bpy.context.selected_objects[0]
            new_obj.active_material.name = new_obj.active_material.name.split(".")[0]
            if (lightmapFileName):
                new_obj.name = 'LIGHTMAP_' + lightmapFileName + '#'
                new_obj['lightmapFileName'] = lightmapFileName
            bpy.ops.object.select_all(action='DESELECT')
        
def merge_by_same_material_and_lightmap2():
    material_to_object_map = _collect_by_same_material_and_lightmap2()
    bpy.ops.object.select_all(action='DESELECT')
    for entry in material_to_object_map:
        selected_objects = entry.get('objects')
        if(len(selected_objects) == 1):
            continue

        objectsToMerge = []

        for selected_object in selected_objects:
            print("Processing " + selected_object.name)
            selected_object.select_set(True)
            objectsToMerge.append(selected_object)

        if len(objectsToMerge) > 0:
            lightmapFileName = objectsToMerge[0].get('lightmapFileName')
            bpy.context.scene.view_layers[0].objects.active = objectsToMerge[0]
            bpy.ops.object.join()
            new_obj = bpy.context.selected_objects[0]
            new_obj.active_material.name = new_obj.active_material.name.split(".")[0]
            if (lightmapFileName):
                # new_obj.name = 'LIGHTMAP_' + lightmapFileName + '#'
                new_obj['lightmapFileName'] = lightmapFileName
            mirror = entry.get('mirror')
            if (mirror):
                new_obj['mirror'] = mirror
            socketName = entry.get('socketName')
            if (socketName):
                new_obj['socketName'] = socketName
            mirrorSocketName = entry.get('mirrorSocketName')
            if (mirrorSocketName):
                new_obj['mirrorSocketName'] = mirrorSocketName
            alphaIndex = entry.get('alphaIndex')
            if (alphaIndex):
                new_obj['alphaIndex'] = alphaIndex
            bpy.ops.object.select_all(action='DESELECT')

def fixUVNaming():
    for selected_obj in bpy.data.objects:
        i = 1
        if selected_obj and selected_obj.data and selected_obj.data.uv_layers:
            for uvmap in selected_obj.data.uv_layers :
                uvname = 'UVChannel_' + str(i)
                print('Renamed UV Channel "' + uvmap.name + '" to "' + uvname + '"')
                uvmap.name = uvname
                i = i + 1

def clean_duplicated_materials():
    mats = bpy.data.materials

    for obj in bpy.data.objects:
        for slot in obj.material_slots:
            part = slot.name.rpartition('.')
            if part[2].isnumeric() and part[0] in mats:
                slot.material = mats.get(part[0])

    for material in bpy.data.materials:
        if not material.users:
            bpy.data.materials.remove(material)


def assign_material_data(material_data):
    for name, values in material_data.items():
        set_pbr_material(name, values)


def set_pbr_material(material_name, material_values):
    if material_name not in bpy.data.materials.keys():
        return
    base_color = (material_values["base_color"][0],
                  material_values["base_color"][1],
                  material_values["base_color"][2],
                  material_values["base_color"][3])
    roughness = material_values["roughness"]
    metallic = material_values["metallic"]

    if base_color[3] != 1:
        bpy.data.materials[material_name].blend_method = "BLEND"

    # Base Color
    bpy.data.materials[material_name].node_tree.nodes["Principled BSDF"].inputs[0].default_value = base_color
    # Metallic
    bpy.data.materials[material_name].node_tree.nodes["Principled BSDF"].inputs[4].default_value = metallic
    # Roughness
    bpy.data.materials[material_name].node_tree.nodes["Principled BSDF"].inputs[7].default_value = roughness


def export_scene_to_fbx(path=None, only_selection=False):
    bpy.ops.export_scene.fbx(filepath=path, use_selection=only_selection)


def reset_all_materials():
    mats = bpy.data.materials
    for selected_obj in bpy.data.objects:
        if selected_obj.type == "MESH":
            if selected_obj.active_material:
                active_material = selected_obj.active_material
                mat_name = active_material.name
                fix_mat_name = mat_name + "_reset"
                fixed_mat = mats.get(fix_mat_name)
                if not fixed_mat:
                    mat = bpy.data.materials.new(name=fix_mat_name)
                    selected_obj.data.materials[0] = mat
                else:
                    selected_obj.data.materials[0] = fixed_mat

    for material in bpy.data.materials:
        if not material.users:
            bpy.data.materials.remove(material)

    for material in bpy.data.materials:
        material.name = material.name.replace("_reset", "")


def _collect_by_same_material():
    material_to_object_map = {}
    for selected_obj in bpy.data.objects:
        if selected_obj.type == "MESH":
            if selected_obj.active_material:
                mat_name = selected_obj.active_material.name
            else:
                continue

            if mat_name not in material_to_object_map:
                material_to_object_map[mat_name] = [selected_obj]
            else:
                material_to_object_map[mat_name].append(selected_obj)

    return material_to_object_map

def _collect_by_same_material_and_lightmap():
    material_to_object_map = {}
    for selected_obj in bpy.data.objects:
        if selected_obj.type == "MESH":
            if selected_obj.active_material:
                mat_name = selected_obj.active_material.name
            else:
                continue
            lightmapFileName = selected_obj.get('lightmapFileName')
            if lightmapFileName:
                mat_name = lightmapFileName

            if mat_name not in material_to_object_map:
                material_to_object_map[mat_name] = [selected_obj]
            else:
                material_to_object_map[mat_name].append(selected_obj)

    return material_to_object_map

def _collect_by_same_material_and_lightmap2():
    material_to_object_map = []
    for selected_obj in bpy.data.objects:
        if selected_obj.type == "MESH":
            if selected_obj.active_material:
                material_name = selected_obj.active_material.name
            else:
                continue

            key = material_name
            lightmapFileName = selected_obj.get('lightmapFileName')
            if lightmapFileName:
                key = key + lightmapFileName
            
            mirror = selected_obj.get('mirror')
            if mirror:
                key = key + '_mirror'
            
            socketName = selected_obj.get('socketName')
            if socketName:
                key = key + '_' + socketName

            mirrorSocketName = selected_obj.get('mirrorSocketName')
            if mirrorSocketName:
                key = key + '_' + mirrorSocketName

            alphaIndex = selected_obj.get('alphaIndex')
            if alphaIndex:
                key = key + '_' + str(alphaIndex)

            preventMerging = selected_obj.get('preventMerging')
            if preventMerging:
                key = key + '_' + selected_obj.name

            existingEntry = next((x for x in material_to_object_map if x['key'] == key), None)

            if existingEntry:
                existingEntry['objects'].append(selected_obj) 
            else:
                newEntry = {
                    "key": key,
                    "objects": [selected_obj],
                    "material_name": material_name,
                    "lightmapFileName": lightmapFileName,
                    "mirror": mirror,
                    "socketName": socketName,
                    "mirrorSocketName": mirrorSocketName,
                    "alphaIndex": alphaIndex        
                }
                material_to_object_map.append(newEntry)

    return material_to_object_map

def delete_textures():
    for img in bpy.data.images:
        bpy.data.images.remove(img)