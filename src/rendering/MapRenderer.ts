import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { MapTextures } from '../assets/AssetManifest';
import type { Building, CityState } from '../simulation/CityState';
import { getDesirabilityOverlayTiles } from '../simulation/Desirability';
import { getRoadNetwork } from '../simulation/RoadNetwork';
import { getFoodCoveredTiles, getTileKey, getWaterCoveredTiles, isWorkplace } from '../simulation/Simulation';
import { createFittedCamera, type CameraState } from './Camera';
import { gridToScreen, TILE_HEIGHT, TILE_WIDTH } from './GridMath';

export class MapRenderer extends Container {
  constructor(city: CityState, private readonly textures: MapTextures) {
    super();
    this.eventMode = 'none';
    this.refresh(city);
  }

  refresh(city: CityState, options: MapRenderOptions = {}): void {
    // Destroy old display objects, but retain the shared asset textures.
    for (const child of this.removeChildren()) {
      child.destroy({ children: true });
    }

    const terrain = new Container();
    const overlays = new Container();
    const buildings = new Container();
    this.addChild(terrain, overlays, buildings);

    for (const tile of city.tiles) {
      terrain.addChild(this.createTileSprite(tile, this.textures[tile.terrain]));
    }

    if (options.waterOverlay === true) {
      const coveredTiles = getWaterCoveredTiles(city);
      const overlay = new Graphics();
      for (const tile of city.tiles) {
        if (!coveredTiles.has(getTileKey(tile.x, tile.y))) continue;
        this.drawCoverageTile(overlay, tile.x, tile.y, 0x2f8fd8, 0.32);
      }
      overlays.addChild(overlay);
    }

    if (options.foodOverlay === true) {
      const coveredTiles = getFoodCoveredTiles(city);
      const overlay = new Graphics();
      for (const tile of city.tiles) {
        if (!coveredTiles.has(getTileKey(tile.x, tile.y))) continue;
        this.drawCoverageTile(overlay, tile.x, tile.y, 0x65b84a, 0.28);
      }
      overlays.addChild(overlay);
    }

    if (options.desirabilityOverlay === true) {
      const desirabilityTiles = getDesirabilityOverlayTiles(city);
      const overlay = new Graphics();
      for (const tile of city.tiles) {
        const score = desirabilityTiles.get(getTileKey(tile.x, tile.y))!.score;
        const color = score < 40 ? 0xd94f4f : score >= 60 ? 0x65b84a : 0xe3a93b;
        this.drawCoverageTile(overlay, tile.x, tile.y, color, 0.35);
      }
      overlays.addChild(overlay);
    }

    // Draw back to front; roofs must not be covered by a neighbouring ground tile.
    const renderedBuildings = [...city.buildings].sort((a, b) => (
      (a.x + a.y) - (b.x + b.y) || a.x - b.x
    ));
    const roadNetwork = options.roadNetworkOverlay === true ? getRoadNetwork(city) : undefined;
    for (const building of renderedBuildings) {
      const sprite = this.createBuildingSprite(building, options);
      if (building.type === 'road' && roadNetwork !== undefined) {
        sprite.tint = roadNetwork.mainRoadTiles.has(getTileKey(building.x, building.y))
          ? 0x65b84a
          : 0xe87542;
      }
      buildings.addChild(sprite);
    }
  }

  applyCamera(camera: CameraState): void {
    this.scale.set(camera.zoom);
    this.position.set(camera.x, camera.y);
  }

  getCameraState(): CameraState {
    return {
      x: this.position.x,
      y: this.position.y,
      zoom: this.scale.x,
    };
  }

  fitCamera(width: number, height: number): CameraState {
    const camera = createFittedCamera(this.getLocalBounds(), { width, height });
    this.applyCamera(camera);
    return camera;
  }

  fit(width: number, height: number): void {
    this.fitCamera(width, height);
  }

  private drawCoverageTile(graphics: Graphics, x: number, y: number, color: number, alpha: number): void {
    const center = gridToScreen(x, y);
    graphics
      .poly([
        center.x, center.y - TILE_HEIGHT / 2,
        center.x + TILE_WIDTH / 2, center.y,
        center.x, center.y + TILE_HEIGHT / 2,
        center.x - TILE_WIDTH / 2, center.y,
      ], true)
      .fill({ color, alpha });
  }

  private createBuildingSprite(building: Building, options: MapRenderOptions): Sprite {
    const sprite = this.createTileSprite(building, this.textures[building.type]);
    if (building.type === 'house') {
      const level = building.level ?? 1;
      if (options.foodOverlay === true && building.hasFood !== true) {
        sprite.tint = 0xd8792f;
      } else if (level >= 3) {
        sprite.tint = 0xb9e36f;
      } else if (level >= 2) {
        sprite.tint = 0xffe2a0;
      }
    }
    if (isWorkplace(building.type) && building.active !== true) {
      sprite.alpha = 0.55;
      sprite.tint = 0xb06a6a;
    } else if (building.type === 'garden') {
      sprite.tint = 0x75b85a;
    } else if (building.type === 'plaza') {
      sprite.tint = 0xd6b56a;
    } else if (building.type === 'fountain') {
      sprite.tint = 0x63b6df;
    }
    return sprite;
  }

  private createTileSprite(position: TilePosition, texture: Texture): Sprite {
    const sprite = new Sprite(texture);
    const screenPosition = gridToScreen(position.x, position.y);
    // All curated sprites have a diamond footprint at the bottom of the image.
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(TILE_WIDTH / texture.width);
    sprite.position.set(screenPosition.x, screenPosition.y + TILE_HEIGHT / 2);
    return sprite;
  }
}

interface TilePosition {
  readonly x: number;
  readonly y: number;
}

interface MapRenderOptions {
  readonly waterOverlay?: boolean;
  readonly foodOverlay?: boolean;
  readonly desirabilityOverlay?: boolean;
  readonly roadNetworkOverlay?: boolean;
}
