import React, { useState, useRef, useEffect } from "react";
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
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cn } from "@/utils/cn";

export const Header: React.FC = () => {
  const { t } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  // Close mobile drawer on route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch {
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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-paper-border/80 shadow-2xs">
      {/* Top micro-bar for civic mandate */}
      <div className="bg-neel text-paper-light text-[10.5px] py-1 px-4 text-center font-medium tracking-wide border-b border-neel-dark/30">
        🇮🇳 भारत सरकार की कल्याणकारी योजनाओं व परिपत्रों की निष्पक्ष, प्रामाणिक व सरल समझ
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15">
          {/* Brand Emblem & Identity */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-neel/20 rounded-lg py-1 px-1 -ml-1 transition-all"
            aria-label="Lok-Setu Home"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neel text-white shadow-xs group-hover:bg-neel-dark transition-all duration-200">
              <Scale className="h-4.5 w-4.5 text-mustard" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-[15px] sm:text-base font-bold tracking-tight text-neel leading-tight flex items-center gap-1.5">
                लोक सेतु <span className="text-vermilion text-xs font-sans font-normal opacity-70">|</span> Lok-Setu
              </span>
              <span className="text-[9px] uppercase font-bold tracking-widest text-neel-muted leading-tight mt-0.5">
                Civic AI Platform
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Bar (Centered Floating Pill Island) */}
          <nav
            className="hidden lg:flex items-center gap-1 bg-paper/60 p-1 rounded-full border border-paper-border/60 shadow-2xs"
            aria-label="Main Navigation"
          >
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
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 select-none",
                    isActive
                      ? "bg-neel text-white shadow-xs font-semibold"
                      : "text-neel-muted hover:text-neel hover:bg-white/80"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-colors",
                      isActive ? "text-mustard" : "text-neel-muted group-hover:text-neel"
                    )}
                  />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Desktop Right Actions: Language Switcher + User Account */}
          <div className="hidden md:flex items-center gap-2.5">
            <LanguageSwitcher />

            {isAuthenticated ? (
              <div className="flex items-center gap-2 pl-2 border-l border-paper-border/70">
                {/* Desk Quick Link */}
                <Link
                  to="/dashboard"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    location.pathname === "/dashboard"
                      ? "bg-neel/10 text-neel font-semibold"
                      : "text-neel-muted hover:text-neel hover:bg-paper-light"
                  )}
                  title={t("nav.dashboard", "Citizen Desk")}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">{t("nav.dashboard", "Citizen Desk")}</span>
                </Link>

                {/* User Dropdown */}
                <div ref={userMenuRef} className="relative inline-block text-left">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-paper-border/80 bg-white hover:bg-paper-light transition-all focus:outline-none focus:ring-2 focus:ring-neel/20 cursor-pointer shadow-2xs"
                    aria-haspopup="true"
                    aria-expanded={userMenuOpen}
                    aria-label="User account menu"
                  >
                    <div className="h-6 w-6 rounded-full bg-neel text-white text-[11px] font-bold flex items-center justify-center uppercase">
                      {user?.username ? user.username.charAt(0) : "U"}
                    </div>
                    <span className="text-xs font-medium text-neel max-w-[90px] truncate">
                      {user?.username || "Citizen"}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 text-neel-muted transition-transform duration-200",
                        userMenuOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {userMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-56 origin-top-right bg-white border border-paper-border rounded-xl shadow-editorial-lg py-1.5 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
                      role="menu"
                    >
                      <div className="px-3.5 py-2 border-b border-paper-border/70">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-neel truncate">{user?.username}</p>
                          <ShieldCheck className="h-3.5 w-3.5 text-sage-dark shrink-0" />
                        </div>
                        <p className="text-[10px] text-neel-muted truncate mt-0.5">
                          {user?.email || "Citizen Account"}
                        </p>
                      </div>

                      <div className="py-1">
                        <Link
                          to="/dashboard"
                          onClick={() => setUserMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors",
                            location.pathname === "/dashboard"
                              ? "bg-neel/5 font-semibold text-neel"
                              : "text-neel hover:bg-paper-light font-medium"
                          )}
                          role="menuitem"
                        >
                          <LayoutDashboard className="h-3.5 w-3.5 text-neel-muted" />
                          <span>{t("nav.dashboard", "Citizen Desk")}</span>
                        </Link>

                        <Link
                          to="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors",
                            location.pathname === "/profile"
                              ? "bg-neel/5 font-semibold text-neel"
                              : "text-neel hover:bg-paper-light font-medium"
                          )}
                          role="menuitem"
                        >
                          <User className="h-3.5 w-3.5 text-neel-muted" />
                          <span>{t("nav.profile", "Profile & Eligibility")}</span>
                        </Link>
                      </div>

                      <div className="border-t border-paper-border/70 pt-1 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            handleLogout();
                          }}
                          className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-vermilion hover:bg-vermilion/5 font-medium transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>{t("nav.logout", "Sign Out")}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-paper-border/70">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-medium text-neel hover:text-neel-dark hover:bg-paper-light rounded-full transition-colors"
                >
                  {t("nav.signIn", "Sign In")}
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-vermilion text-white text-xs font-semibold hover:bg-vermilion-hover transition-colors shadow-2xs"
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
              className="p-1.5 text-neel hover:bg-paper rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-neel/20 cursor-pointer"
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
        <div className="md:hidden border-t border-paper-border bg-white animate-in slide-in-from-top-2 duration-150 shadow-editorial-lg">
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
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-neel text-white font-semibold shadow-xs"
                      : "text-neel hover:bg-paper-light"
                  )}
                >
                  <Icon className={cn("h-4.5 w-4.5 shrink-0", isActive ? "text-mustard" : "text-neel-muted")} />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}

            {/* Mobile Auth Drawer Section */}
            <div className="pt-3 mt-3 border-t border-paper-border/80">
              {isAuthenticated ? (
                <div className="space-y-1">
                  <div className="px-3.5 py-2 rounded-lg bg-paper-light flex items-center justify-between text-xs text-neel-muted mb-2">
                    <span>Citizen: <strong className="font-semibold text-neel">{user?.username}</strong></span>
                    <ShieldCheck className="h-4 w-4 text-sage-dark" />
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-neel hover:bg-paper-light"
                  >
                    <LayoutDashboard className="h-4.5 w-4.5 shrink-0 text-neel-muted" />
                    <span>{t("nav.dashboard", "Citizen Desk")}</span>
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-neel hover:bg-paper-light"
                  >
                    <User className="h-4.5 w-4.5 shrink-0 text-neel-muted" />
                    <span>{t("nav.profile", "Profile & Eligibility")}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-vermilion hover:bg-vermilion/5 text-left cursor-pointer"
                  >
                    <LogOut className="h-4.5 w-4.5 shrink-0" />
                    <span>{t("nav.logout", "Sign Out")}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-full border border-neel/20 text-xs font-semibold text-neel hover:bg-paper-light text-center"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>{t("nav.signIn", "Sign In")}</span>
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-vermilion text-white text-xs font-semibold hover:bg-vermilion-hover text-center shadow-xs"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
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
