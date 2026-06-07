/**
 * Контент инфо/легал-страниц (about / FAQ / help / terms / privacy / CSAE / support).
 *
 * Контент держим ЗДЕСЬ, а не в `src/locales/*` — длинные тексты раздули бы локали и
 * подпадали бы под parity-гейт. Заголовки страниц тоже здесь (футер берёт их отсюда).
 *
 * ⚠️ Terms / Privacy / CSAE — это **базовые шаблоны**, достаточные для подачи в стор,
 * но требующие финального юридического ревью проекта (`note: 'legalReview'`).
 */

export type InfoLocale = 'en' | 'ru'

export interface InfoSection {
  /** Подзаголовок секции (опционально). */
  heading?: string
  /** Абзацы текста. */
  paragraphs: string[]
}

export interface InfoPageContent {
  title: string
  /** Короткий подзаголовок под заголовком (опционально). */
  lead?: string
  sections: InfoSection[]
  /** Маркер «требует юр-ревью» — рендерим предупреждающей плашкой. */
  note?: 'legalReview'
}

/** Все инфо-страницы (для роутинга /info/:slug). */
export const INFO_PAGE_SLUGS = [
  'about',
  'faq',
  'help',
  'support',
  'terms',
  'privacy',
  'csae',
  'howtobuy',
] as const

export type InfoPageSlug = (typeof INFO_PAGE_SLUGS)[number]

/** Подмножество в футере (howtobuy линкуется из кошелька, а не из футера). */
export const FOOTER_PAGE_SLUGS: readonly InfoPageSlug[] = [
  'about',
  'faq',
  'help',
  'support',
  'terms',
  'privacy',
  'csae',
]

const EN: Record<InfoPageSlug, InfoPageContent> = {
  about: {
    title: 'About Bastyon',
    lead: 'A decentralized social network owned by its users.',
    sections: [
      {
        paragraphs: [
          'Bastyon is a peer-to-peer social network built on the PKOIN blockchain. There is no central company that owns your account or your content — you hold your own keys, and your posts and interactions live on a public, censorship-resistant network.',
        ],
      },
      {
        heading: 'How it works',
        paragraphs: [
          'Your identity is a cryptographic key pair derived from a recovery phrase that only you control. Posts, comments, votes and subscriptions are recorded on the blockchain. Videos are hosted on the PeerTube network and private messages go through an end-to-end encrypted channel.',
          'Because there is no central authority, no single party can silently delete your account, read your private messages, or sell your data.',
        ],
      },
    ],
  },
  faq: {
    title: 'Frequently asked questions',
    sections: [
      {
        heading: 'What is PKOIN?',
        paragraphs: [
          'PKOIN is the native coin of the network. It is used for on-chain actions such as boosting posts and tipping authors, and a small balance helps cover transaction fees.',
        ],
      },
      {
        heading: 'How do I sign in?',
        paragraphs: [
          'Your account is a 12-word recovery phrase (a mnemonic). There is no email or password and no central server — the phrase is your account. Anyone who has it controls the account, so store it offline and never share it.',
        ],
      },
      {
        heading: 'What happens if I lose my recovery phrase?',
        paragraphs: [
          'It cannot be recovered. Self-custody means there is no support line that can reset access for you. Back the phrase up securely before you start posting.',
        ],
      },
      {
        heading: 'Is it free?',
        paragraphs: [
          'Browsing and posting are free. Some actions consume tiny network fees and require a minimal balance, which protects the network from spam.',
        ],
      },
      {
        heading: 'Who moderates content?',
        paragraphs: [
          'Moderation is decentralized. You can block and report accounts, and node operators apply their own policies. Illegal content — in particular child sexual abuse material — is strictly prohibited everywhere on the network.',
        ],
      },
    ],
  },
  help: {
    title: 'Help & getting started',
    sections: [
      {
        heading: '1. Create your account',
        paragraphs: [
          'Generate a new account and write down your 12-word recovery phrase. Keep it offline (on paper or in a password manager) — it is the only way to restore access.',
        ],
      },
      {
        heading: '2. Make your first post',
        paragraphs: [
          'Open the composer to share text, images, video links and tags. You can also comment on and boost other people’s posts.',
        ],
      },
      {
        heading: '3. Use your wallet',
        paragraphs: [
          'Open the wallet to see your address and QR code for receiving PKOIN, send coins, and tip the authors you like.',
        ],
      },
      {
        heading: 'Need more help?',
        paragraphs: ['See the Support page for ways to report problems and reach the community.'],
      },
    ],
  },
  support: {
    title: 'Support',
    sections: [
      {
        heading: 'Get help',
        paragraphs: [
          'If something is not working, first check the Help and FAQ pages. The Diagnostics tab in Settings shows your app version and node status, which is useful when reporting an issue.',
        ],
      },
      {
        heading: 'Report a problem or abuse',
        paragraphs: [
          'Use the report and block controls available on posts and profiles to flag content or accounts. Reports help node operators and the community keep the network safe.',
          'To report child-safety violations, see the Child Safety page.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          'Reach the project and community through the official Bastyon channels. (Project: please publish your exact support email and community links here.)',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    note: 'legalReview',
    sections: [
      {
        heading: '1. Acceptance',
        paragraphs: [
          'By using this application you agree to these Terms of Use. If you do not agree, do not use the application.',
        ],
      },
      {
        heading: '2. Eligibility',
        paragraphs: [
          'You must be of legal age in your jurisdiction to use the application, and you are responsible for complying with all laws that apply to you.',
        ],
      },
      {
        heading: '3. Self-custody and your account',
        paragraphs: [
          'Your account is controlled solely by your recovery phrase and private keys. You are solely responsible for keeping them secure. Lost keys cannot be recovered by anyone, and transactions on the blockchain are irreversible.',
        ],
      },
      {
        heading: '4. Your content and conduct',
        paragraphs: [
          'You are responsible for the content you publish and confirm you have the right to publish it. You must not post illegal content, infringe others’ rights, or use the application to harm others. Content published to the blockchain is public and may be permanent and impossible to delete.',
        ],
      },
      {
        heading: '5. No warranty; limitation of liability',
        paragraphs: [
          'The application is provided “as is”, without warranties of any kind. To the maximum extent permitted by law, the developers are not liable for any loss arising from your use of the application, the network, or third-party services.',
        ],
      },
      {
        heading: '6. Changes',
        paragraphs: [
          'These terms may be updated from time to time. Continued use after changes constitutes acceptance of the updated terms.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    note: 'legalReview',
    sections: [
      {
        heading: 'Self-custody by design',
        paragraphs: [
          'The application does not operate a central account server and does not require an email, phone number, or password. We do not collect or sell your personal data through a central service.',
        ],
      },
      {
        heading: 'Public blockchain',
        paragraphs: [
          'Posts, comments, votes, subscriptions and transactions are recorded on a public blockchain. This information is visible to anyone and may be permanent and irreversible. Do not publish anything you need to keep private.',
        ],
      },
      {
        heading: 'Data on your device',
        paragraphs: [
          'Your keys, settings and caches are stored locally on your device. Clearing application data or losing the device without a backup of your recovery phrase means losing access to your account.',
        ],
      },
      {
        heading: 'Third-party services',
        paragraphs: [
          'Media is delivered through PeerTube nodes, private messaging runs over a Matrix homeserver, and an optional Tor mode routes traffic for additional privacy. These services have their own operators and policies.',
        ],
      },
    ],
  },
  csae: {
    title: 'Child Safety Standards (CSAE Policy)',
    note: 'legalReview',
    sections: [
      {
        heading: 'Zero tolerance',
        paragraphs: [
          'We have zero tolerance for child sexual abuse and exploitation (CSAE) and child sexual abuse material (CSAM). Any content that sexualizes, exploits, or endangers minors is strictly prohibited.',
        ],
      },
      {
        heading: 'Prohibited content and conduct',
        paragraphs: [
          'This includes, without limitation, CSAM, grooming, sextortion, trafficking, and any attempt to solicit or facilitate the abuse of a minor. Accounts engaging in such activity are prohibited from using the network.',
        ],
      },
      {
        heading: 'Reporting',
        paragraphs: [
          'Use the in-app report controls on any post or profile to flag suspected child-safety violations. Reports are prioritized for review and action.',
        ],
      },
      {
        heading: 'Cooperation with authorities',
        paragraphs: [
          'Confirmed CSAM is reported to the appropriate authorities, such as the National Center for Missing & Exploited Children (NCMEC) where applicable, and we cooperate with lawful requests from child-protection and law-enforcement agencies.',
        ],
      },
    ],
  },
  howtobuy: {
    title: 'How to get PKOIN',
    lead: 'PKOIN is the coin that powers actions on the network.',
    sections: [
      {
        heading: 'Why you need it',
        paragraphs: [
          'A small PKOIN balance covers network fees and unlocks actions like boosting posts and tipping authors. Browsing and posting basic content do not require a purchase.',
        ],
      },
      {
        heading: 'Earn it for free',
        paragraphs: [
          'You can receive PKOIN without buying: post good content and get upvotes, or ask someone to tip you. Share your address (Wallet → Receive) so others can send you coins.',
        ],
      },
      {
        heading: 'Buy on an exchange',
        paragraphs: [
          'PKOIN is listed on several cryptocurrency exchanges. Create an account on an exchange that lists PKOIN, buy the coins there, then withdraw them to your wallet address shown under Wallet → Receive.',
          'Always double-check the address before sending — blockchain transfers are irreversible.',
        ],
      },
      {
        heading: 'Receiving into your wallet',
        paragraphs: [
          'Open the Wallet, copy your address or show the QR code, and use it as the withdrawal/destination address. Funds appear after the network confirms the transaction.',
        ],
      },
    ],
  },
}

const RU: Record<InfoPageSlug, InfoPageContent> = {
  about: {
    title: 'О Bastyon',
    lead: 'Децентрализованная соцсеть, которой владеют её пользователи.',
    sections: [
      {
        paragraphs: [
          'Bastyon — это пиринговая социальная сеть на блокчейне PKOIN. Нет центральной компании, которой принадлежит ваш аккаунт или контент: ключи у вас, а ваши посты и действия живут в открытой, устойчивой к цензуре сети.',
        ],
      },
      {
        heading: 'Как это работает',
        paragraphs: [
          'Ваша личность — это криптографическая пара ключей, выводимая из мнемонической фразы, которой управляете только вы. Посты, комментарии, голоса и подписки записываются в блокчейн. Видео хранится в сети PeerTube, а личные сообщения идут по сквозьшифрованному каналу.',
          'Поскольку нет центральной власти, никто не может незаметно удалить ваш аккаунт, прочитать личные сообщения или продать ваши данные.',
        ],
      },
    ],
  },
  faq: {
    title: 'Частые вопросы',
    sections: [
      {
        heading: 'Что такое PKOIN?',
        paragraphs: [
          'PKOIN — нативная монета сети. Используется для ончейн-действий: бустов постов и чаевых авторам, а небольшой баланс покрывает комиссии за транзакции.',
        ],
      },
      {
        heading: 'Как войти?',
        paragraphs: [
          'Ваш аккаунт — это мнемоническая фраза из 12 слов. Нет ни почты, ни пароля, ни центрального сервера: фраза и есть аккаунт. Любой, у кого она есть, управляет аккаунтом — храните её офлайн и никому не передавайте.',
        ],
      },
      {
        heading: 'Что если я потеряю фразу?',
        paragraphs: [
          'Её нельзя восстановить. Самостоятельное хранение ключей означает, что нет поддержки, способной вернуть доступ. Сделайте надёжную резервную копию до того, как начнёте публиковать.',
        ],
      },
      {
        heading: 'Это бесплатно?',
        paragraphs: [
          'Просмотр и публикация бесплатны. Часть действий тратит крошечные сетевые комиссии и требует минимального баланса — это защищает сеть от спама.',
        ],
      },
      {
        heading: 'Кто модерирует контент?',
        paragraphs: [
          'Модерация децентрализована. Вы можете блокировать и жаловаться на аккаунты, а операторы нод применяют свои правила. Незаконный контент — в особенности материалы о сексуальном насилии над детьми — строго запрещён во всей сети.',
        ],
      },
    ],
  },
  help: {
    title: 'Помощь и начало работы',
    sections: [
      {
        heading: '1. Создайте аккаунт',
        paragraphs: [
          'Сгенерируйте новый аккаунт и запишите мнемоническую фразу из 12 слов. Храните её офлайн (на бумаге или в менеджере паролей) — это единственный способ восстановить доступ.',
        ],
      },
      {
        heading: '2. Сделайте первый пост',
        paragraphs: [
          'Откройте композер, чтобы поделиться текстом, картинками, ссылками на видео и тегами. Также можно комментировать и бустить чужие посты.',
        ],
      },
      {
        heading: '3. Пользуйтесь кошельком',
        paragraphs: [
          'Откройте кошелёк, чтобы увидеть свой адрес и QR-код для получения PKOIN, отправлять монеты и поддерживать авторов чаевыми.',
        ],
      },
      {
        heading: 'Нужна ещё помощь?',
        paragraphs: [
          'Загляните на страницу поддержки — там способы сообщить о проблеме и связаться с сообществом.',
        ],
      },
    ],
  },
  support: {
    title: 'Поддержка',
    sections: [
      {
        heading: 'Получить помощь',
        paragraphs: [
          'Если что-то не работает, сначала загляните в разделы «Помощь» и «Частые вопросы». Вкладка «Диагностика» в настройках показывает версию приложения и статус ноды — это пригодится при обращении.',
        ],
      },
      {
        heading: 'Сообщить о проблеме или нарушении',
        paragraphs: [
          'Используйте кнопки жалобы и блокировки на постах и профилях, чтобы отметить контент или аккаунты. Жалобы помогают операторам нод и сообществу поддерживать безопасность сети.',
          'Чтобы сообщить о нарушении безопасности детей, см. страницу «Безопасность детей».',
        ],
      },
      {
        heading: 'Контакты',
        paragraphs: [
          'Свяжитесь с проектом и сообществом через официальные каналы Bastyon. (Проекту: опубликуйте здесь точный email поддержки и ссылки на сообщество.)',
        ],
      },
    ],
  },
  terms: {
    title: 'Условия использования',
    note: 'legalReview',
    sections: [
      {
        heading: '1. Принятие условий',
        paragraphs: [
          'Используя приложение, вы соглашаетесь с настоящими Условиями использования. Если вы не согласны — не используйте приложение.',
        ],
      },
      {
        heading: '2. Право использования',
        paragraphs: [
          'Вы должны достичь совершеннолетия в своей юрисдикции, чтобы пользоваться приложением, и обязаны соблюдать все применимые к вам законы.',
        ],
      },
      {
        heading: '3. Самостоятельное хранение ключей и аккаунт',
        paragraphs: [
          'Ваш аккаунт контролируется исключительно вашей мнемонической фразой и приватными ключами. Вы несёте полную ответственность за их сохранность. Утерянные ключи никто не восстановит, а транзакции в блокчейне необратимы.',
        ],
      },
      {
        heading: '4. Ваш контент и поведение',
        paragraphs: [
          'Вы отвечаете за публикуемый контент и подтверждаете право на его публикацию. Запрещено публиковать незаконный контент, нарушать права других и использовать приложение во вред. Контент, опубликованный в блокчейне, публичен и может быть постоянным и неудаляемым.',
        ],
      },
      {
        heading: '5. Отказ от гарантий; ограничение ответственности',
        paragraphs: [
          'Приложение предоставляется «как есть», без каких-либо гарантий. В максимально допустимой законом мере разработчики не несут ответственности за любые убытки, возникшие из-за использования приложения, сети или сторонних сервисов.',
        ],
      },
      {
        heading: '6. Изменения',
        paragraphs: [
          'Эти условия могут время от времени обновляться. Продолжение использования после изменений означает согласие с обновлёнными условиями.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Политика конфиденциальности',
    note: 'legalReview',
    sections: [
      {
        heading: 'Приватность по дизайну',
        paragraphs: [
          'Приложение не использует центральный сервер аккаунтов и не требует почты, телефона или пароля. Мы не собираем и не продаём ваши персональные данные через центральный сервис.',
        ],
      },
      {
        heading: 'Публичный блокчейн',
        paragraphs: [
          'Посты, комментарии, голоса, подписки и транзакции записываются в публичный блокчейн. Эта информация видна всем и может быть постоянной и необратимой. Не публикуйте то, что должно остаться приватным.',
        ],
      },
      {
        heading: 'Данные на вашем устройстве',
        paragraphs: [
          'Ваши ключи, настройки и кэши хранятся локально на устройстве. Очистка данных приложения или потеря устройства без резервной копии фразы означает потерю доступа к аккаунту.',
        ],
      },
      {
        heading: 'Сторонние сервисы',
        paragraphs: [
          'Медиа доставляется через ноды PeerTube, личные сообщения идут через Matrix-homeserver, а опциональный режим Tor маршрутизирует трафик ради дополнительной приватности. У этих сервисов свои операторы и правила.',
        ],
      },
    ],
  },
  csae: {
    title: 'Стандарты безопасности детей (политика CSAE)',
    note: 'legalReview',
    sections: [
      {
        heading: 'Нулевая терпимость',
        paragraphs: [
          'Мы придерживаемся нулевой терпимости к сексуальному насилию и эксплуатации детей (CSAE) и материалам такого характера (CSAM). Любой контент, который сексуализирует, эксплуатирует или подвергает опасности несовершеннолетних, строго запрещён.',
        ],
      },
      {
        heading: 'Запрещённый контент и поведение',
        paragraphs: [
          'Сюда относятся, среди прочего, CSAM, груминг, секс-вымогательство, торговля людьми и любые попытки склонить к насилию над несовершеннолетним или способствовать ему. Аккаунтам, причастным к такой деятельности, запрещено пользоваться сетью.',
        ],
      },
      {
        heading: 'Жалобы',
        paragraphs: [
          'Используйте встроенные кнопки жалобы на любом посте или профиле, чтобы отметить предполагаемое нарушение безопасности детей. Такие жалобы рассматриваются в приоритетном порядке.',
        ],
      },
      {
        heading: 'Сотрудничество с органами',
        paragraphs: [
          'Подтверждённые материалы CSAM передаются в соответствующие органы — например, в NCMEC (где применимо) — и мы сотрудничаем с законными запросами организаций по защите детей и правоохранительных органов.',
        ],
      },
    ],
  },
  howtobuy: {
    title: 'Как получить PKOIN',
    lead: 'PKOIN — монета, на которой работают действия в сети.',
    sections: [
      {
        heading: 'Зачем она нужна',
        paragraphs: [
          'Небольшой баланс PKOIN покрывает сетевые комиссии и открывает действия — бусты постов и чаевые авторам. Просмотр и публикация базового контента покупки не требуют.',
        ],
      },
      {
        heading: 'Получить бесплатно',
        paragraphs: [
          'PKOIN можно получить и без покупки: публикуйте хороший контент и собирайте плюсы, или попросите кого-нибудь отправить вам чаевые. Поделитесь своим адресом (Кошелёк → Получить), чтобы вам могли перевести монеты.',
        ],
      },
      {
        heading: 'Купить на бирже',
        paragraphs: [
          'PKOIN торгуется на нескольких криптобиржах. Заведите аккаунт на бирже, где есть PKOIN, купите монеты и выведите их на адрес своего кошелька (Кошелёк → Получить).',
          'Всегда перепроверяйте адрес перед отправкой — переводы в блокчейне необратимы.',
        ],
      },
      {
        heading: 'Получение в кошелёк',
        paragraphs: [
          'Откройте Кошелёк, скопируйте адрес или покажите QR-код и используйте его как адрес вывода/назначения. Средства появятся после подтверждения транзакции сетью.',
        ],
      },
    ],
  },
}

const CONTENT: Record<InfoLocale, Record<InfoPageSlug, InfoPageContent>> = { en: EN, ru: RU }

export function isInfoPageSlug(slug: string): slug is InfoPageSlug {
  return (INFO_PAGE_SLUGS as readonly string[]).includes(slug)
}

/** Контент страницы для слуга и локали (фолбэк на en). `null` для неизвестного слуга. */
export function getInfoPage(slug: string, locale: string): InfoPageContent | null {
  if (!isInfoPageSlug(slug)) return null
  const loc: InfoLocale = locale === 'ru' ? 'ru' : 'en'
  return CONTENT[loc][slug]
}

/** Список (slug, title) для футера, в порядке FOOTER_PAGE_SLUGS. */
export function getInfoPageLinks(locale: string): { slug: InfoPageSlug; title: string }[] {
  const loc: InfoLocale = locale === 'ru' ? 'ru' : 'en'
  return FOOTER_PAGE_SLUGS.map((slug) => ({ slug, title: CONTENT[loc][slug].title }))
}
