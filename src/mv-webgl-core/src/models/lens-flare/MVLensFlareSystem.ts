import { Constants, LensFlareSystem, Light, Material, Matrix, Scalar, Scene } from "babylonjs";

/**
 * Extension of the default BabylonJS LensFlareSystem class to add custom intensity support which is not implemented by BabylonJS. 
 */
export class MVLensFlareSystem extends LensFlareSystem {
    public lensFlareInstensity: number = 1;
    private _isBabylonVersion5: boolean;

    constructor(name: string, emitter: Light, scene: Scene, intensity: number) {
        super(name, emitter, scene);
        this.lensFlareInstensity = intensity;
        this._isBabylonVersion5 = scene.getEngine()['version'] ? true : false;
    }

    public override render(): boolean {

        if (this._isBabylonVersion5) {
            return this.renderBabylonVersion5();
        } else {
            return this.renderBabylonVersion4();
        }
    }

    public renderBabylonVersion4(): boolean {
        if (!this['_effect'].isReady() || !this['_scene'].activeCamera) {
            return false;
        }

        var engine = this['_scene'].getEngine();
        var viewport = this['_scene'].activeCamera.viewport;
        var globalViewport = viewport.toGlobal(engine.getRenderWidth(true), engine.getRenderHeight(true));

        // Position
        if (!this.computeEffectivePosition(globalViewport)) {
            return false;
        }

        // Visibility
        if (!this._isVisible()) {
            return false;
        }

        // Intensity
        var awayX;
        var awayY;

        if (this['_positionX'] < this.borderLimit + globalViewport.x) {
            awayX = this.borderLimit + globalViewport.x - this['_positionX'];
        } else if (this['_positionX'] > globalViewport.x + globalViewport.width - this.borderLimit) {
            awayX = this['_positionX'] - globalViewport.x - globalViewport.width + this.borderLimit;
        } else {
            awayX = 0;
        }

        if (this['_positionY'] < this.borderLimit + globalViewport.y) {
            awayY = this.borderLimit + globalViewport.y - this['_positionY'];
        } else if (this['_positionY'] > globalViewport.y + globalViewport.height - this.borderLimit) {
            awayY = this['_positionY'] - globalViewport.y - globalViewport.height + this.borderLimit;
        } else {
            awayY = 0;
        }

        var away = (awayX > awayY) ? awayX : awayY;

        away -= this.viewportBorder;

        if (away > this.borderLimit) {
            away = this.borderLimit;
        }

        var intensity = 1.0 - Scalar.Clamp(away / this.borderLimit, 0, 1);
        if (intensity < 0) {
            return false;
        }

        if (intensity > 1.0) {
            intensity = 1.0;
        }

        if (this.viewportBorder > 0) {
            globalViewport.x += this.viewportBorder;
            globalViewport.y += this.viewportBorder;
            globalViewport.width -= this.viewportBorder * 2;
            globalViewport.height -= this.viewportBorder * 2;
            this['_positionX'] -= this.viewportBorder;
            this['_positionY'] -= this.viewportBorder;
        }

        // Position
        var centerX = globalViewport.x + globalViewport.width / 2;
        var centerY = globalViewport.y + globalViewport.height / 2;
        var distX = centerX - this['_positionX'];
        var distY = centerY - this['_positionY'];

        // Effects
        engine.enableEffect(this['_effect']);
        engine.setState(false);
        engine.setDepthBuffer(false);

        // VBOs
        engine.bindBuffers(this['_vertexBuffers'], this['_indexBuffer'], this['_effect']);

        // Flares
        for (var index = 0; index < this.lensFlares.length; index++) {
            var flare = this.lensFlares[index];

            if (flare.texture && !flare.texture.isReady()) {
                continue;
            }

            engine.setAlphaMode(flare.alphaMode);

            var x = centerX - (distX * flare.position);
            var y = centerY - (distY * flare.position);

            var cw = flare.size;
            var ch = flare.size * engine.getAspectRatio(this['_scene'].activeCamera, true);
            var cx = 2 * (x / (globalViewport.width + globalViewport.x * 2)) - 1.0;
            var cy = 1.0 - 2 * (y / (globalViewport.height + globalViewport.y * 2));

            var viewportMatrix = Matrix.FromValues(
                cw / 2, 0, 0, 0,
                0, ch / 2, 0, 0,
                0, 0, 1, 0,
                cx, cy, 0, 1);

            this['_effect'].setMatrix("viewportMatrix", viewportMatrix);

            // Texture
            this['_effect'].setTexture("textureSampler", flare.texture);

            const flareIntensity = intensity * flare['flareIntensity'] * this.lensFlareInstensity;

            // Color
            this['_effect'].setFloat4("color", flare.color.r * flareIntensity, flare.color.g * flareIntensity, flare.color.b * flareIntensity, 1.0);

            // Draw order
            engine.drawElementsType(Material.TriangleFillMode, 0, 6);
        }

        engine.setDepthBuffer(true);
        engine.setAlphaMode(Constants.ALPHA_DISABLE);
        return true;
    }

    public renderBabylonVersion5(): boolean {
        if (!this['_drawWrapper']?.effect!.isReady() || !this['_scene'].activeCamera) {
            return false;
        }

        var engine = this['_scene'].getEngine();
        var viewport = this['_scene'].activeCamera.viewport;
        var globalViewport = viewport.toGlobal(engine.getRenderWidth(true), engine.getRenderHeight(true));

        // Position
        if (!this.computeEffectivePosition(globalViewport)) {
            return false;
        }

        // Visibility
        if (!this._isVisible()) {
            return false;
        }

        // Intensity
        var awayX;
        var awayY;

        if (this['_positionX'] < this.borderLimit + globalViewport.x) {
            awayX = this.borderLimit + globalViewport.x - this['_positionX'];
        } else if (this['_positionX'] > globalViewport.x + globalViewport.width - this.borderLimit) {
            awayX = this['_positionX'] - globalViewport.x - globalViewport.width + this.borderLimit;
        } else {
            awayX = 0;
        }

        if (this['_positionY'] < this.borderLimit + globalViewport.y) {
            awayY = this.borderLimit + globalViewport.y - this['_positionY'];
        } else if (this['_positionY'] > globalViewport.y + globalViewport.height - this.borderLimit) {
            awayY = this['_positionY'] - globalViewport.y - globalViewport.height + this.borderLimit;
        } else {
            awayY = 0;
        }

        var away = (awayX > awayY) ? awayX : awayY;

        away -= this.viewportBorder;

        if (away > this.borderLimit) {
            away = this.borderLimit;
        }

        var intensity = 1.0 - Scalar.Clamp(away / this.borderLimit, 0, 1);
        if (intensity < 0) {
            return false;
        }

        if (intensity > 1.0) {
            intensity = 1.0;
        }

        if (this.viewportBorder > 0) {
            globalViewport.x += this.viewportBorder;
            globalViewport.y += this.viewportBorder;
            globalViewport.width -= this.viewportBorder * 2;
            globalViewport.height -= this.viewportBorder * 2;
            this['_positionX'] -= this.viewportBorder;
            this['_positionY'] -= this.viewportBorder;
        }

        // Position
        var centerX = globalViewport.x + globalViewport.width / 2;
        var centerY = globalViewport.y + globalViewport.height / 2;
        var distX = centerX - this['_positionX'];
        var distY = centerY - this['_positionY'];

        // Effects
        engine.enableEffect(this['_drawWrapper']);
        engine.setState(false);
        engine.setDepthBuffer(false);

        // VBOs
        engine.bindBuffers(this['_vertexBuffers'], this['_indexBuffer'], this['_drawWrapper'].effect!);

        // Flares
        for (var index = 0; index < this.lensFlares.length; index++) {
            var flare = this.lensFlares[index];

            if (flare.texture && !flare.texture.isReady()) {
                continue;
            }

            engine.setAlphaMode(flare.alphaMode);

            var x = centerX - (distX * flare.position);
            var y = centerY - (distY * flare.position);

            var cw = flare.size;
            var ch = flare.size * engine.getAspectRatio(this['_scene'].activeCamera, true);
            var cx = 2 * (x / (globalViewport.width + globalViewport.x * 2)) - 1.0;
            var cy = 1.0 - 2 * (y / (globalViewport.height + globalViewport.y * 2));

            var viewportMatrix = Matrix.FromValues(
                cw / 2, 0, 0, 0,
                0, ch / 2, 0, 0,
                0, 0, 1, 0,
                cx, cy, 0, 1);

            this['_drawWrapper'].effect!.setMatrix("viewportMatrix", viewportMatrix);

            // Texture
            this['_drawWrapper'].effect!.setTexture("textureSampler", flare.texture);

            const flareIntensity = intensity * flare['flareIntensity'] * this.lensFlareInstensity;

            // Color
            this['_drawWrapper'].effect!.setFloat4("color", flare.color.r * flareIntensity, flare.color.g * flareIntensity, flare.color.b * flareIntensity, 1.0);

            // Draw order
            engine.drawElementsType(Material.TriangleFillMode, 0, 6);
        }

        engine.setDepthBuffer(true);
        engine.setAlphaMode(Constants.ALPHA_DISABLE);
        return true;
    }
}