# Pascal Editor — Claude Rules & Architecture

## Monorepo Structure

Managed with **Turborepo** + **Bun** (v1.3.0). Package manager is `bun`, not npm/yarn.

```
apps/
  editor/              # Next.js 16 app (port 3002) — main deployable
packages/
  core/                # @pascal-app/core — schema, store, systems, spatial logic
  viewer/              # @pascal-app/viewer — 3D canvas (React Three Fiber)
  editor/              # @pascal-app/editor — editor UI, tools, keyboard, sidebar
  ui/                  # @repo/ui — shared Radix-based primitives
tooling/
  release/             # Release automation
  typescript/          # Shared tsconfig exports
```

**Dependency direction:** `apps/editor` → `packages/editor` → `packages/viewer` → `packages/core`. Never reverse.

---

## Dev Workflow

```bash
bun dev          # Start all (port 3002)
bun build        # Full monorepo build
bun check        # Biome lint + format check
bun check:fix    # Auto-fix lint/format issues
bun check-types  # TypeScript check across all packages
bun kill         # Kill port 3002
```

Biome config: 100-char line width, single quotes, 2-space indent. Run `bun check:fix` before finishing any task.

There are **no automated tests** in this codebase. Verify changes by running the dev server.

---

## packages/core

Central library — no UI, no rendering. Everything else depends on it.

### Schema

All nodes validated with **Zod**. Every node extends `BaseNode`:
- `id`: Prefix + nanoid(16) — e.g., `wall_abc123`, `item_xyz789`
- `parentId`: References parent or `null`
- `type`: Discriminator for `AnyNode` union
- `metadata`: Optional JSON object

**Node type hierarchy:** `Site → Building → Level → (Wall, Slab, Ceiling, Roof, Zone, Guide, Scan)`. Wall children: `Item`, `Window`, `Door`.

**Key node fields to know:**
- `Wall`: `start`/`end` as `[x, z]` tuples, `thickness`, `height`, `frontSide`/`backSide`
- `Item`: `position`, `rotation`, `scale` (3D vectors); `wallId`+`wallT` for wall-attachment; `asset.interactive` for controls
- `Window`/`Door`: `position` in wall-local coords, parametric dimensions
- `Slab`/`Ceiling`: `polygon` as `[x, z][]`, `holes` as nested polygon arrays, `elevation`
- `RoofSegment`: `roofType`, `width`, `depth`, `roofHeight`, `wallHeight`, `overhang`

### Node Creation Rule

**Always** use `NodeType.parse({…})` then `createNode(node, parentId)`. Never construct raw node objects or bypass Zod parsing.

```typescript
const wall = WallNode.parse({ type: 'wall', start: [0, 0], end: [5, 0], ... })
useScene.getState().createNode(wall, levelId)
```

### Store (useScene)

Zustand + Zundo (50-step undo history). Key state:

```typescript
nodes: Record<id, AnyNode>       // Flat dictionary — the entire scene
rootNodeIds: string[]            // Top-level Site IDs
dirtyNodes: Set<id>              // Nodes needing geometry recompute
collections: Record<id, Collection>
```

Key mutations: `createNode`, `updateNode`, `updateNodes`, `deleteNode`, `deleteNodes`, `markDirty`, `clearDirty`.

Undo/redo is **temporal** — on undo, the store diffs nodes and auto-marks changed nodes dirty so systems recompute geometry.

**Collections** are denormalized: `collectionIds` is stamped on nodes for O(1) membership lookup.

### Systems (packages/core/src/systems/)

Each system is a **React component** that runs inside the R3F canvas using `useFrame`. Pattern:
1. Subscribe to `useScene` for `dirtyNodes`
2. Fetch THREE objects from `sceneRegistry`
3. Recompute geometry if node is dirty
4. Call `clearDirty(id)` after processing

Systems use **CSG** (`three-bvh-csg`) for walls, polygon extrusion for slabs/ceilings, and parametric geometry for windows/doors.

**Never** put rendering logic in a system. **Never** put geometry generation in a renderer.

### Hooks

- `useRegistry(id, type, ref)` — Register a THREE.Object3D in sceneRegistry
- `useSpatialQuery()` — Query 2D spatial grid for nearby walls/nodes; always prefer over brute-force iteration
- `sceneRegistry` — Singleton: `getById(id)`, `getByType(type)` → O(1) lookups

### Events (packages/core/src/events/bus.ts)

Mitt-based typed bus. Event naming: `type:action` — e.g., `wall:click`, `grid:pointerdown`, `item:move`.

Common events: `wall:click`, `item:move`, `slab:context-menu`, `grid:pointerdown`, `grid:enter`, `camera-controls:view`, `camera-controls:focus`, `tool:cancel`.

---

## packages/viewer

3D canvas — **presentation only**. Must never import from `apps/editor` or `packages/editor`.

### Renderers (src/components/renderers/)

One renderer per node type. Renderers create **placeholder meshes only** — they do not generate geometry. Systems update the geometry on `useFrame`. Route: `SceneRenderer → NodeRenderer → [TypeRenderer]`.

Register each renderer's mesh with `useRegistry(id, type, ref)` so systems can find it.

### Viewer Store (useViewer)

```typescript
selection: { selectedIds, buildingId, levelId, zoneId }
levelDisplayMode: 'stacked' | 'exploded' | 'solo'
cameraMode: 'orbit' | 'walkaround'
```

### Viewer Systems (src/systems/)

- `LevelSystem` — level visibility, stacked/exploded/solo
- `WallCutout` — cutaway walls for interior view
- `ZoneSystem` — zone rendering
- `InteractiveSystem` — portals HTML interactive controls (toggle/slider/temperature) into 3D world

---

## packages/editor

Editor UI, tools, and state. Composes `@pascal-app/viewer`.

### Editor Store (useEditor)

Persisted to localStorage (transient states excluded).

```typescript
phase: 'site' | 'structure' | 'furnish'
mode: 'select' | 'edit' | 'delete' | 'build'
tool: Tool | null
structureLayer: 'zones' | 'elements'
catalogCategory: CatalogCategory | null
selectedItem: AssetInput | null
editingHole: { nodeId, holeIndex } | null
isPreviewMode: boolean
isFloorplanOpen: boolean
```

### Tools (src/components/tools/)

Each tool is a React component coordinated by `ToolManager`. Tools handle pointer events on the grid and call `useScene` mutations.

- `WallTool` — click-to-click wall drafting
- `SlabTool` / `CeilingTool` — polygon editor with hole editing
- `ItemTool` — placement with wall-attach / floor strategies
- `WindowTool` / `DoorTool` — parametric placement on walls
- `ZoneTool` — polygon with space detection
- `RoofTool` — parametric segment editing

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` / `2` / `3` | Switch phase (site/structure/furnish) |
| `v` | Select mode |
| `b` | Build mode |
| `s` / `f` / `z` | Structure / furnish / zones layer |
| `R` | Rotate selected node |
| `Delete` / `Backspace` | Delete selected |
| `Escape` | Cancel tool → select mode |
| `Cmd+Z` / `Shift+Cmd+Z` | Undo / Redo |
| `Cmd+↑` / `Cmd+↓` | Navigate levels |

---

## apps/editor (Next.js App)

- Entry: `app/page.tsx` → `<Editor projectId="local-editor" />`
- Routes: `/` (editor), `/privacy`, `/terms`, `/api/health`
- Public assets: 300+ GLB furniture models, audio files, demo projects in `public/`

---

## Data Flow

```
User input (pointer/keyboard)
  → Tool component (packages/editor/src/components/tools/)
  → useScene mutations (createNode / updateNode)
  → dirtyNodes set grows
  → System reads dirty IDs in useFrame()
  → System fetches THREE objects from sceneRegistry
  → System updates geometry / clears dirty flag
  → Renderer re-renders if THREE state changed
  → useViewer updates selection/hover
```

---

## Key Conventions

| Convention | Rule |
|---|---|
| Node creation | `NodeType.parse({…})` → `createNode(node, parentId)` — never bypass |
| Flat nodes | All nodes in `useScene.nodes`; hierarchy via `parentId` only |
| System/renderer split | Systems own geometry logic; renderers own mesh display |
| Viewer isolation | `packages/viewer` never imports from `packages/editor` or `apps/editor` |
| Registry | Use `useRegistry` / `sceneRegistry` for THREE lookups — no tree traversal |
| Spatial queries | Use `useSpatialQuery` for proximity — no brute-force loops |
| ID format | `prefix_nanoid16` — e.g., `wall_abc123` |
| Event naming | `type:action` — e.g., `wall:click`, `grid:pointerdown` |
| Component naming | PascalCase; hooks `useXxx`; stores `useXxx` |
| Formatter | Biome — run `bun check:fix` after editing |

---

## Gotchas & Non-Obvious Behaviours

1. **Renderers create empty meshes.** Geometry is only populated by systems on `useFrame`. If a mesh looks missing, check the corresponding system and dirty tracking.

2. **Wall mitering cascades.** Updating one wall should mark adjacent walls dirty too — the `WallSystem` handles junction mitering. If junctions look wrong, check that neighbours are also marked dirty.

3. **Wall attachments are parametric.** Items/windows/doors on walls use `wallId` + `wallT` (0–1 along wall). Wall-local position is recomputed by systems on wall updates.

4. **Dirty tracking is the trigger.** If nothing updates in the scene, ensure `markDirty(id)` was called. Calling `updateNode` alone marks the node dirty automatically; direct store writes do not.

5. **Undo/redo auto-marks dirty.** Zundo temporal diff calculates which nodes changed and marks them dirty — don't manually handle undo geometry recomputation.

6. **Collections are denormalized.** `collectionIds` on each node is kept in sync with `collections` record. Use store actions (`addToCollection`, `removeFromCollection`) — never mutate both sides manually.

7. **Scale migration.** Items without `scale` get `[1, 1, 1]` on load. Roof nodes are migrated to `Roof + RoofSegment` pair on load. These are one-time migrations in `useScene` hydration.

8. **No tests.** Validate changes by running `bun dev` and testing in browser. Run `bun check-types` to catch type errors before finishing.

9. **WebGPU Three.js.** Uses `three.webgpu`, not `three`. Type augmentations are in `packages/viewer/src/hooks/r3f.d.ts`. Import from `three/webgpu` where necessary.

10. **`packages/editor` vs `apps/editor`.** UI components, tools, and editor state live in `packages/editor`. The Next.js app in `apps/editor` is thin — it composes `packages/editor` into routes. Add new tools/UI in the package, not the app.

---

## How to Add a New Node Type

1. **Schema:** Add `NewNode` Zod schema in `packages/core/src/schema/nodes/new-node.ts`. Add to `AnyNode` union in `types.ts`.
2. **System:** Create `packages/core/src/systems/new/new-system.tsx`. Use `useFrame` + dirty tracking pattern.
3. **Renderer:** Create `packages/viewer/src/components/renderers/new/new-renderer.tsx`. Register mesh with `useRegistry`. Route it in `NodeRenderer`.
4. **Tool (if interactive):** Create `packages/editor/src/components/tools/new/new-tool.tsx`. Register in `ToolManager`.
5. Export from each package's `index.ts`.

## How to Add a New Tool

1. Create tool component in `packages/editor/src/components/tools/new-tool/`.
2. Add tool identifier to `Tool` type in `useEditor` store.
3. Register in `ToolManager` switch/map.
4. Add keyboard shortcut in `useKeyboard` hook if needed.
5. Add UI trigger in `action-menu/` or sidebar panel.

---

## Tech Stack

| Layer | Technology |
|---|---|
| 3D | Three.js 0.183 (WebGPU), React Three Fiber 9.5, Drei 10.7 |
| CSG | three-bvh-csg 0.0.18, three-mesh-bvh 0.9.8 |
| Framework | Next.js 16, React 19 |
| State | Zustand 5 + Zundo 2.3 (undo/redo) |
| Schema | Zod 4.3 |
| Events | Mitt 3.0 |
| UI | Radix UI, Tailwind CSS 4, Motion 12 |
| IDs | Nanoid 5.1 |
| Tooling | Biome 2.4, TypeScript 5.9, Turborepo 2.8, Bun 1.3 |
| Audio | Howler 2.2 |
| Storage | idb-keyval 6.2 (IndexedDB for assets) |
