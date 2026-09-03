import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { profile } from '@/content/profile'
import { cv, resumeUrl, text } from '@/lib/cv'
import { Container } from '@/components/layout/container'
import { IdentityCard } from '@/components/cv/identity-card'
import { SectionHead } from '@/components/cv/section-head'
import { ExperienceTimeline } from '@/components/cv/experience-timeline'
import { StackMosaic } from '@/components/cv/stack-mosaic'
import { EducationGrid } from '@/components/cv/education-grid'
import { FactList } from '@/components/cv/fact-list'
import { ResumeCard } from '@/components/cv/resume-card'

/**
 * The CV: an identity rail that follows you down, and the career as a dated
 * spine beside it.
 *
 * No PageHeading. The identity card is the heading — name, role, and the three
 * ways to reach him — and a second "CV" in 30px above it would say nothing the
 * nav has not already said, while pushing the first role below the fold. The
 * h1 survives screen-reader-only, as it does on the perfumery and photo pages,
 * because a page with no heading breaks heading-based navigation.
 *
 * The rail sticks because its whole argument is that the contact details are
 * on screen at every scroll position; it releases at the foot of the grid on
 * its own, and stops being sticky below `lg` where it sits above the spine
 * rather than beside it.
 */
export default async function CvPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDictionary(locale)

  // The rail's second button points at whichever contact is the profile the CV
  // was assembled from. Looked up rather than hardcoded so removing the entry
  // from content/cv.ts removes the button too, instead of leaving a dead one.
  const profileLink = cv.contacts.find((contact) => contact.platform === 'linkedin')

  return (
    <Container>
      <h1 className="sr-only">{dict.cv.title}</h1>

      <div className="grid items-start gap-3.5 lg:grid-cols-[268px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3 lg:sticky lg:top-4">
          <IdentityCard
            name={cv.name}
            initials={profile.initials}
            role={cv.role}
            org={cv.org}
            location={cv.location}
            contacts={cv.contacts}
            portrait={cv.portrait}
            locale={locale}
          />

          {cv.certifications.length > 0 ? (
            <FactList
              label={dict.cv.certifications}
              facts={cv.certifications.map((cert) => ({
                id: cert.title,
                title: cert.title,
                note: cert.org,
                meta: text(cert.when, locale),
              }))}
            />
          ) : null}

          <FactList
            label={dict.cv.languages}
            facts={cv.languages.map((language) => ({
              id: text(language.name, 'en'),
              title: text(language.name, locale),
              meta: text(language.level, locale),
            }))}
          />

          {profileLink ? (
            <ResumeCard
              label={dict.cv.resume}
              note={dict.cv.resumeNote}
              downloadLabel={dict.cv.download}
              resumeUrl={resumeUrl}
              profileLabel={dict.cv.openProfile}
              profileHref={profileLink.href}
            />
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-col gap-3.5">
          <section>
            <SectionHead label={dict.cv.experience} note={text(cv.tenure, locale)} />
            <ExperienceTimeline
              roles={cv.roles}
              locale={locale}
              nowLabel={dict.cv.now}
              concurrentLabel={dict.cv.concurrent}
            />
          </section>

          <section>
            <SectionHead label={dict.cv.stack} note={dict.cv.stackNote} />
            <StackMosaic groups={cv.skills} />
          </section>

          <section>
            <SectionHead label={dict.cv.education} />
            <EducationGrid entries={cv.education} locale={locale} />
          </section>
        </div>
      </div>
    </Container>
  )
}
