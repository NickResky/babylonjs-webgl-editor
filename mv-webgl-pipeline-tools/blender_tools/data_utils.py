import os


def get_fbx_files(path=None):
    if path is None:
        print("No path")
        return None

    files = os.listdir(path)

    fbx_name_to_path_map = {}

    for file in files:
        if file.lower().endswith(".fbx"):
            file_name = os.path.splitext(file)[0]
            file_path = os.path.join(path, file)
            fbx_name_to_path_map[file_name] = file_path

    return fbx_name_to_path_map


def get_gltf_files(path=None):
    files = os.listdir(path)
    gtlf_name_to_path_map = {}

    for file in files:
        new_path = os.path.join(path, file)

        if os.path.isdir(new_path):
            files_in_dir = os.listdir(new_path)

            for file in files_in_dir:
                if file.lower().endswith(".gltf"):
                    file_name = os.path.splitext(file)[0]
                    file_path = os.path.join(new_path, file)
                    gtlf_name_to_path_map[file_name] = file_path

    return gtlf_name_to_path_map


def isFileObj(fileName):
    if fileName.endswith('.obj') or fileName.endswith('.OBJ'):
        return True
    else:
        return False

def isFileFbx(fileName):
    if fileName.endswith('.fbx') or fileName.endswith('.FBX'):
        return True
    else:
        return False

def isFileGlb(fileName):
    if fileName.endswith('.glb') or fileName.endswith('.GLB'):
        return True
    else:
        return False

def appendFbx(fileName):
    if not fileName.endswith('.fbx') or not fileName.endswith('.FBX'):
        fileName = fileName + '.fbx'
    return fileName
