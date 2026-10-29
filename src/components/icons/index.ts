/**
 * Иконки приложения — Lucide, как в Nuxt UI.
 *
 * Экспортируются под именами иконок antd, которыми приложение пользовалось
 * раньше: шаблоны не менялись, поменялся только путь импорта. Каждая иконка
 * рисуется так же, как у antd, — `<span class="anticon">` с svg размером 1em
 * внутри. Поэтому размеры через font-size (styles/icon-styles.ts) и стили,
 * завязанные на `.anticon`, работают по-прежнему.
 *
 * Логотипов брендов в Lucide нет: они в ./brands.ts, из Simple Icons.
 */

import { h, type Component, type FunctionalComponent } from 'vue'
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  AudioLines,
  Ban,
  Bell,
  BellOff,
  Blocks,
  Bluetooth,
  Bold,
  BookA,
  BookOpen,
  Bookmark,
  Bug,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CirclePause,
  CirclePlay,
  CircleQuestionMark,
  CircleX,
  Clapperboard,
  Clock,
  Code,
  Coins,
  Copy,
  Crown,
  Download,
  Ellipsis,
  EllipsisVertical,
  Expand,
  Eye,
  File,
  FileText,
  Flag,
  FoldHorizontal,
  Folder,
  Gift,
  Globe,
  Heading2,
  Heading3,
  Hourglass,
  House,
  Image,
  Inbox,
  Info,
  Italic,
  Key,
  LayoutGrid,
  Lightbulb,
  Link,
  List,
  ListOrdered,
  LoaderCircle,
  Lock,
  LogOut,
  Maximize,
  Megaphone,
  MegaphoneOff,
  Menu,
  MessageCircle,
  MessagesSquare,
  Mic,
  Minimize,
  Network,
  Minus,
  Monitor,
  Moon,
  OctagonAlert,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Pause,
  Pencil,
  Play,
  Plus,
  QrCode,
  RadioTower,
  RefreshCw,
  Repeat2,
  RotateCcw,
  RotateCw,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Smile,
  Star,
  Sun,
  TableOfContents,
  TextQuote,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Undo2,
  UnfoldHorizontal,
  Upload,
  Usb,
  User,
  UserMinus,
  UserPlus,
  Users,
  Volume2,
  Vote,
  Wallet,
  Wifi,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
  Scan,
  ChartColumn,
  Music,
  Rows3,
  GripVertical,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
  ListVideo,
  ListPlus,
  Library,
  ClockPlus,
  BookmarkPlus,
  BookmarkCheck,
  Headphones,
  Newspaper,
  HardDrive,
  SlidersHorizontal,
  Shapes,
  Hash,
} from '@lucide/vue'

/**
 * Заливка вместо antd-шных «Filled»:
 * - `solid` — сплошная, когда форма и есть состояние (звезда оценки,
 *   сохранённая закладка);
 * - `soft` — полупрозрачная, для значков статуса: сплошная закрыла бы галочку
 *   или восклицательный знак внутри.
 */
type Fill = 'none' | 'solid' | 'soft'

interface IconProps {
  /** Вращать (как `spin` у иконок antd). */
  spin?: boolean
}

const FILL_ATTRS: Record<Fill, Record<string, string | number>> = {
  none: {},
  solid: { fill: 'currentColor' },
  soft: { fill: 'currentColor', 'fill-opacity': 0.2 },
}

function lucideIcon(
  name: string,
  icon: Component,
  fill: Fill = 'none',
  alwaysSpin = false
): FunctionalComponent<IconProps> {
  const Wrapped: FunctionalComponent<IconProps> = (props, { attrs }) =>
    h(
      'span',
      {
        role: 'img',
        'aria-hidden': 'true',
        ...attrs,
        class: ['anticon', 'ui-icon', (alwaysSpin || props.spin) && 'ui-icon-spin', attrs.class],
      },
      [h(icon, { size: '1em', strokeWidth: 2, ...FILL_ATTRS[fill] })]
    )
  Wrapped.displayName = name
  Wrapped.props = ['spin']
  // Атрибуты (style, class, обработчики) навешиваются вручную на span.
  Wrapped.inheritAttrs = false
  return Wrapped
}

export const ApartmentOutlined = lucideIcon('ApartmentOutlined', Network)
export const AppstoreOutlined = lucideIcon('AppstoreOutlined', LayoutGrid)
export const ArrowDownOutlined = lucideIcon('ArrowDownOutlined', ArrowDown)
export const ArrowUpOutlined = lucideIcon('ArrowUpOutlined', ArrowUp)
export const BellFilled = lucideIcon('BellFilled', Bell, 'solid')
export const BellOutlined = lucideIcon('BellOutlined', Bell)
export const BellOffOutlined = lucideIcon('BellOffOutlined', BellOff)
export const BlockOutlined = lucideIcon('BlockOutlined', Blocks)
export const BookFilled = lucideIcon('BookFilled', Bookmark, 'solid')
export const BookOutlined = lucideIcon('BookOutlined', Bookmark)
export const BugOutlined = lucideIcon('BugOutlined', Bug)
export const BulbFilled = lucideIcon('BulbFilled', Lightbulb, 'soft')
export const BulbOutlined = lucideIcon('BulbOutlined', Lightbulb)
export const CalendarOutlined = lucideIcon('CalendarOutlined', Calendar)
export const CameraOutlined = lucideIcon('CameraOutlined', Camera)
export const CaretDownOutlined = lucideIcon('CaretDownOutlined', ChevronDown)
export const CaretUpOutlined = lucideIcon('CaretUpOutlined', ChevronUp)
export const CheckCircleFilled = lucideIcon('CheckCircleFilled', CircleCheck, 'soft')
export const CheckCircleOutlined = lucideIcon('CheckCircleOutlined', CircleCheck)
export const CheckOutlined = lucideIcon('CheckOutlined', Check)
export const ClockCircleOutlined = lucideIcon('ClockCircleOutlined', Clock)
export const CloseCircleOutlined = lucideIcon('CloseCircleOutlined', CircleX)
export const CloseOutlined = lucideIcon('CloseOutlined', X)
export const CodeOutlined = lucideIcon('CodeOutlined', Code)
export const CopyOutlined = lucideIcon('CopyOutlined', Copy)
export const CrownFilled = lucideIcon('CrownFilled', Crown, 'solid')
export const CrownOutlined = lucideIcon('CrownOutlined', Crown)
export const DeleteOutlined = lucideIcon('DeleteOutlined', Trash2)
export const DollarOutlined = lucideIcon('DollarOutlined', Coins)
export const DownloadOutlined = lucideIcon('DownloadOutlined', Download)
export const EditOutlined = lucideIcon('EditOutlined', Pencil)
export const EllipsisOutlined = lucideIcon('EllipsisOutlined', Ellipsis)
export const ExclamationCircleOutlined = lucideIcon('ExclamationCircleOutlined', CircleAlert)
export const ExpandOutlined = lucideIcon('ExpandOutlined', Expand)
export const FileOutlined = lucideIcon('FileOutlined', File)
export const FileTextOutlined = lucideIcon('FileTextOutlined', FileText)
export const FlagFilled = lucideIcon('FlagFilled', Flag, 'solid')
export const FlagOutlined = lucideIcon('FlagOutlined', Flag)
export const FolderOutlined = lucideIcon('FolderOutlined', Folder)
export const FullscreenExitOutlined = lucideIcon('FullscreenExitOutlined', Minimize)
export const FullscreenOutlined = lucideIcon('FullscreenOutlined', Maximize)
export const GiftOutlined = lucideIcon('GiftOutlined', Gift)
export const GlobalOutlined = lucideIcon('GlobalOutlined', Globe)
export const HomeOutlined = lucideIcon('HomeOutlined', House)
export const HourglassOutlined = lucideIcon('HourglassOutlined', Hourglass)
export const InboxOutlined = lucideIcon('InboxOutlined', Inbox)
export const InfoCircleOutlined = lucideIcon('InfoCircleOutlined', Info)
export const KeyOutlined = lucideIcon('KeyOutlined', Key)
export const LeftOutlined = lucideIcon('LeftOutlined', ChevronLeft)
export const LoadingOutlined = lucideIcon('LoadingOutlined', LoaderCircle, 'none', true)
export const LockOutlined = lucideIcon('LockOutlined', Lock)
export const LogoutOutlined = lucideIcon('LogoutOutlined', LogOut)
export const MenuFoldOutlined = lucideIcon('MenuFoldOutlined', PanelLeftClose)
export const MenuOutlined = lucideIcon('MenuOutlined', Menu)
export const MenuUnfoldOutlined = lucideIcon('MenuUnfoldOutlined', PanelLeftOpen)
export const MessageOutlined = lucideIcon('MessageOutlined', MessageCircle)
export const MoreOutlined = lucideIcon('MoreOutlined', EllipsisVertical)
export const NotificationOutlined = lucideIcon('NotificationOutlined', Megaphone)
export const PaperClipOutlined = lucideIcon('PaperClipOutlined', Paperclip)
export const PauseCircleOutlined = lucideIcon('PauseCircleOutlined', CirclePause)
export const PictureOutlined = lucideIcon('PictureOutlined', Image)
export const PlayCircleFilled = lucideIcon('PlayCircleFilled', CirclePlay, 'soft')
export const PlayCircleOutlined = lucideIcon('PlayCircleOutlined', CirclePlay)
export const PlusOutlined = lucideIcon('PlusOutlined', Plus)
export const QuestionCircleOutlined = lucideIcon('QuestionCircleOutlined', CircleQuestionMark)
export const QrcodeOutlined = lucideIcon('QrcodeOutlined', QrCode)
export const ReloadOutlined = lucideIcon('ReloadOutlined', RefreshCw)
export const RetweetOutlined = lucideIcon('RetweetOutlined', Repeat2)
export const RightOutlined = lucideIcon('RightOutlined', ChevronRight)
export const RiseOutlined = lucideIcon('RiseOutlined', TrendingUp)
export const RollbackOutlined = lucideIcon('RollbackOutlined', Undo2)
export const RotateLeftOutlined = lucideIcon('RotateLeftOutlined', RotateCcw)
export const RotateRightOutlined = lucideIcon('RotateRightOutlined', RotateCw)
export const SafetyCertificateFilled = lucideIcon('SafetyCertificateFilled', ShieldCheck, 'soft')
export const SafetyCertificateOutlined = lucideIcon('SafetyCertificateOutlined', ShieldCheck)
export const SafetyOutlined = lucideIcon('SafetyOutlined', Shield)
export const SearchOutlined = lucideIcon('SearchOutlined', Search)
export const SendOutlined = lucideIcon('SendOutlined', Send)
export const SettingOutlined = lucideIcon('SettingOutlined', Settings)
export const ShareAltOutlined = lucideIcon('ShareAltOutlined', Share2)
export const SmileOutlined = lucideIcon('SmileOutlined', Smile)
export const SoundOutlined = lucideIcon('SoundOutlined', Volume2)
export const StarFilled = lucideIcon('StarFilled', Star, 'solid')
export const StarOutlined = lucideIcon('StarOutlined', Star)
export const StopOutlined = lucideIcon('StopOutlined', Ban)
export const SwapOutlined = lucideIcon('SwapOutlined', ArrowLeftRight)
export const SyncOutlined = lucideIcon('SyncOutlined', RefreshCw)
export const TeamOutlined = lucideIcon('TeamOutlined', Users)
export const ThunderboltOutlined = lucideIcon('ThunderboltOutlined', Zap)
export const TrophyFilled = lucideIcon('TrophyFilled', Trophy, 'soft')
export const TrophyOutlined = lucideIcon('TrophyOutlined', Trophy)
export const UpOutlined = lucideIcon('UpOutlined', ChevronUp)
export const UploadOutlined = lucideIcon('UploadOutlined', Upload)
export const UserAddOutlined = lucideIcon('UserAddOutlined', UserPlus)
export const UserDeleteOutlined = lucideIcon('UserDeleteOutlined', UserMinus)
export const UserOutlined = lucideIcon('UserOutlined', User)
export const VideoCameraAddOutlined = lucideIcon('VideoCameraAddOutlined', Clapperboard)
export const PollIcon = lucideIcon('PollIcon', Vote)
export const WalletOutlined = lucideIcon('WalletOutlined', Wallet)
export const WarningFilled = lucideIcon('WarningFilled', TriangleAlert, 'soft')
export const WarningOutlined = lucideIcon('WarningOutlined', TriangleAlert)
export const ZoomInOutlined = lucideIcon('ZoomInOutlined', ZoomIn)
export const ZoomOutOutlined = lucideIcon('ZoomOutOutlined', ZoomOut)
/** Вписать в окно — схема сети целиком. */
export const FitViewIcon = lucideIcon('FitViewIcon', Scan)

/** Мессенджер: раньше — svg-картинки, чёрные и в тёмной теме. */
export const ArrowLeftIcon = lucideIcon('ArrowLeftIcon', ArrowLeft)
export const MessagesIcon = lucideIcon('MessagesIcon', MessagesSquare)
export const MicIcon = lucideIcon('MicIcon', Mic)
/** Голосовой ввод (диктовка текстом) — не путать с микрофоном голосового сообщения. */
export const DictationIcon = lucideIcon('DictationIcon', AudioLines)
export const PlayIcon = lucideIcon('PlayIcon', Play, 'solid')
export const PauseIcon = lucideIcon('PauseIcon', Pause, 'solid')

/** Справка: раздел и его книги, вкладки навигатора, ссылка на статью, плашки. */
export const HelpBookIcon = lucideIcon('HelpBookIcon', BookOpen)
export const HelpContentsIcon = lucideIcon('HelpContentsIcon', TableOfContents)
export const HelpIndexIcon = lucideIcon('HelpIndexIcon', BookA)
export const LinkIcon = lucideIcon('LinkIcon', Link)
export const MonitorIcon = lucideIcon('MonitorIcon', Monitor)
export const CautionIcon = lucideIcon('CautionIcon', OctagonAlert)
/** Канал в мессенджере: посты автора. */
export const MegaphoneIcon = lucideIcon('MegaphoneIcon', Megaphone)
export const MegaphoneOffIcon = lucideIcon('MegaphoneOffIcon', MegaphoneOff)
// Mesh-сети: радио и способы его подключения.
export const RadioTowerIcon = lucideIcon('RadioTowerIcon', RadioTower)
export const UsbIcon = lucideIcon('UsbIcon', Usb)
export const BluetoothIcon = lucideIcon('BluetoothIcon', Bluetooth)
export const WifiIcon = lucideIcon('WifiIcon', Wifi)

/** Переключатель темы — солнце и луна, как кнопка цветовой схемы у Nuxt UI. */
export const ThemeLightIcon = lucideIcon('ThemeLightIcon', Sun)
export const ThemeDarkIcon = lucideIcon('ThemeDarkIcon', Moon)
/** Ширина страницы: растянуть на весь экран / собрать колонкой. */
export const PageWidthFullIcon = lucideIcon('PageWidthFullIcon', UnfoldHorizontal)
export const PageWidthLimitedIcon = lucideIcon('PageWidthLimitedIcon', FoldHorizontal)

/** Шапка: «Назад» (ArrowLeftIcon) и «Вперёд» по страницам, как в браузере. */
export const ArrowRightIcon = lucideIcon('ArrowRightIcon', ArrowRight)

/** Редактор статьи: панель над выделением и меню блоков. */
export const BoldIcon = lucideIcon('BoldIcon', Bold)
export const ItalicIcon = lucideIcon('ItalicIcon', Italic)
export const Heading2Icon = lucideIcon('Heading2Icon', Heading2)
export const Heading3Icon = lucideIcon('Heading3Icon', Heading3)
export const QuoteIcon = lucideIcon('QuoteIcon', TextQuote)
export const ListIcon = lucideIcon('ListIcon', List)
export const ListOrderedIcon = lucideIcon('ListOrderedIcon', ListOrdered)
export const DividerIcon = lucideIcon('DividerIcon', Minus)

/** Окно поста: кто увидит пост. */
export const EyeOutlined = lucideIcon('EyeOutlined', Eye)

/** «Медиастудия»: вид списком, статистика ролика, пометка «аудио». */
export const ListViewIcon = lucideIcon('ListViewIcon', Rows3)
/** Ручка, за которую перетаскивают строку списка. */
export const DragHandleIcon = lucideIcon('DragHandleIcon', GripVertical)
export const StatsIcon = lucideIcon('StatsIcon', ChartColumn)
export const MusicIcon = lucideIcon('MusicIcon', Music)

/** Разделы «Видео» и «Аудио», мини-плеер, плейлисты. */
export const SkipBackIcon = lucideIcon('SkipBackIcon', SkipBack)
export const SkipForwardIcon = lucideIcon('SkipForwardIcon', SkipForward)
export const ShuffleIcon = lucideIcon('ShuffleIcon', Shuffle)
export const RepeatIcon = lucideIcon('RepeatIcon', Repeat)
export const RepeatOneIcon = lucideIcon('RepeatOneIcon', Repeat1)
export const AudioPlaylistIcon = lucideIcon('AudioPlaylistIcon', ListMusic)
export const VideoPlaylistIcon = lucideIcon('VideoPlaylistIcon', ListVideo)
export const AddToListIcon = lucideIcon('AddToListIcon', ListPlus)
export const CollectionIcon = lucideIcon('CollectionIcon', Library)
export const WatchLaterIcon = lucideIcon('WatchLaterIcon', ClockPlus)
export const SaveIcon = lucideIcon('SaveIcon', BookmarkPlus)
export const SavedIcon = lucideIcon('SavedIcon', BookmarkCheck)
export const HeadphonesIcon = lucideIcon('HeadphonesIcon', Headphones)
/** Вид ленты раздела «постами», как главная лента. */
export const PostsViewIcon = lucideIcon('PostsViewIcon', Newspaper)
/** Переписка, сохранённая на устройстве: сообщение есть только здесь. */
export const DeviceCopyIcon = lucideIcon('DeviceCopyIcon', HardDrive)

/** Блоки левой панели в «Шапке и панелях»: порядок и язык ленты, категории, теги. */
export const FeedSettingsIcon = lucideIcon('FeedSettingsIcon', SlidersHorizontal)
export const CategoriesIcon = lucideIcon('CategoriesIcon', Shapes)
export const HashtagIcon = lucideIcon('HashtagIcon', Hash)
