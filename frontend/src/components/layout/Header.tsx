import React, { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Compass,
  FileSearch,
  MessageSquare,
  Bell,
  Scale,
  User,
  LayoutDashboard,
  LogOut,
  LogIn,
  UserPlus,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cn } from "@/utils/cn";

export const Header: React.FC = () => {
  const { t } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch {
      // Ignore logout errors and redirect anyway
      navigate("/");
    }
  };

  const navLinks = [
    { to: "/", label: t("nav.home"), icon: Scale },
    { to: "/schemes", label: t("nav.explore"), icon: Compass },
    { to: "/analyze", label: t("nav.analyze"), icon: FileSearch },
    { to: "/assistant", label: t("nav.assistant"), icon: MessageSquare },
    { to: "/notifications", label: t("nav.notifications"), icon: Bell },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-paper-border shadow-editorial">
      {/* Top micro-bar for civic notice */}
      <div className="bg-neel text-paper-light text-[11px] py-1 px-4 text-center font-medium tracking-wide">
        🇮🇳 भारत सरकार की कल्याणकारी योजनाओं व परिपत्रों की निष्पक्ष, प्रामाणिक व सरल समझ
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-neel rounded"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded bg-neel text-white shadow-editorial group-hover:bg-neel-dark transition-colors">
              <Scale className="h-5 w-5 text-mustard" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg font-bold tracking-tight text-neel leading-none">
                लोक सेतु <span className="text-vermilion">|</span> Lok-Setu
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-neel-muted mt-1">
                Civic AI Platform
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(link.to);

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded text-xs lg:text-sm font-semibold transition-all select-none",
                    isActive
                      ? "bg-paper-dark text-vermilion font-bold border-b-2 border-vermilion"
                      : "text-neel hover:bg-paper hover:text-neel-dark"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Desktop Right Actions: Language Switcher + Auth Controls */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            <LanguageSwitcher />

            {isAuthenticated ? (
              <div className="flex items-center gap-2 pl-2 border-l border-paper-border">
                <Link
                  to="/dashboard"
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors",
                    location.pathname === "/dashboard"
                      ? "bg-neel text-white shadow-xs"
                      : "text-neel hover:bg-paper hover:text-neel-dark"
                  )}
                  title={t("nav.dashboard", "Citizen Desk")}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>{t("nav.dashboard", "Desk")}</span>
                </Link>

                <Link
                  to="/profile"
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors",
                    location.pathname === "/profile"
                      ? "bg-neel text-white shadow-xs"
                      : "text-neel hover:bg-paper hover:text-neel-dark"
                  )}
                  title={t("nav.profile", "Citizen Profile")}
                >
                  <User className="h-3.5 w-3.5" />
                  <span className="max-w-[100px] truncate">{user?.username || t("nav.profile", "Profile")}</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-neel-muted hover:text-vermilion hover:bg-vermilion/10 rounded transition-colors"
                  title={t("nav.logout", "Sign Out")}
                  aria-label={t("nav.logout", "Sign Out")}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-paper-border">
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-neel/20 text-xs font-semibold text-neel hover:bg-paper transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>{t("nav.signIn", "Sign In")}</span>
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-vermilion text-white text-xs font-semibold hover:bg-vermilion-dark transition-colors shadow-xs"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{t("nav.register", "Register")}</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu & Language Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-neel hover:bg-paper rounded transition-colors focus:outline-none focus:ring-2 focus:ring-neel"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-vermilion" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-paper-border bg-white animate-in slide-in-from-top-2 duration-150">
          <div className="px-4 pt-3 pb-5 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(link.to);

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-paper text-vermilion font-bold border-l-4 border-vermilion"
                      : "text-neel hover:bg-paper-light"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}

            {/* Mobile Auth Drawer Section */}
            <div className="pt-3 mt-3 border-t border-paper-border">
              {isAuthenticated ? (
                <div className="space-y-1">
                  <div className="px-3 py-1.5 text-xs text-neel-muted font-mono">
                    Citizen: <span className="font-semibold text-neel">{user?.username}</span>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded text-sm font-semibold text-neel hover:bg-paper"
                  >
                    <LayoutDashboard className="h-5 w-5 shrink-0 text-neel-light" />
                    <span>{t("nav.dashboard", "Citizen Desk")}</span>
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded text-sm font-semibold text-neel hover:bg-paper"
                  >
                    <User className="h-5 w-5 shrink-0 text-neel-light" />
                    <span>{t("nav.profile", "Citizen Profile")}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-semibold text-vermilion hover:bg-vermilion/10 text-left"
                  >
                    <LogOut className="h-5 w-5 shrink-0" />
                    <span>{t("nav.logout", "Sign Out")}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-neel/20 text-sm font-semibold text-neel hover:bg-paper text-center"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{t("nav.signIn", "Sign In")}</span>
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded bg-vermilion text-white text-sm font-semibold hover:bg-vermilion-dark text-center shadow-xs"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>{t("nav.register", "Register")}</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
