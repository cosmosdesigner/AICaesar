import { Container, Sprite, type Texture } from 'pixi.js';
import type { MapTextures } from '../assets/AssetManifest';
import type { CityState } from '../simulation/CityState';
import { gridToScreen, TILE_HEIGHT, TILE_WIDTH } from './GridMath';

export class MapRenderer extends Container {
  constructor(city: CityState, private readonly textures: MapTextures) {
    super();
    this.eventMode = 'none';
    this.refresh(city);
  }

  refresh(city: CityState): void {
    // Destroy old display objects, but retain the shared asset textures.
    for (const child of this.removeChildren()) {
      child.destroy({ children: true });
    }

    const terrain = new Container();
    const buildings = new Container();
    this.addChild(terrain, buildings);

    for (const tile of city.tiles) {
      terrain.addChild(this.createTileSprite(tile, this.textures[tile.terrain]));
    }

    // Draw back to front; roofs must not be covered by a neighbouring ground tile.
    const renderedBuildings = [...city.buildings].sort((a, b) => (
      (a.x + a.y) - (b.x + b.y) || a.x - b.x
    ));
    for (const building of renderedBuildings) {
      buildings.addChild(this.createTileSprite(building, this.textures[building.type]));
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
