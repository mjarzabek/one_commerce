import { KeyboardSensor, PointerSensor, useSensor, useSensors, type Announcements, type DndContextProps } from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { CSS, type Transform } from "@dnd-kit/utilities"
import { GripVerticalIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Wspólne ustawienia przeciągania list (dnd-kit): mysz/dotyk po przesunięciu o kilka px (zwykłe kliknięcie nie
// zaczyna przeciągania), klawiatura: spacja - podnieś/upuść, strzałki - przesuń, Esc - anuluj.
export function useSortableSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

const announcements: Announcements = {
  onDragStart: () => "Podniesiono element. Strzałki przesuwają, spacja upuszcza, Esc anuluje.",
  onDragOver: ({ over }) => (over ? "Element przesunięty." : "Element poza listą."),
  onDragEnd: ({ over }) => (over ? "Upuszczono element." : "Upuszczono poza listą."),
  onDragCancel: () => "Anulowano przeciąganie.",
}

// Props DndContext wspólne dla list: tylko pionowo, polskie komunikaty dla czytników ekranu.
export const sortableContextProps: Partial<DndContextProps> = {
  modifiers: [restrictToVerticalAxis],
  accessibility: {
    announcements,
    screenReaderInstructions: { draggable: "Naciśnij spację, aby podnieść element i zmienić kolejność strzałkami." },
  },
}

export const sortableStyle = (transform: Transform | null, transition: string | undefined) => ({
  transform: CSS.Translate.toString(transform),
  transition,
})

// Ikona uchwytu na początku wiersza - przeciągać można za cały wiersz.
export function DragGrip({ className }: { className?: string }) {
  return <GripVerticalIcon aria-hidden className={cn("text-muted-foreground/60 size-4 shrink-0", className)} />
}

// Obszar w przeciąganym wierszu, który nie zaczyna przeciągania (przyciski akcji i ich okna - zdarzenia z portali
// też przechodzą przez drzewo Reacta).
export function NoDrag({ children, className }: { children: React.ReactNode; className?: string }) {
  const stop = (event: React.SyntheticEvent) => event.stopPropagation()
  return (
    <div className={className} onPointerDown={stop} onKeyDown={stop}>
      {children}
    </div>
  )
}
