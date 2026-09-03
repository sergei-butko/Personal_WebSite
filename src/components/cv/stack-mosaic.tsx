import type { CvSkillGroup } from '@/lib/cv'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'

/**
 * The stack, as tiles whose widths say how much each area holds.
 *
 * Azure carries eight tools to AWS's six, so it takes seven of the twelve
 * tracks to AWS's five — an even 3+3 would claim the two are the same size and
 * leave Azure's chips wrapping to a third line while AWS sat half empty.
 *
 * The span arrives as a custom property rather than a utility class; the
 * reason it cannot be a class, and the media queries that retire the split on
 * narrow screens, are in `globals.css` under `.stack-mosaic`.
 *
 * Area names are English in both languages. "Front end" has a Ukrainian form
 * and "CI/CD & IaC" does not, and half a translated section reads worse than
 * none.
 */
export function StackMosaic({ groups }: { groups: CvSkillGroup[] }) {
  return (
    <div className="stack-mosaic mt-3">
      {groups.map((group) => (
        <Card
          key={group.area}
          as="section"
          className="px-4 pt-3.5 pb-4"
          style={{ ['--span' as string]: group.span }}
        >
          <h3 className="border-b border-edge pb-2 font-mono text-[11px] font-semibold tracking-[0.06em] text-accent uppercase">
            {group.area}
          </h3>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {group.items.map((item) => (
              <Chip key={item}>{item}</Chip>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
