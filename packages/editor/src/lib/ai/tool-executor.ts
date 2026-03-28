import {
  type AnyNode,
  type AnyNodeId,
  CeilingNode,
  DoorNode,
  ItemNode,
  LevelNode,
  RoofNode,
  RoofSegmentNode,
  type SiteNode,
  SlabNode,
  useScene,
  WallNode,
  WindowNode,
  ZoneNode,
} from '@pascal-app/core'
import { CATALOG_ITEMS } from '../../components/ui/item-catalog/catalog-items'
import { getCondensedCatalog } from './catalog-context'
import type { SceneContext } from './types'

const ZONE_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#14b8a6',
  '#6366f1',
]

let zoneColorIndex = 0

function nextZoneColor(): string {
  const color = ZONE_COLORS[zoneColorIndex % ZONE_COLORS.length]!
  zoneColorIndex++
  return color
}

/**
 * Convert a parametric t (0-1 along wall) to wall-local [x, y, z].
 * Wall-local: x = 0 is wall center, y = height above wall base, z = 0.
 * Doors:   y = doorHeight / 2  (centered vertically at door midpoint)
 * Windows: y = sillHeight + windowHeight / 2  (centered at window midpoint)
 */
function wallLocalPosition(
  wall: WallNode,
  t: number,
  centerY: number,
): [number, number, number] {
  const dx = wall.end[0] - wall.start[0]
  const dz = wall.end[1] - wall.start[1]
  const wallLength = Math.sqrt(dx * dx + dz * dz)
  const localX = (t - 0.5) * wallLength
  return [localX, centerY, 0]
}

function getChildrenOfLevel(levelId: string): AnyNode[] {
  const { nodes } = useScene.getState()
  const level = nodes[levelId as AnyNodeId]
  if (!level || level.type !== 'level') return []
  const levelNode = level as LevelNode
  return levelNode.children
    .map((childId) => nodes[childId as AnyNodeId])
    .filter(Boolean) as AnyNode[]
}

export async function executeToolCall(
  toolCall: { name: string; arguments: string },
  context: SceneContext,
): Promise<string> {
  try {
    const args = JSON.parse(toolCall.arguments || '{}')
    const { getState } = useScene

    switch (toolCall.name) {
      case 'create_walls': {
        const { walls } = args as {
          walls: Array<{
            start: [number, number]
            end: [number, number]
            thickness?: number
            height?: number
          }>
        }
        const ops: { node: AnyNode; parentId: AnyNodeId }[] = []
        const createdIds: string[] = []

        for (const w of walls) {
          const wall = WallNode.parse({
            start: w.start,
            end: w.end,
            ...(w.thickness != null ? { thickness: w.thickness } : {}),
            ...(w.height != null ? { height: w.height } : {}),
          })
          createdIds.push(wall.id)
          ops.push({ node: wall, parentId: context.levelId as AnyNodeId })
        }

        getState().createNodes(ops)
        return JSON.stringify({ success: true, createdIds })
      }

      case 'create_slab': {
        const { polygon, elevation } = args as {
          polygon: [number, number][]
          elevation?: number
        }
        const slab = SlabNode.parse({
          polygon,
          ...(elevation != null ? { elevation } : {}),
        })
        getState().createNode(slab, context.levelId as AnyNodeId)
        return JSON.stringify({ success: true, createdId: slab.id })
      }

      case 'create_ceiling': {
        const { polygon, height } = args as {
          polygon: [number, number][]
          height?: number
        }
        const ceiling = CeilingNode.parse({
          polygon,
          ...(height != null ? { height } : {}),
        })
        getState().createNode(ceiling, context.levelId as AnyNodeId)
        return JSON.stringify({ success: true, createdId: ceiling.id })
      }

      case 'create_doors': {
        const { doors } = args as {
          doors: Array<{
            wallId: string
            position?: number
            width?: number
            height?: number
            side?: 'front' | 'back'
            hingesSide?: 'left' | 'right'
            swingDirection?: 'inward' | 'outward'
          }>
        }
        const ops: { node: AnyNode; parentId: AnyNodeId }[] = []
        const createdIds: string[] = []

        for (const d of doors) {
          const wall = getState().nodes[d.wallId as AnyNodeId] as WallNode | undefined
          if (!wall || wall.type !== 'wall') {
            return JSON.stringify({ error: `Wall ${d.wallId} not found` })
          }

          const t = d.position ?? 0.5
          const doorHeight = d.height ?? 2.1
          const pos = wallLocalPosition(wall, t, doorHeight / 2)

          const door = DoorNode.parse({
            position: pos,
            wallId: d.wallId,
            side: d.side ?? 'front',
            ...(d.width != null ? { width: d.width } : {}),
            ...(d.height != null ? { height: d.height } : {}),
            ...(d.hingesSide ? { hingesSide: d.hingesSide } : {}),
            ...(d.swingDirection ? { swingDirection: d.swingDirection } : {}),
          })
          createdIds.push(door.id)
          ops.push({ node: door, parentId: d.wallId as AnyNodeId })
        }

        getState().createNodes(ops)
        return JSON.stringify({ success: true, createdIds })
      }

      case 'create_windows': {
        const { windows } = args as {
          windows: Array<{
            wallId: string
            position?: number
            width?: number
            height?: number
            sillHeight?: number
            side?: 'front' | 'back'
          }>
        }
        const ops: { node: AnyNode; parentId: AnyNodeId }[] = []
        const createdIds: string[] = []

        for (const w of windows) {
          const wall = getState().nodes[w.wallId as AnyNodeId] as WallNode | undefined
          if (!wall || wall.type !== 'wall') {
            return JSON.stringify({ error: `Wall ${w.wallId} not found` })
          }

          const t = w.position ?? 0.5
          const sillHeight = w.sillHeight ?? 0.9
          const windowHeight = w.height ?? 1.5
          const centerY = sillHeight + windowHeight / 2
          const pos = wallLocalPosition(wall, t, centerY)

          const window = WindowNode.parse({
            position: pos,
            wallId: w.wallId,
            side: w.side ?? 'front',
            ...(w.width != null ? { width: w.width } : {}),
            ...(w.height != null ? { height: w.height } : {}),
          })
          createdIds.push(window.id)
          ops.push({ node: window, parentId: w.wallId as AnyNodeId })
        }

        getState().createNodes(ops)
        return JSON.stringify({ success: true, createdIds })
      }

      case 'create_zones': {
        const { zones } = args as {
          zones: Array<{
            name: string
            polygon: [number, number][]
            color?: string
          }>
        }
        const ops: { node: AnyNode; parentId: AnyNodeId }[] = []
        const createdIds: string[] = []

        for (const z of zones) {
          const zone = ZoneNode.parse({
            name: z.name,
            polygon: z.polygon,
            color: z.color ?? nextZoneColor(),
          })
          createdIds.push(zone.id)
          ops.push({ node: zone, parentId: context.levelId as AnyNodeId })
        }

        getState().createNodes(ops)
        return JSON.stringify({ success: true, createdIds })
      }

      case 'place_items': {
        const { items } = args as {
          items: Array<{
            catalogId: string
            position: [number, number, number]
            rotation?: number
            wallId?: string
            wallT?: number
            side?: 'front' | 'back'
          }>
        }
        const ops: { node: AnyNode; parentId: AnyNodeId }[] = []
        const createdIds: string[] = []
        const errors: string[] = []

        for (const i of items) {
          const catalogItem = CATALOG_ITEMS.find((c) => c.id === i.catalogId)
          if (!catalogItem) {
            errors.push(`Catalog item "${i.catalogId}" not found`)
            continue
          }

          const rotationRad = ((i.rotation ?? 0) * Math.PI) / 180

          const item = ItemNode.parse({
            position: i.position,
            rotation: [0, rotationRad, 0],
            scale: [1, 1, 1],
            asset: catalogItem,
            ...(i.wallId ? { wallId: i.wallId } : {}),
            ...(i.wallT != null ? { wallT: i.wallT } : {}),
            ...(i.side ? { side: i.side } : {}),
          })
          createdIds.push(item.id)

          const parentId = i.wallId ? (i.wallId as AnyNodeId) : (context.levelId as AnyNodeId)
          ops.push({ node: item, parentId })
        }

        if (ops.length > 0) getState().createNodes(ops)
        return JSON.stringify({
          success: true,
          createdIds,
          ...(errors.length > 0 ? { errors } : {}),
        })
      }

      case 'create_roof': {
        const { position, rotation, segments } = args as {
          position: [number, number, number]
          rotation?: number
          segments?: Array<{
            roofType?: string
            width?: number
            depth?: number
            wallHeight?: number
            roofHeight?: number
            overhang?: number
          }>
        }

        const roofSegments = segments ?? [{}]
        const segmentNodes: AnyNode[] = []
        const segmentIds: string[] = []

        for (const seg of roofSegments) {
          const segment = RoofSegmentNode.parse({
            ...(seg.roofType ? { roofType: seg.roofType } : {}),
            ...(seg.width != null ? { width: seg.width } : {}),
            ...(seg.depth != null ? { depth: seg.depth } : {}),
            ...(seg.wallHeight != null ? { wallHeight: seg.wallHeight } : {}),
            ...(seg.roofHeight != null ? { roofHeight: seg.roofHeight } : {}),
            ...(seg.overhang != null ? { overhang: seg.overhang } : {}),
          })
          segmentNodes.push(segment)
          segmentIds.push(segment.id)
        }

        const roof = RoofNode.parse({
          position,
          rotation: rotation ?? 0,
          children: segmentIds,
        })

        const ops: { node: AnyNode; parentId: AnyNodeId }[] = [
          { node: roof, parentId: context.levelId as AnyNodeId },
        ]
        for (const seg of segmentNodes) {
          ops.push({ node: seg, parentId: roof.id as AnyNodeId })
        }

        getState().createNodes(ops)
        return JSON.stringify({ success: true, roofId: roof.id, segmentIds })
      }

      case 'update_nodes': {
        const { updates } = args as {
          updates: Array<{ id: string; data: Record<string, unknown> }>
        }
        getState().updateNodes(
          updates.map((u) => ({
            id: u.id as AnyNodeId,
            data: u.data as Partial<AnyNode>,
          })),
        )
        return JSON.stringify({ success: true, updatedIds: updates.map((u) => u.id) })
      }

      case 'delete_nodes': {
        const { nodeIds } = args as { nodeIds: string[] }
        getState().deleteNodes(nodeIds as AnyNodeId[])
        return JSON.stringify({ success: true, deletedIds: nodeIds })
      }

      case 'set_site_boundary': {
        const { polygon } = args as { polygon: [number, number][] }
        const siteId = context.siteId as AnyNodeId
        getState().updateNode(siteId, {
          polygon: { type: 'polygon', points: polygon },
        } as Partial<AnyNode>)
        return JSON.stringify({ success: true, siteId })
      }

      case 'get_scene_info': {
        const children = getChildrenOfLevel(context.levelId)
        const summary = {
          walls: [] as unknown[],
          slabs: [] as unknown[],
          ceilings: [] as unknown[],
          doors: [] as unknown[],
          windows: [] as unknown[],
          zones: [] as unknown[],
          items: [] as unknown[],
          roofs: [] as unknown[],
        }

        for (const node of children) {
          switch (node.type) {
            case 'wall': {
              const w = node as WallNode
              summary.walls.push({
                id: w.id,
                start: w.start,
                end: w.end,
                thickness: w.thickness,
                height: w.height,
                childCount: w.children.length,
              })
              // Also include doors/windows attached to this wall
              for (const childId of w.children) {
                const child = getState().nodes[childId as AnyNodeId]
                if (child?.type === 'door') {
                  summary.doors.push({ id: child.id, wallId: w.id, type: 'door' })
                } else if (child?.type === 'window') {
                  summary.windows.push({ id: child.id, wallId: w.id, type: 'window' })
                } else if (child?.type === 'item') {
                  const itemChild = child as ItemNode
                  summary.items.push({
                    id: child.id,
                    type: 'item',
                    name: itemChild.asset?.name,
                    wallId: w.id,
                  })
                }
              }
              break
            }
            case 'slab': {
              const s = node as SlabNode
              summary.slabs.push({ id: s.id, polygon: s.polygon, elevation: s.elevation })
              break
            }
            case 'ceiling': {
              const c = node as CeilingNode
              summary.ceilings.push({ id: c.id, polygon: c.polygon, height: c.height })
              break
            }
            case 'zone': {
              const z = node as ZoneNode
              let zMinX = Infinity
              let zMaxX = -Infinity
              let zMinZ = Infinity
              let zMaxZ = -Infinity
              for (const [px, pz] of z.polygon) {
                zMinX = Math.min(zMinX, px)
                zMaxX = Math.max(zMaxX, px)
                zMinZ = Math.min(zMinZ, pz)
                zMaxZ = Math.max(zMaxZ, pz)
              }
              summary.zones.push({
                id: z.id,
                name: z.name,
                polygon: z.polygon,
                color: z.color,
                bounds: { minX: zMinX, maxX: zMaxX, minZ: zMinZ, maxZ: zMaxZ },
                center: [(zMinX + zMaxX) / 2, (zMinZ + zMaxZ) / 2],
                width: zMaxX - zMinX,
                depth: zMaxZ - zMinZ,
              })
              break
            }
            case 'roof': {
              const r = node as RoofNode
              summary.roofs.push({ id: r.id, position: r.position, children: r.children })
              break
            }
          }
        }

        return JSON.stringify(summary)
      }

      case 'get_catalog': {
        const { category } = args as { category?: string }
        let items = getCondensedCatalog()
        if (category) {
          items = items.filter((i) => i.category === category)
        }
        return JSON.stringify(items)
      }

      case 'get_site_info': {
        const siteNode = getState().nodes[context.siteId as AnyNodeId] as SiteNode | undefined
        if (!siteNode) return JSON.stringify({ error: 'Site not found' })

        const points = siteNode.polygon?.points ?? []
        let minX = Infinity
        let maxX = -Infinity
        let minZ = Infinity
        let maxZ = -Infinity
        for (const [x, z] of points) {
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minZ = Math.min(minZ, z)
          maxZ = Math.max(maxZ, z)
        }

        return JSON.stringify({
          siteId: siteNode.id,
          polygon: points,
          bounds: { minX, maxX, minZ, maxZ },
          width: maxX - minX,
          depth: maxZ - minZ,
          area: (maxX - minX) * (maxZ - minZ),
        })
      }

      case 'create_level': {
        const { level: levelNum } = args as { level: number }
        const newLevel = LevelNode.parse({ level: levelNum })
        getState().createNode(newLevel, context.buildingId as AnyNodeId)
        return JSON.stringify({ success: true, levelId: newLevel.id, level: levelNum })
      }

      case 'clear_level': {
        const children = getChildrenOfLevel(context.levelId)
        const ids = children.map((n) => n.id as AnyNodeId)
        if (ids.length > 0) getState().deleteNodes(ids)
        return JSON.stringify({ success: true, deletedCount: ids.length })
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolCall.name}` })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return JSON.stringify({ error: message })
  }
}
