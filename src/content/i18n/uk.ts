import type { Dictionary } from '@/content/i18n/en'

// TODO(serhii): verify — drafted translations, please correct.
export const uk: Dictionary = {
  nav: {
    home: 'Головна',
    blog: 'Блог',
    photos: 'Фото',
    about: 'Про мене',
    cv: 'Резюме',
    projects: 'Проєкти',
    threads: 'Threads',
  },
  home: {
    latestLabel: 'Нове — парфумерія',
    moreWriting: 'Інші дописи',
    photos: 'Фото',
    photosSynced: 'синхронізовано з Telegram',
    collection: 'Колекція',
    bottles: 'флаконів у каталозі',
    postsWritten: 'написаних дописів',
    dayJob: 'Основна робота',
    dayJobTitle: 'DevOps-інженер',
    dayJobBody:
      'Хмарні платформи, CI/CD та інфраструктура як код. Резюме і проєкти — тут.',
    threads: 'З Threads',
    threadsAll: 'Усі дописи',
  },
  blog: {
    title: 'Блог',
    intro: 'Про парфумерію — реформуляції, будинки та люди за ними.',
  },
  photos: { title: 'Фото', intro: 'Дзеркало мого Telegram-каналу.' },
  threads: {
    title: 'Threads',
    intro: 'Коротші думки, дзеркало з Threads.',
    empty: 'Ще нічого не синхронізовано.',
    viewOnThreads: 'Переглянути у Threads',
    imageAlt: 'Фото з допису у Threads',
    syncedAt: 'синхронізовано',
  },
  about: { title: 'Про мене', intro: 'Хто я і як зі мною звʼязатися.' },
  cv: { title: 'Резюме', intro: 'Досвід, навички та освіта.' },
  projects: { title: 'Проєкти', intro: 'Те, що я створив.' },
  common: {
    placeholder: 'Ця сторінка — заготовка. Справжній вміст зʼявиться пізніше.',
    readingTime: 'хв читання',
    theme: 'Змінити тему',
    language: 'Мова',
    menu: 'Меню',
    notFoundTitle: 'Сторінку не знайдено',
    notFoundBody: 'Такої сторінки не існує. Можливо, її перенесли.',
    backHome: 'На головну',
  },
}
