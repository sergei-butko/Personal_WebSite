import type { CvInput } from '@/lib/cv'

/**
 * The CV, as data.
 *
 * Sourced from the LinkedIn profile, which is current, rather than from
 * `docs/CV_Serhii_Butko_2025.pdf`, which is a year behind it — the PDF still
 * says "1.5 years DevOps" and has the Master's in progress. The PDF's
 * contribution is the skills taxonomy below, which is better organised than
 * LinkedIn's flat list of 55.
 *
 * A bare string is the same in both languages. An `{ en, uk }` pair is a thing
 * that genuinely differs — see the note on `localized` in `lib/cv/index.ts`.
 * Everything here is validated by that schema at build time, strictly, so a
 * misspelt key is a failed build rather than a missing section.
 *
 * Deliberately NOT here: the phone number and the Skype handle that the PDF
 * carries. This page is indexed by Google; the email, LinkedIn and GitHub
 * reach him the same way without publishing a mobile number.
 */
export const cv = {
  name: { en: 'Serhii Butko', uk: 'Сергій Бутко' },
  role: 'DevOps Engineer',
  org: 'Itransition Group',
  location: { en: 'Kyiv, Ukraine', uk: 'Київ, Україна' },
  tenure: { en: '5 years at Itransition Group', uk: '5 років в Itransition Group' },

  contacts: [
    {
      platform: 'email',
      label: 'Email',
      value: 'sergei.butko24@gmail.com',
      href: 'mailto:sergei.butko24@gmail.com',
    },
    {
      platform: 'linkedin',
      label: 'LinkedIn',
      value: 'sergei-butko',
      href: 'https://www.linkedin.com/in/sergei-butko/',
    },
    {
      platform: 'github',
      label: 'GitHub',
      value: 'sergei-butko',
      href: 'https://github.com/sergei-butko',
    },
  ],

  /*
   * Newest first. `span` is written out rather than computed from the dates,
   * because computing it needs real dates and these are months — a `from` of
   * "Jul 2026" cannot say whether the role began on the 1st or the 31st, and a
   * duration off by a month in either direction is worse than one typed by the
   * person who was there.
   */
  roles: [
    {
      title: 'Middle DevOps Engineer',
      org: { en: 'Itransition Group · Hybrid', uk: 'Itransition Group · Гібридно' },
      from: { en: 'Jul 2026', uk: 'лип 2026' },
      to: { en: 'Present', uk: 'Тепер' },
      span: { en: '3 mos', uk: '3 міс' },
      current: true,
      // TODO(serhii): two or three lines about this role. LinkedIn has none,
      // and inventing them is how five fabricated posts once reached
      // production. An empty list renders the heading and the dates only.
      bullets: [],
      stack: [],
    },
    {
      title: 'DevOps / Support Engineer',
      org: 'Itransition Group',
      from: { en: 'Sep 2023', uk: 'вер 2023' },
      to: { en: 'Jul 2026', uk: 'лип 2026' },
      span: { en: '2 yrs 11 mos', uk: '2 р. 11 міс' },
      bullets: [
        {
          lead: 'AWS migration',
          text:
            '.NET console apps onto EC2 Windows Servers, web apps with IIS setup, ' +
            'Jenkins moved across with its plugins, monitoring re-established.',
        },
        {
          lead: 'Technical support',
          text:
            'Application Insights and Service Bus monitoring, issue reporting, ' +
            'client communication, and mentoring support engineers.',
        },
        {
          lead: 'Developer portal on Backstage',
          text:
            'Ubuntu server and Apache configuration, CI/CD through Azure DevOps, ' +
            'documentation.',
        },
      ],
      stack: [
        'AWS',
        'EC2',
        'IIS',
        'Jenkins',
        'Azure DevOps',
        'Application Insights',
        'Service Bus',
        'Backstage',
      ],
    },
    {
      title: 'Full-stack Developer',
      org: 'Itransition Group',
      from: { en: 'Jun 2024', uk: 'чер 2024' },
      to: { en: 'Jun 2026', uk: 'чер 2026' },
      span: { en: '2 yrs 1 mo', uk: '2 р. 1 міс' },
      concurrent: true,
      bullets: [
        { text: 'Built the Backstage developer portal end to end — back end and front.' },
        { text: 'PostgreSQL through Knex.' },
      ],
      stack: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Knex'],
    },
    {
      title: 'Middle Unity Developer',
      org: 'Itransition Group',
      from: { en: 'Apr 2023', uk: 'кві 2023' },
      to: { en: 'Aug 2023', uk: 'сер 2023' },
      span: { en: '5 mos', uk: '5 міс' },
      bullets: [
        {
          text:
            'Furniture viewer and configurator for WebGL — MVU architecture, ' +
            'SignalBus with Zenject, UI, and the WebGL integration.',
        },
      ],
      stack: ['Unity', 'C#', 'Zenject', 'WebGL'],
    },
    {
      title: 'Unity Developer',
      org: 'Itransition Group',
      from: { en: 'Mar 2022', uk: 'бер 2022' },
      to: { en: 'Mar 2023', uk: 'бер 2023' },
      span: { en: '1 yr 1 mo', uk: '1 р. 1 міс' },
      bullets: [
        {
          text:
            'A hotel lobby rendered for realism, VR included — scene layout, ' +
            '3D sound, object interaction.',
        },
        { text: 'A 2D self-ordering food kiosk.' },
        { text: 'Furniture viewer and configurator for WebGL.' },
      ],
      stack: ['Unity', 'C#', 'TextMeshPro', 'VR', 'WebGL'],
    },
    {
      title: 'Full-stack Developer',
      org: 'Itransition Group',
      from: { en: 'Oct 2021', uk: 'жов 2021' },
      to: { en: 'Mar 2022', uk: 'бер 2022' },
      span: { en: '6 mos', uk: '6 міс' },
      bullets: [
        { text: 'Medical equipment project — ASP.NET Core API, Angular front end.' },
        {
          text:
            'Unit and behaviour tests: XUnit and SpecFlow on the back end, ' +
            'Jest on the front.',
        },
      ],
      stack: ['ASP.NET Core', 'Angular', 'TypeScript', 'XUnit', 'SpecFlow', 'Jest'],
    },
  ],

  /*
   * `span` is the tile's width in tracks, and the tracks per row are fixed at
   * twelve — so these come in pairs that add up, and the split within a pair
   * says which of the two holds more.
   *
   * THE ORDER IS THE PAIRING, and the pairing is not arbitrary. Every tile has
   * to be wide enough for its chips to settle into two rows, and AWS and Azure
   * cannot both have that in the same row: Azure needs seven tracks for its
   * eight entries, AWS needs six before "Elastic Load Balancer" stops being
   * pushed onto a third line, and seven and six do not fit in twelve. So they
   * are dealt into different rows, each beside a partner that fits the
   * remainder — AWS with CI/CD, Azure with Data — and the rows come out
   * coherent anyway: two clouds-and-tooling, then the two language halves.
   *
   * Adding a tool is therefore not a free edit — the row has to give up the
   * tracks. `lib/cv` fails the build if one does not add up, because the
   * alternative is a hole in the mosaic at one width and nowhere else.
   */
  skills: [
    {
      area: 'AWS',
      span: 6,
      items: ['S3', 'EC2', 'RDS', 'Elastic Load Balancer', 'Route 53', 'CloudFormation'],
    },
    {
      area: 'CI/CD & IaC',
      span: 6,
      items: [
        'GitHub Actions',
        'Azure DevOps',
        'Jenkins',
        'Docker',
        'Terraform',
        'PowerShell',
      ],
    },
    {
      area: 'Azure',
      span: 7,
      items: [
        'Cosmos DB',
        'Application Insights',
        'Functions',
        'VMs',
        'Logic Apps',
        'Service Bus',
        'Application Gateway',
        'Alerts',
      ],
    },
    {
      area: 'Data',
      span: 5,
      items: ['MS SQL Server', 'PostgreSQL', 'MySQL', 'MongoDB'],
    },
    {
      area: 'Back end',
      span: 6,
      items: ['C#', 'ASP.NET', 'MVC', 'REST API', 'LINQ', 'Node.js', 'Express', 'XUnit'],
    },
    {
      area: 'Front end',
      span: 6,
      items: [
        'TypeScript',
        'Angular',
        'React',
        'MUI',
        'Angular Material',
        'Bootstrap',
        'Jest',
      ],
    },
  ],

  education: [
    {
      title: {
        en: "Master's, Information Systems and Technologies",
        uk: 'Магістр, Інформаційні системи та технології',
      },
      org: {
        en: 'Igor Sikorsky Kyiv Polytechnic Institute',
        uk: 'КПІ ім. Ігоря Сікорського',
      },
      from: { en: 'Sep 2023', uk: 'вер 2023' },
      to: { en: 'Jun 2024', uk: 'чер 2024' },
    },
    {
      title: {
        en: "Bachelor's, Information Systems and Technologies",
        uk: 'Бакалавр, Інформаційні системи та технології',
      },
      org: {
        en: 'Igor Sikorsky Kyiv Polytechnic Institute · 87.3 / 100',
        uk: 'КПІ ім. Ігоря Сікорського · 87,3 / 100',
      },
      from: { en: 'Sep 2019', uk: 'вер 2019' },
      to: { en: 'Jun 2023', uk: 'чер 2023' },
    },
  ],

  certifications: [
    {
      title: 'Docker, Kubernetes & OpenShift',
      org: 'IBM',
      when: { en: 'Jun 2024', uk: 'чер 2024' },
    },
    {
      title: 'AWS Cloud Technical Essentials',
      org: 'AWS',
      when: { en: 'Mar 2023', uk: 'бер 2023' },
    },
  ],

  languages: [
    { name: { en: 'Ukrainian', uk: 'Українська' }, level: { en: 'Native', uk: 'Рідна' } },
    {
      name: { en: 'English', uk: 'Англійська' },
      level: { en: 'Upper-Intermediate', uk: 'Вище середнього' },
    },
  ],

  /*
   * The LinkedIn profile photograph, re-hosted here like every other image on
   * the site — `npm run cv:portrait` puts it there and prints these fields.
   * Uploaded 2026-09-03 from the 800x800 original.
   */
  portrait: {
    publicId: 'profile/serhii-butko',
    width: 800,
    height: 800,
    version: 1788431779,
  },

  /*
   * The PDF. Absent, deliberately, and the download button is not rendered
   * while it is — see `resumeUrl` in lib/cv.
   *
   * `docs/cv-serhii-butko.pdf` IS uploaded and waiting. It cannot be linked
   * yet because this Cloudinary account has PDF and ZIP delivery switched off,
   * which is the default: every request for it returns 401 `deny or ACL
   * failure`. That is an account-wide security setting, not something an
   * upload can override —
   *
   *   Cloudinary console → Settings → Security → "PDF and ZIP files delivery"
   *
   * Flip it on, run `npm run cv:upload`, and paste what it prints:
   *
   *   resume: {
   *     publicId: 'docs/cv-serhii-butko.pdf',
   *     version: <the number it prints>,
   *   },
   *
   * The extension has to stay in the id. Without it Cloudinary serves the file
   * as application/octet-stream named `cv-serhii-butko`, which the visitor's
   * machine has no idea what to do with — and `fl_attachment` cannot supply a
   * name containing a dot, so there is no way to fix it at delivery time.
   */
} satisfies CvInput
