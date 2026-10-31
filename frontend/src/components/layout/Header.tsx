import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Scale,
  User,
  LayoutDashboard,
  LogOut,
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

  // Close mobile drawer and dropdown on route change
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
    { to: "/", label: t("nav.home") },
    { to: "/schemes", label: t("nav.explore") },
    { to: "/analyze", label: t("nav.analyze") },
    { to: "/assistant", label: t("nav.assistant") },
    { to: "/notifications", label: t("nav.notifications") },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80">
      {/* Top announcement ribbon */}
      <div className="bg-stone-900 text-stone-300 text-[11px] py-1 px-4 text-center font-normal tracking-wide flex items-center justify-center gap-2 border-b border-stone-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
        <span>भारत सरकार की कल्याणकारी योजनाओं व परिपत्रों की प्रामाणिक व निष्पक्ष समझ</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand Emblem & Name */}
          <Link
            to="/"
            className="flex items-center gap-2.5 shrink-0 focus:outline-none select-none py-1 group"
            aria-label="Lok-Setu Home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-stone-900 text-white shadow-xs group-hover:bg-stone-800 transition-colors">
              <Scale className="h-4 w-4 text-mustard" />
            </div>
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="font-serif text-lg font-bold tracking-tight text-stone-900">
                लोक सेतु
              </span>
              <span className="text-stone-300 font-light text-base">/</span>
              <span className="font-sans text-sm font-semibold tracking-tight text-stone-700">
                Lok-Setu
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            className="hidden lg:flex items-center gap-1 xl:gap-2 h-full"
            aria-label="Main Navigation"
          >
            {navLinks.map((link) => {
              const isActive =
                link.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(link.to);

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "relative h-14 flex items-center px-3 text-[13.5px] font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "text-stone-900 font-semibold after:absolute after:bottom-0 after:left-2.5 after:right-2.5 after:h-[2px] after:bg-stone-900 after:rounded-full"
                      : "text-stone-500 hover:text-stone-900 hover:bg-stone-50/80"
                  )}
                >
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Desktop Right Side: Language + Account */}
          <div className="hidden md:flex items-center gap-2.5">
            <LanguageSwitcher />

            <div className="h-4 w-[1px] bg-stone-200 mx-0.5" />

            {isAuthenticated ? (
              <div className="flex items-center">
                {/* User Dropdown */}
                <div ref={userMenuRef} className="relative inline-block text-left">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-md text-stone-700 hover:bg-stone-100/80 transition-colors focus:outline-none cursor-pointer"
                    aria-haspopup="true"
                    aria-expanded={userMenuOpen}
                    aria-label="User account menu"
                  >
                    <div className="h-6 w-6 rounded-full bg-stone-900 text-white text-[11px] font-semibold flex items-center justify-center uppercase">
                      {user?.username ? user.username.charAt(0) : "U"}
                    </div>
                    <span className="text-xs font-medium max-w-[90px] truncate text-stone-800">
                      {user?.username || "Citizen"}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 text-stone-400 transition-transform duration-200",
                        userMenuOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {userMenuOpen && (
                    <div
                      className="absolute right-0 mt-1.5 w-56 origin-top-right bg-white border border-stone-200 rounded-lg shadow-lg py-1.5 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
                      role="menu"
                    >
                      <div className="px-3.5 py-2 border-b border-stone-100">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-stone-900 truncate">{user?.username}</p>
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        </div>
                        <p className="text-[10.5px] text-stone-400 truncate mt-0.5">
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
                              ? "bg-stone-50 font-semibold text-stone-900"
                              : "text-stone-700 hover:bg-stone-50 font-normal"
                          )}
                          role="menuitem"
                        >
                          <LayoutDashboard className="h-3.5 w-3.5 text-stone-400" />
                          <span>{t("nav.dashboard", "Citizen Desk")}</span>
                        </Link>

                        <Link
                          to="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors",
                            location.pathname === "/profile"
                              ? "bg-stone-50 font-semibold text-stone-900"
                              : "text-stone-700 hover:bg-stone-50 font-normal"
                          )}
                          role="menuitem"
                        >
                          <User className="h-3.5 w-3.5 text-stone-400" />
                          <span>{t("nav.profile", "Profile & Eligibility")}</span>
                        </Link>
                      </div>

                      <div className="border-t border-stone-100 pt-1 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            handleLogout();
                          }}
                          className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-red-600 hover:bg-red-50/80 font-normal transition-colors text-left cursor-pointer"
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
              <div className="flex items-center gap-1.5">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
                >
                  {t("nav.signIn", "Sign In")}
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 text-xs font-medium bg-stone-900 hover:bg-stone-800 text-white rounded-md transition-colors shadow-2xs"
                >
                  {t("nav.register", "Register")}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu & Language Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-stone-700 hover:bg-stone-100 rounded-md transition-colors focus:outline-none cursor-pointer"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 text-stone-900" />
              ) : (
                <Menu className="h-5 w-5 text-stone-900" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white animate-in slide-in-from-top-1 duration-150 shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
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
                    "flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-stone-100 text-stone-900 font-semibold"
                      : "text-stone-600 hover:bg-stone-50"
                  )}
                >
                  <span>{link.label}</span>
                </NavLink>
              );
            })}

            {/* Mobile Auth Drawer Section */}
            <div className="pt-3 mt-2 border-t border-stone-100">
              {isAuthenticated ? (
                <div className="space-y-1">
                  <div className="px-3 py-1.5 text-xs text-stone-500 font-medium flex items-center justify-between">
                    <span>Citizen: <strong className="text-stone-900">{user?.username}</strong></span>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <LayoutDashboard className="h-4 w-4 text-stone-400" />
                    <span>{t("nav.dashboard", "Citizen Desk")}</span>
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <User className="h-4 w-4 text-stone-400" />
                    <span>{t("nav.profile", "Profile & Eligibility")}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 text-left cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{t("nav.logout", "Sign Out")}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center px-3 py-2 rounded-md border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 text-center"
                  >
                    <span>{t("nav.signIn", "Sign In")}</span>
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center px-3 py-2 rounded-md bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 text-center shadow-xs"
                  >
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
