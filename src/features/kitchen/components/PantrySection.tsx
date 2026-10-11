import { Plus, Refrigerator } from 'lucide-react'
import { useId } from 'react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '@/components/ui'
import type { PantryItem } from '@/types'
import { PantryItemRow } from './PantryItemRow'

interface PantrySectionProps {
  pantry: readonly PantryItem[]
  today: string
  onAdd: () => void
  onEdit: (item: PantryItem) => void
  onRemove: (item: PantryItem) => void
}

/** What's at home (fridge, freezer, pantry): the ingredients plans may use. */
export function PantrySection({ pantry, today, onAdd, onEdit, onRemove }: PantrySectionProps) {
  const headingId = useId()
  return (
    <Card as="section" aria-labelledby={headingId}>
      <CardHeader
        action={
          pantry.length > 0 ? (
            <Button size="sm" variant="secondary" leadingIcon={<Plus />} onClick={onAdd}>
              Add
            </Button>
          ) : null
        }
      >
        <CardTitle as="h2" id={headingId}>
          Your kitchen
        </CardTitle>
        <CardDescription>
          {pantry.length === 0 ? 'Plans use only what you list here.' : `${pantry.length} ${pantry.length === 1 ? 'item' : 'items'} · plans use only these`}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-1">
        {pantry.length === 0 ? (
          <EmptyState
            compact
            icon={<Refrigerator />}
            title="Your kitchen is empty"
            description="Add what’s in your fridge and pantry — eggs, rice, vegetables, leftovers — and get meals made only from them."
            actions={
              <Button leadingIcon={<Plus />} onClick={onAdd}>
                Add your first item
              </Button>
            }
          />
        ) : (
          <ul aria-label="Kitchen items" className="divide-y divide-border/60">
            {pantry.map((item) => (
              <PantryItemRow key={item.id} item={item} today={today} onEdit={onEdit} onRemove={onRemove} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
