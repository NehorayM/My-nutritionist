import { useMemo, useState } from 'react'
import type { ScheduledWorkout, WorkoutEntry } from '@/types'
import type { WorkoutSheetTarget } from '../model/workoutForm'

interface SheetSlot {
  open: boolean
  /** Bumped on every open so the form starts fresh, while the closing sheet keeps its content. */
  key: number
}

export interface ActivitySheets {
  workout: SheetSlot & { target: WorkoutSheetTarget }
  plan: SheetSlot
  openLog: () => void
  openEdit: (workout: WorkoutEntry) => void
  openComplete: (session: ScheduledWorkout) => void
  openPlan: () => void
  setWorkoutOpen: (open: boolean) => void
  setPlanOpen: (open: boolean) => void
}

/** Open/close state for the Activity tab's sheets (log/edit/complete workout, weekly plan). */
export function useActivitySheets(): ActivitySheets {
  const [workout, setWorkout] = useState<ActivitySheets['workout']>({ open: false, key: 0, target: { mode: 'log' } })
  const [plan, setPlan] = useState<SheetSlot>({ open: false, key: 0 })

  const actions = useMemo(() => {
    const openWorkout = (target: WorkoutSheetTarget) => setWorkout((slot) => ({ open: true, key: slot.key + 1, target }))
    return {
      openLog: () => openWorkout({ mode: 'log' }),
      openEdit: (entry: WorkoutEntry) => openWorkout({ mode: 'edit', workout: entry }),
      openComplete: (session: ScheduledWorkout) => openWorkout({ mode: 'complete', session }),
      openPlan: () => setPlan((slot) => ({ open: true, key: slot.key + 1 })),
      setWorkoutOpen: (open: boolean) => setWorkout((slot) => ({ ...slot, open })),
      setPlanOpen: (open: boolean) => setPlan((slot) => ({ ...slot, open })),
    }
  }, [])

  return { workout, plan, ...actions }
}
