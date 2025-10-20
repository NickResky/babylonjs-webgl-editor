import { Scene, Color4, Color3, BaseTexture } from 'babylonjs';
import { MVEnvironmentConfig } from 'mv-core';

export class ENVIRONMENT {
  backgroundImageUrl? = '';
  clearColor: Color4;
  glowLayerIntensity: number = 1;
  environmentTexture: BaseTexture;
  environmentIntensity: number;
  fogEnabled: boolean;
  fogMode: number;
  fogColor: Color3;
  fogDensity: number;
  fogEnd: number;
  fogStart: number;

  constructor(scene: Scene, backgroundImageUrl?: string) {
    // Validate all data and map it
    if (!scene) {
      throw Error(`Missing environment settings.`);
    }

    this.backgroundImageUrl = backgroundImageUrl ? backgroundImageUrl : null;
    this.fogMode = scene.fogMode;
    this.clearColor = scene.clearColor;

    this.glowLayerIntensity = this.getGlowLayerIntensity(scene);

    if (!!scene.environmentTexture) {
      this.environmentTexture = scene.environmentTexture.serialize();
    }

    this.environmentIntensity = scene.environmentIntensity;
    this.fogEnabled = scene.fogEnabled;
    this.fogMode = scene.fogMode;
    this.fogColor = scene.fogColor;
    this.fogDensity = scene.fogDensity;
    this.fogEnd = scene.fogEnd;
    this.fogStart = scene.fogStart;
  }

  public toJSON(): MVEnvironmentConfig {
    const json = {
      clearColor: this.clearColor,
      glowLayerIntensity: this.glowLayerIntensity,
      environmentTexture: this.environmentTexture,
      environmentIntensity: this.environmentIntensity,
      fogEnabled: this.fogEnabled,
      fogMode: this.fogMode,
      fogColor: this.fogColor,
      fogDensity: this.fogDensity,
      fogEnd: this.fogEnd,
      fogStart: this.fogStart,
    }
    if (this.backgroundImageUrl) {
      json['backgroundImageUrl'] = this.backgroundImageUrl
    }
    return json;
  }

  private getGlowLayerIntensity (scene: Scene): number {
    const glowLayer = scene.getGlowLayerByName('glowLayer');
    return glowLayer ? glowLayer.intensity : 1;
  }
}
