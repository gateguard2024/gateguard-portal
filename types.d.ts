declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
  }
  export type Icon = FC<IconProps>;
  // Layout & Nav
  export const LayoutDashboard: Icon;
  export const ChevronRight: Icon;
  export const ChevronDown: Icon;
  export const Settings: Icon;
  export const Search: Icon;
  export const Bell: Icon;
  export const HelpCircle: Icon;
  export const Moon: Icon;
  export const Sun: Icon;
  export const Sparkles: Icon;
  export const ExternalLink: Icon;
  export const MoreHorizontal: Icon;
  export const Plus: Icon;
  export const Eye: Icon;
  export const Network: Icon;
  export const Radio: Icon;
  export const MessageSquare: Icon;
  // People
  export const Users: Icon;
  export const User: Icon;
  export const Building2: Icon;
  // Security
  export const Camera: Icon;
  export const Shield: Icon;
  export const Wifi: Icon;
  export const DoorOpen: Icon;
  export const Cpu: Icon;
  export const Zap: Icon;
  // Data
  export const TrendingUp: Icon;
  export const BarChart3: Icon;
  export const DollarSign: Icon;
  export const CreditCard: Icon;
  export const FileText: Icon;
  export const Archive: Icon;
  export const Download: Icon;
  export const Grid3X3: Icon;
  // Status
  export const AlertTriangle: Icon;
  export const CheckCircle2: Icon;
  export const XCircle: Icon;
  export const Clock: Icon;
  export const Calendar: Icon;
  // Field
  export const Wrench: Icon;
  export const MapPin: Icon;
  export const Phone: Icon;
  export const Mail: Icon;
  export const Send: Icon;
  export const Palette: Icon;
  // Quote tool additions
  export const ChevronLeft: Icon;
  export const ChevronUp: Icon;
  export const Check: Icon;
  export const Minus: Icon;
  export const Loader2: Icon;
  export const Copy: Icon;
  export const ArrowUpRight: Icon;
  export const Filter: Icon;
  export const RefreshCw: Icon;
  export const Trash2: Icon;
  export const Edit2: Icon;
  export const Link2: Icon;
  // CRM additions
  export const Hash: Icon;
  export const Circle: Icon;
  export const AlertCircle: Icon;
  export const ArrowRight: Icon;
  export const Paperclip: Icon;
  export const PhoneCall: Icon;
  export const Video: Icon;
  export const StickyNote: Icon;
  export const CheckSquare: Icon;
  export const Flame: Icon;
  export const LayoutGrid: Icon;
  export const List: Icon;
  export const SlidersHorizontal: Icon;
  export const Target: Icon;
  export const CheckCircle: Icon;
  export const TrendingDown: Icon;
  export const Pencil: Icon;
}
