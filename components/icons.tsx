"use client";

import {
  Award, Baby, Book, Briefcase, Bus, Car, Circle, CircleHelp, Coffee, CreditCard, Dumbbell, Ellipsis,
  Film, Fuel, Gamepad2, Gift, GraduationCap, HeartPulse, House, Landmark, Music, PawPrint, Percent,
  PiggyBank, Pill, Plane, Shield, Shirt, ShoppingCart, Smartphone, Sparkles, TrainFront, User,
  Utensils, Wallet, Wifi, Zap, type LucideIcon,
} from "lucide-react";
import { themedColor } from "@/lib/palette";
import { useIsDark } from "./useIsDark";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  coffee: Coffee,
  house: House,
  zap: Zap,
  wifi: Wifi,
  smartphone: Smartphone,
  bus: Bus,
  "train-front": TrainFront,
  car: Car,
  fuel: Fuel,
  "heart-pulse": HeartPulse,
  pill: Pill,
  user: User,
  shirt: Shirt,
  sparkles: Sparkles,
  dumbbell: Dumbbell,
  gift: Gift,
  "paw-print": PawPrint,
  baby: Baby,
  plane: Plane,
  film: Film,
  music: Music,
  "gamepad-2": Gamepad2,
  book: Book,
  "graduation-cap": GraduationCap,
  shield: Shield,
  "credit-card": CreditCard,
  landmark: Landmark,
  briefcase: Briefcase,
  award: Award,
  percent: Percent,
  wallet: Wallet,
  "piggy-bank": PiggyBank,
  ellipsis: Ellipsis,
  circle: Circle,
  "circle-help": CircleHelp,
};

export const ICON_NAMES = Object.keys(CATEGORY_ICONS).filter((n) => n !== "circle-help");

export function CategoryIcon({ name, className = "size-4" }: { name: string; className?: string }) {
  const Icon = CATEGORY_ICONS[name] ?? Circle;
  return <Icon className={className} aria-hidden />;
}

/** Цветная плашка с иконкой категории. */
export function CategoryBadgeIcon({ icon, color, size = "md" }: { icon: string; color: string; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "size-7 rounded-lg" : size === "lg" ? "size-11 rounded-xl" : "size-9 rounded-lg";
  const ico = size === "sm" ? "size-3.5" : size === "lg" ? "size-5" : "size-4";
  color = themedColor(color, useIsDark());
  return (
    <span
      className={`${box} inline-flex shrink-0 items-center justify-center`}
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <CategoryIcon name={icon} className={ico} />
    </span>
  );
}
