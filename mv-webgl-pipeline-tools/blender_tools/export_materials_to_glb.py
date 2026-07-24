import argparse
import os
import re
from pathlib import Path

import bmesh
import bpy


def sanitize_name(name: str) -> str:
	cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name.strip())
	return cleaned or "material"


def ensure_unique_path(base_dir: Path, file_stem: str) -> Path:
	candidate = base_dir / f"{file_stem}.glb"
	if not candidate.exists():
		return candidate

	index = 1
	while True:
		candidate = base_dir / f"{file_stem}_{index}.glb"
		if not candidate.exists():
			return candidate
		index += 1


def reset_scene() -> None:
	bpy.ops.object.select_all(action="SELECT")
	bpy.ops.object.delete(use_global=False)

	for mesh in list(bpy.data.meshes):
		if mesh.users == 0:
			bpy.data.meshes.remove(mesh)


def import_input_file(input_path: Path) -> None:
	suffix = input_path.suffix.lower()
	if suffix in {".glb", ".gltf"}:
		reset_scene()
		bpy.ops.import_scene.gltf(filepath=str(input_path))
		return

	raise ValueError(
		f"Unsupported input format '{input_path.suffix}'. Use .glb or .gltf, or open a .blend directly."
	)


def export_material_to_glb(material: bpy.types.Material, output_path: Path, size: float) -> bool:
	mesh = bpy.data.meshes.new(name=f"MESH_{material.name}")
	obj = bpy.data.objects.new(name=f"OBJ_{material.name}", object_data=mesh)

	bm_handle = bmesh.new()
	bmesh.ops.create_uvsphere(bm_handle, u_segments=32, v_segments=16, radius=size)
	bm_handle.to_mesh(mesh)
	bm_handle.free()
	mesh.update()

	bpy.context.scene.collection.objects.link(obj)
	obj.data.materials.append(material)

	if bpy.ops.object.mode_set.poll():
		bpy.ops.object.mode_set(mode="OBJECT")

	bpy.ops.object.select_all(action="DESELECT")
	obj.select_set(True)
	bpy.context.view_layer.objects.active = obj

	try:
		bpy.ops.export_scene.gltf(
			filepath=str(output_path),
			export_format="GLB",
			use_selection=True,
			export_yup=True,
			export_apply=True,
			export_texcoords=True,
			export_normals=True,
			export_materials="EXPORT",
			export_image_format="AUTO",
		)
		return True
	except Exception as exc:
		print(f"[ERROR] Failed to export '{material.name}': {exc}")
		return False
	finally:
		bpy.ops.object.select_all(action="DESELECT")
		obj.select_set(True)
		bpy.ops.object.delete()

		if mesh.users == 0:
			bpy.data.meshes.remove(mesh)


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Export every material as a standalone GLB file."
	)
	parser.add_argument(
		"--input",
		dest="input_file",
		default="",
		help="Optional path to a .glb/.gltf file to import before export.",
	)
	parser.add_argument(
		"--out",
		dest="out_dir",
		default="./material_glbs",
		help="Output directory for exported GLB files (default: ./material_glbs)",
	)
	parser.add_argument(
		"--plane-size",
		type=float,
		default=1.0,
		help="Radius of the temporary preview sphere (default: 1.0)",
	)

	argv = []
	if "--" in os.sys.argv:
		argv = os.sys.argv[os.sys.argv.index("--") + 1 :]

	return parser.parse_args(argv)


def main() -> None:
	args = parse_args()

	if args.input_file:
		input_path = Path(args.input_file).resolve()
		if not input_path.exists():
			raise FileNotFoundError(f"Input file does not exist: {input_path}")
		import_input_file(input_path)

	out_dir = Path(args.out_dir).resolve()
	out_dir.mkdir(parents=True, exist_ok=True)

	materials = [
		mat
		for mat in bpy.data.materials
		if mat is not None and mat.name and not mat.name.startswith(".")
	]

	if not materials:
		print("[INFO] No materials found.")
		return

	print(f"[INFO] Exporting {len(materials)} materials to: {out_dir}")

	exported = 0
	failed = 0

	for material in materials:
		file_stem = sanitize_name(material.name)
		output_path = ensure_unique_path(out_dir, file_stem)

		ok = export_material_to_glb(material, output_path, args.plane_size)
		if ok:
			exported += 1
			print(f"[OK] {material.name} -> {output_path.name}")
		else:
			failed += 1

	print(f"[DONE] Exported: {exported}, Failed: {failed}")


if __name__ == "__main__":
	main()