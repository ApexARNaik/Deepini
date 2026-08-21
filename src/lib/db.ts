import Dexie, { Table } from 'dexie';
import { Room, SpatialPhoto, SpatialHotspot, Component, Tag, ComponentLocation, Project, ProjectComponent } from './api';

export class DeepiniDB extends Dexie {
  rooms!: Table<Room, string>;
  spatial_photos!: Table<SpatialPhoto, string>;
  spatial_hotspots!: Table<SpatialHotspot, string>;
  components!: Table<Component, string>;
  tags!: Table<Tag, string>;
  component_tags!: Table<{ component_id: string, tag_id: string }, [string, string]>;
  component_locations!: Table<ComponentLocation, string>;
  projects!: Table<Project, string>;
  project_components!: Table<ProjectComponent, string>;
  component_totals!: Table<{ component_id: string, total_owned_qty: number, total_checked_out: number, in_storage_qty: number }, string>;

  constructor() {
    super('DeepiniDB');
    this.version(1).stores({
      rooms: 'id, name, order_index',
      spatial_photos: 'id, room_id, parent_hotspot_id',
      spatial_hotspots: 'id, photo_id, is_leaf',
      components: 'id, name, pending_delete',
      tags: 'id, name',
      component_tags: '[component_id+tag_id], component_id, tag_id',
      component_locations: 'id, component_id, hotspot_id',
      projects: 'id, name, status',
      project_components: 'id, project_id, component_id, returned_at',
      component_totals: 'component_id' // Primary key
    });
  }
}

export const db = new DeepiniDB();
