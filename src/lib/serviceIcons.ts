/*
 * @name: Service Icons
 * @description: The icons that can be picked for a service in the admin panel. Stored in the database by key.
 * */

import { createElement } from "react";
import type { IconType } from "react-icons";
import {
  MdOutlinePhoneIphone, MdOutlineTabletMac, MdOutlineDevices, MdOutlineWeb, MdOutlineDesktopWindows,
  MdOutlineStorage, MdOutlineDns, MdOutlineCloud, MdOutlineApi, MdOutlineHub, MdOutlineIntegrationInstructions,
  MdOutlineDataObject, MdOutlineCode, MdOutlineTerminal, MdOutlineMemory, MdOutlineSecurity, MdOutlineLock,
  MdOutlineShoppingCart, MdOutlinePayments, MdOutlineReceiptLong, MdOutlineInventory2, MdOutlineAnalytics,
  MdOutlineDashboard, MdOutlineBrush, MdOutlinePalette, MdOutlineCameraAlt, MdOutlineSmartToy, MdOutlinePsychology,
  MdOutlineAutoAwesome, MdOutlineBuild, MdOutlineSettings, MdOutlineSync, MdOutlineSpeed, MdOutlineBugReport,
  MdOutlineRocketLaunch, MdOutlineEmail, MdOutlineChat, MdOutlineSearch, MdOutlineSupportAgent, MdOutlinePeople,
  MdOutlineSchool, MdOutlineHealthAndSafety, MdOutlineCalendarMonth, MdOutlineMap,
} from "react-icons/md";

export interface ServiceIcon {
  label: string;
  keywords: string;
  Icon: IconType;
}

export const SERVICE_ICONS: Record<string, ServiceIcon> = {
  phone: { label: "Mobile app", keywords: "phone iphone android ios flutter app mobile", Icon: MdOutlinePhoneIphone },
  tablet: { label: "Tablet", keywords: "ipad tablet app", Icon: MdOutlineTabletMac },
  devices: { label: "Cross-platform", keywords: "devices cross platform responsive multi", Icon: MdOutlineDevices },
  web: { label: "Website", keywords: "web website browser site page next react", Icon: MdOutlineWeb },
  desktop: { label: "Desktop app", keywords: "desktop windows computer pc native", Icon: MdOutlineDesktopWindows },
  database: { label: "Database", keywords: "database storage sql postgres mysql data backend", Icon: MdOutlineStorage },
  server: { label: "Server", keywords: "server dns hosting backend infrastructure", Icon: MdOutlineDns },
  cloud: { label: "Cloud & hosting", keywords: "cloud hosting deploy vps aws", Icon: MdOutlineCloud },
  api: { label: "API", keywords: "api rest grpc endpoint backend", Icon: MdOutlineApi },
  hub: { label: "Integrations", keywords: "hub integration connect plaid third party", Icon: MdOutlineHub },
  integration: { label: "Integration code", keywords: "integration instructions code connect", Icon: MdOutlineIntegrationInstructions },
  dataObject: { label: "Data / JSON", keywords: "data object json structure", Icon: MdOutlineDataObject },
  code: { label: "Code", keywords: "code programming development software", Icon: MdOutlineCode },
  terminal: { label: "Terminal / CLI", keywords: "terminal cli command line console tool", Icon: MdOutlineTerminal },
  chip: { label: "Native / C++", keywords: "chip memory cpu c++ cpp native performance embedded hardware", Icon: MdOutlineMemory },
  security: { label: "Security", keywords: "security shield protect gdpr", Icon: MdOutlineSecurity },
  lock: { label: "Authentication", keywords: "lock auth login password oauth jwt", Icon: MdOutlineLock },
  cart: { label: "E-commerce", keywords: "shop cart ecommerce store", Icon: MdOutlineShoppingCart },
  payments: { label: "Payments", keywords: "payments money card stripe finance", Icon: MdOutlinePayments },
  payroll: { label: "Payroll & invoices", keywords: "receipt payroll invoice wages finance", Icon: MdOutlineReceiptLong },
  inventory: { label: "Inventory", keywords: "inventory stock warehouse box", Icon: MdOutlineInventory2 },
  analytics: { label: "Analytics", keywords: "analytics chart reports statistics", Icon: MdOutlineAnalytics },
  dashboard: { label: "Dashboard", keywords: "dashboard admin panel management system", Icon: MdOutlineDashboard },
  design: { label: "Design", keywords: "design brush ui ux", Icon: MdOutlineBrush },
  palette: { label: "Branding", keywords: "palette colour color brand style", Icon: MdOutlinePalette },
  vision: { label: "Computer vision", keywords: "camera vision opencv image video detection", Icon: MdOutlineCameraAlt },
  ai: { label: "AI / LLM", keywords: "ai robot llm machine learning bot", Icon: MdOutlineSmartToy },
  brain: { label: "AI / ML", keywords: "psychology brain ai ml intelligence", Icon: MdOutlinePsychology },
  sparkle: { label: "Automation", keywords: "auto awesome magic automation sparkle", Icon: MdOutlineAutoAwesome },
  build: { label: "Build / tools", keywords: "build wrench tools maintenance", Icon: MdOutlineBuild },
  settings: { label: "Settings / config", keywords: "settings gear config setup", Icon: MdOutlineSettings },
  sync: { label: "Sync / offline", keywords: "sync offline refresh realtime", Icon: MdOutlineSync },
  speed: { label: "Performance", keywords: "speed fast performance optimisation optimization", Icon: MdOutlineSpeed },
  bug: { label: "Bug fixing", keywords: "bug debug fix testing", Icon: MdOutlineBugReport },
  rocket: { label: "Launch / MVP", keywords: "rocket launch startup mvp", Icon: MdOutlineRocketLaunch },
  email: { label: "Email", keywords: "email mail newsletter", Icon: MdOutlineEmail },
  chat: { label: "Chat / messaging", keywords: "chat message messaging", Icon: MdOutlineChat },
  search: { label: "SEO / search", keywords: "search seo find", Icon: MdOutlineSearch },
  support: { label: "Support", keywords: "support agent help maintenance", Icon: MdOutlineSupportAgent },
  people: { label: "Staff / HR", keywords: "people staff hr team users", Icon: MdOutlinePeople },
  school: { label: "Training", keywords: "school training education learning", Icon: MdOutlineSchool },
  health: { label: "Healthcare", keywords: "health safety medical nhs clinical", Icon: MdOutlineHealthAndSafety },
  calendar: { label: "Booking / scheduling", keywords: "calendar booking schedule rota", Icon: MdOutlineCalendarMonth },
  map: { label: "Maps / location", keywords: "map location gps tracking", Icon: MdOutlineMap },
};

export const DEFAULT_SERVICE_ICON = "code";

export function getServiceIcon(key: unknown): IconType {
  return (SERVICE_ICONS[String(key)] ?? SERVICE_ICONS[DEFAULT_SERVICE_ICON]).Icon;
}

// Renders the icon stored under `name`, falling back to the default icon
export function ServiceIconView({ name, className }: { name: unknown; className?: string }) {
  return createElement(getServiceIcon(name), { className });
}
