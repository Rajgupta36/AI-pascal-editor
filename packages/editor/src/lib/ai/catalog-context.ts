import { CATALOG_ITEMS } from '../../components/ui/item-catalog/catalog-items'

export type CatalogEntry = {
  id: string
  name: string
  category: string
  dimensions: [number, number, number]
  tags?: string[]
  attachTo?: string
}

export function getCondensedCatalog(): CatalogEntry[] {
  return CATALOG_ITEMS.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    dimensions: item.dimensions as [number, number, number],
    ...(item.tags ? { tags: item.tags } : {}),
    ...(item.attachTo ? { attachTo: item.attachTo } : {}),
  }))
}

export function getCatalogAsText(): string {
  const items = getCondensedCatalog()
  const byCategory: Record<string, CatalogEntry[]> = {}

  for (const item of items) {
    if (!byCategory[item.category]) byCategory[item.category] = []
    byCategory[item.category]!.push(item)
  }

  const lines: string[] = []
  for (const [category, entries] of Object.entries(byCategory)) {
    lines.push(`\n### ${category}`)
    for (const e of entries) {
      const dims = `${e.dimensions[0]}x${e.dimensions[1]}x${e.dimensions[2]}m`
      const tags = e.tags ? ` [${e.tags.join(', ')}]` : ''
      const attach = e.attachTo ? ` (${e.attachTo})` : ''
      lines.push(`- ${e.id}: "${e.name}" ${dims}${attach}${tags}`)
    }
  }

  return lines.join('\n')
}
