import {
  HiBrain,
  HiHeart,
  HiShieldExclamation,
  HiDatabase,
  HiClock,
  HiBeaker,
  HiChevronDown,
  HiSearch,
  HiArrowRight,
  HiUser,
  HiBookOpen,
  HiQuote,
  HiDocument,
  HiViewGrid,
  HiMenu,
  HiX,
  HiDownload,
  HiExternalLink,
  HiFilter,
} from "react-icons/hi";

// Mapping for category icons
export const getCategoryIcon = (iconName: string, className?: string) => {
  switch (iconName) {
    case "brain":
      return <HiBrain className={className || "text-xl"} />;
    case "heartbeat":
      return <HiHeart className={className || "text-xl"} />;
    case "shield-virus":
      return <HiShieldExclamation className={className || "text-xl"} />;
    case "dna":
      return <HiDatabase className={className || "text-xl"} />;
    case "hourglass-half":
      return <HiClock className={className || "text-xl"} />;
    case "flask":
      return <HiBeaker className={className || "text-xl"} />;
    default:
      return <HiBeaker className={className || "text-xl"} />;
  }
};

// Study metadata icons
export const StudyIcons = {
  Author: HiUser,
  Journal: HiBookOpen,
  Citations: HiQuote,
  FullText: HiDocument,
  Download: HiDownload,
  External: HiExternalLink,
};

// Navigation and UI icons
export const UIIcons = {
  Menu: HiMenu,
  Close: HiX,
  Search: HiSearch,
  ArrowRight: HiArrowRight,
  ChevronDown: HiChevronDown,
  ViewGrid: HiViewGrid,
  Filter: HiFilter,
};

export default {
  getCategoryIcon,
  StudyIcons,
  UIIcons,
};
