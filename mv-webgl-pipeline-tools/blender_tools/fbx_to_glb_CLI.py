import argparse
import datetime
import json
import os
import subprocess
import sys

absolute_path = os.path.dirname(__file__)


try:
    path_to_config = os.path.join(absolute_path, '..', "config.json")
    config = json.load(open(path_to_config))
except:
    print("No path to config file")
    exit()

if ("blenderToolsPath" in config and len(config["blenderToolsPath"])):
    absolute_path = config["blenderToolsPath"]


sys.path.append(absolute_path)

blender_path = config['blenderPath']
print('Blender path: ' + blender_path)
runBlenderInBackground = config["runBlenderInBackground"]

if not os.path.exists(config["inputDirectory"]):
    raise Exception("input directory " + config["inputDirectory"] + " does not exist")

if not os.path.exists(config["inputDirectory"] + '/blender_fbx_export'):
    os.makedirs(config["inputDirectory"] + '/blender_fbx_export')

if not os.path.exists(config["outputDirectory"]):
    os.makedirs(config["outputDirectory"])

print('absolute path: ' + absolute_path)

if runBlenderInBackground:
    processCall = blender_path + " --background --python " + absolute_path + "/fbx_to_glb_batcher.py"
else: 
    processCall = blender_path + " --verbose 0 --python " + absolute_path + "/fbx_to_glb_batcher.py"

print('process call: ' + processCall)

subprocess.call(processCall)