// Client-side display names for tool call indicators.
// Full tool definitions live in apps/editor/lib/ai/tool-definitions.ts (server-side).

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  create_walls: 'Creating walls',
  create_slab: 'Creating floor slab',
  create_ceiling: 'Creating ceiling',
  create_doors: 'Placing doors',
  create_windows: 'Placing windows',
  create_zones: 'Labeling rooms',
  place_items: 'Placing furniture',
  create_roof: 'Creating roof',
  update_nodes: 'Updating elements',
  delete_nodes: 'Removing elements',
  set_site_boundary: 'Setting site boundary',
  get_scene_info: 'Reading scene',
  get_catalog: 'Browsing catalog',
  get_site_info: 'Reading site info',
  create_level: 'Adding floor level',
  clear_level: 'Clearing level',
}
