/**
 * Иконки приложения — Lucide, как в Nuxt UI (_docs-todo/REDESIGN_NUXT_UI.md).
 *
 * Экспортируются под именами иконок antd, которыми приложение пользовалось
 * раньше: шаблоны не менялись, поменялся только путь импорта. Каждая иконка
 * рисуется так же, как у antd, — `<span class="anticon">` с svg размером 1em
 * внутри. Поэтому размеры через font-size (styles/icon-styles.ts) и стили,
 * завязанные на `.anticon`, работают по-прежнему.
 *
 * Логотипов брендов в Lucide нет: WhatsApp, Twitter, Reddit и Facebook
 * по-прежнему берутся из @ant-design/icons-vue.
 */

import { h, type Component, type FunctionalComponent } from 'vue'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Ban,
  Bell,
  Blocks,
  Bookmark,
  Bug,
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
  Download,
  Ellipsis,
  EllipsisVertical,
  Expand,
  FileText,
  Flag,
  Gift,
  Globe,
  Hourglass,
  House,
  Image,
  Info,
  Key,
  LayoutGrid,
  Lightbulb,
  LoaderCircle,
  LogOut,
  Maximize,
  Megaphone,
  Menu,
  MessageCircle,
  MessagesSquare,
  Mic,
  Minimize,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Pencil,
  Play,
  Plus,
  QrCode,
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
  Trash2,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Undo2,
  Upload,
  User,
  UserMinus,
  UserPlus,
  Users,
  Volume2,
  Wallet,
  X,
  ZoomIn,
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

export const AppstoreOutlined = lucideIcon('AppstoreOutlined', LayoutGrid)
export const ArrowDownOutlined = lucideIcon('ArrowDownOutlined', ArrowDown)
export const ArrowUpOutlined = lucideIcon('ArrowUpOutlined', ArrowUp)
export const BellFilled = lucideIcon('BellFilled', Bell, 'solid')
export const BellOutlined = lucideIcon('BellOutlined', Bell)
export const BlockOutlined = lucideIcon('BlockOutlined', Blocks)
export const BookFilled = lucideIcon('BookFilled', Bookmark, 'solid')
export const BookOutlined = lucideIcon('BookOutlined', Bookmark)
export const BugOutlined = lucideIcon('BugOutlined', Bug)
export const BulbFilled = lucideIcon('BulbFilled', Lightbulb, 'soft')
export const BulbOutlined = lucideIcon('BulbOutlined', Lightbulb)
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
export const DeleteOutlined = lucideIcon('DeleteOutlined', Trash2)
export const DollarOutlined = lucideIcon('DollarOutlined', Coins)
export const DownloadOutlined = lucideIcon('DownloadOutlined', Download)
export const EditOutlined = lucideIcon('EditOutlined', Pencil)
export const EllipsisOutlined = lucideIcon('EllipsisOutlined', Ellipsis)
export const ExclamationCircleOutlined = lucideIcon('ExclamationCircleOutlined', CircleAlert)
export const ExpandOutlined = lucideIcon('ExpandOutlined', Expand)
export const FileTextOutlined = lucideIcon('FileTextOutlined', FileText)
export const FlagOutlined = lucideIcon('FlagOutlined', Flag)
export const FullscreenExitOutlined = lucideIcon('FullscreenExitOutlined', Minimize)
export const FullscreenOutlined = lucideIcon('FullscreenOutlined', Maximize)
export const GiftOutlined = lucideIcon('GiftOutlined', Gift)
export const GlobalOutlined = lucideIcon('GlobalOutlined', Globe)
export const HomeOutlined = lucideIcon('HomeOutlined', House)
export const HourglassOutlined = lucideIcon('HourglassOutlined', Hourglass)
export const InfoCircleOutlined = lucideIcon('InfoCircleOutlined', Info)
export const KeyOutlined = lucideIcon('KeyOutlined', Key)
export const LeftOutlined = lucideIcon('LeftOutlined', ChevronLeft)
export const LoadingOutlined = lucideIcon('LoadingOutlined', LoaderCircle, 'none', true)
export const LogoutOutlined = lucideIcon('LogoutOutlined', LogOut)
export const MenuFoldOutlined = lucideIcon('MenuFoldOutlined', PanelLeftClose)
export const MenuOutlined = lucideIcon('MenuOutlined', Menu)
export const MenuUnfoldOutlined = lucideIcon('MenuUnfoldOutlined', PanelLeftOpen)
export const MessageOutlined = lucideIcon('MessageOutlined', MessageCircle)
export const MoreOutlined = lucideIcon('MoreOutlined', EllipsisVertical)
export const NotificationOutlined = lucideIcon('NotificationOutlined', Megaphone)
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
export const SyncOutlined = lucideIcon('SyncOutlined', RefreshCw)
export const TeamOutlined = lucideIcon('TeamOutlined', Users)
export const TrophyFilled = lucideIcon('TrophyFilled', Trophy, 'soft')
export const UpOutlined = lucideIcon('UpOutlined', ChevronUp)
export const UploadOutlined = lucideIcon('UploadOutlined', Upload)
export const UserAddOutlined = lucideIcon('UserAddOutlined', UserPlus)
export const UserDeleteOutlined = lucideIcon('UserDeleteOutlined', UserMinus)
export const UserOutlined = lucideIcon('UserOutlined', User)
export const VideoCameraAddOutlined = lucideIcon('VideoCameraAddOutlined', Clapperboard)
export const WalletOutlined = lucideIcon('WalletOutlined', Wallet)
export const WarningFilled = lucideIcon('WarningFilled', TriangleAlert, 'soft')
export const WarningOutlined = lucideIcon('WarningOutlined', TriangleAlert)
export const ZoomInOutlined = lucideIcon('ZoomInOutlined', ZoomIn)

/** Мессенджер: раньше — svg-картинки, чёрные и в тёмной теме. */
export const ArrowLeftIcon = lucideIcon('ArrowLeftIcon', ArrowLeft)
export const MessagesIcon = lucideIcon('MessagesIcon', MessagesSquare)
export const MicIcon = lucideIcon('MicIcon', Mic)
export const PlayIcon = lucideIcon('PlayIcon', Play, 'solid')
export const PauseIcon = lucideIcon('PauseIcon', Pause, 'solid')

/** Переключатель темы — солнце и луна, как кнопка цветовой схемы у Nuxt UI. */
export const ThemeLightIcon = lucideIcon('ThemeLightIcon', Sun)
export const ThemeDarkIcon = lucideIcon('ThemeDarkIcon', Moon)
