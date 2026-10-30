import React, { useEffect, useState } from "react";
import { Bell, RefreshCw, Calendar, Building, ExternalLink } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { api } from "@/services/api";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";

interface NotificationItem {
  _id: string;
  title: string;
  documentType: string;
  jurisdictionLevel: string;
  applicableState: string;
  issuingAuthority: string;
  applicationDeadline?: string | null;
  officialPortalUrl?: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  totalCount: number;
  notifications: NotificationItem[];
}

export const NotificationsFeed: React.FC = () => {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<NotificationsResponse>("/notifications?days=7");
      setNotifications(data?.notifications || []);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load government notifications.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-paper-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-vermilion mb-1">
            <Bell className="h-4 w-4" />
            <span>Card 4 • 7-Day Live Feed</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl font-bold text-neel">
            {t("nav.notifications")}
          </h1>
          <p className="text-sm text-neel-muted max-w-xl">
            Recent gazette notices, circulars, and welfare policies issued by central and state authorities in the last 7 days.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchNotifications}
          disabled={loading}
          leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />}
        >
          {loading ? t("common.loading") : "Refresh Feed"}
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="error" title="Could not load notifications">
          {error}
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={fetchNotifications}>
              {t("common.retry")}
            </Button>
          </div>
        </Alert>
      )}

      {/* Loading Skeletons */}
      {loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-6 bg-white border border-paper-border rounded-md space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && notifications.length === 0 && (
        <EmptyState
          icon={<Bell className="h-7 w-7 text-neel-muted" />}
          title={t("empty.noNotifications")}
          description={t("empty.noNotificationsDesc")}
          action={
            <Button variant="primary" size="sm" onClick={fetchNotifications}>
              Refresh Feed
            </Button>
          }
        />
      )}

      {/* Notifications List */}
      {!loading && !error && notifications.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {notifications.map((item) => (
            <Card key={item._id} accent="sage" className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-neel-muted mb-2">
                  <span className="font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-paper-dark text-neel">
                    {item.jurisdictionLevel} • {item.applicableState}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <CardTitle className="text-lg mb-2">{item.title}</CardTitle>
                <CardDescription className="flex items-center gap-1.5 text-xs">
                  <Building className="h-3.5 w-3.5 text-neel-muted shrink-0" />
                  <span>{item.issuingAuthority}</span>
                </CardDescription>
              </div>

              <CardFooter className="pt-4">
                <span className="text-xs capitalize font-medium text-neel-muted">
                  Type: {item.documentType.replace("_", " ")}
                </span>
                {item.officialPortalUrl && (
                  <a
                    href={item.officialPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-vermilion hover:underline"
                  >
                    Official Portal <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
