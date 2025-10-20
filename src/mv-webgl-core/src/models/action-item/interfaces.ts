import { Vector3 } from 'babylonjs';

export interface ActionItemsOptions {
  /** */
  defaultMaterial: string;
  /** */
  actionItems: ActionItemOptions[];
}

export interface ActionItemOptions {
  /** relative url from the entity config file to material folder */
  materialsUrlRelative: string;
  /** relative url from the entity config file to texture folder  */
  texturesUrlRelative: string;
  /** id of action item */
  id: string;
  /** plane size */
  size: number;
  /** plane size for mobile devices */
  size_mobile: number;
  /** material name.json */
  material: string;
  /** animation name.json */
  animation?: string;
  /** states of the action item */
  states: ActionItemState[];
  /** toggle configuration codes for current product entity */
  toggleProductConfigurationCodes?: string[];
  /** the ID of the camera that is supposed to be activated when the action item is clicked */
  cameraId?: string;
  /** the category of the camera e.g. 'interior' or 'exterior' */
  category?: string;
}

export interface ActionItemState {
  /** id of the state */
  id: string;
  /** position of the action item in state */
  position: Vector3;
  /** optional: animation frame */
  animationFrame?: number;
}

export interface ActionItemsOptionsJSON {
  /** relative url to material folder */
  materialsUrlRelative: string;
  /** relative url to texture folder */
  texturesUrlRelative: string;
  /** relative url to animations folder */
  animationsUrlRelative: string;
  /** material name.json */
  defaultMaterial?: string;
  /** action items */
  actionItems: ActionItemOptionsJSON[];
}

export interface ActionItemOptionsJSON {
  /** id of action item */
  id: string;
  /** plane size */
  size: number;
  /** material that overrides the default one. Syntax same: name.json */
  material?: string;
  /** states of the action item */
  states: ActionItemStateJSON[];
  /** animation name.json */
  animation?: string;
}

export interface ActionItemStateJSON {
  /** id of the state */
  id: string;
  /** position of the action item in state */
  position: number[];
}
