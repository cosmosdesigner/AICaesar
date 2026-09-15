import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { MapTextures } from '../assets/AssetManifest';
import type { Building, CityState } from '../simulation/CityState';
import { getFoodCoveredTiles, getTileKey, getWaterCoveredTiles } from '../simulation/Simulation';
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

    // Draw back to front; roofs must not be covered by a neighbouring ground tile.
    const renderedBuildings = [...city.buildings].sort((a, b) => (
      (a.x + a.y) - (b.x + b.y) || a.x - b.x
    ));
    for (const building of renderedBuildings) {
      buildings.addChild(this.createBuildingSprite(building, options));
    }
  }

  fit(width: number, height: number): void {
    const bounds = this.getLocalBounds();
    const padding = 24;
    const scale = Math.min(
      Math.max(1, width - padding * 2) / bounds.width,
      Math.max(1, height - padding * 2) / bounds.height,
    );
    this.scale.set(scale);
    this.position.set(
      (width - bounds.width * scale) / 2 - bounds.x * scale,
      (height - bounds.height * scale) / 2 - bounds.y * scale,
    );
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
}
