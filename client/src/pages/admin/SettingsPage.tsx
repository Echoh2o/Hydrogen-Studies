import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings,
  Database,
  Mail,
  Shield,
  Globe,
  Bell,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

interface SiteSettings {
  siteTitle: string;
  siteDescription: string;
  emailNotifications: boolean;
  autoPublish: boolean;
  maintenanceMode: boolean;
  defaultLanguage: string;
  timezone: string;
}

interface Integrations {
  klaviyo: boolean;
  shopify: boolean;
  openai: boolean;
  sendgrid: boolean;
  googleAnalytics: boolean;
  database: boolean;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<SiteSettings | null>(null);

  const { data, isLoading, error } = useQuery<{
    settings: SiteSettings;
    integrations: Integrations;
  }>({
    queryKey: ["/api/admin/settings"],
    staleTime: 10 * 1000,
  });

  // Initialize local state from fetched data
  const settings = localSettings ?? data?.settings;
  const integrations = data?.integrations;

  const saveMutation = useMutation({
    mutationFn: (updates: Partial<SiteSettings>) =>
      apiRequest("PUT", "/api/admin/settings", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleChange = (key: keyof SiteSettings, value: any) => {
    setLocalSettings((prev) => ({
      ...(prev ?? data?.settings ?? ({} as SiteSettings)),
      [key]: value,
    }));
  };

  const handleSave = () => {
    if (settings) {
      saveMutation.mutate(settings);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Settings" description="Loading settings...">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !settings) {
    return (
      <AdminLayout title="Settings" description="Error loading settings">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">
              Failed to load settings. Please refresh the page.
            </p>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Settings"
      description="Configure your platform settings and preferences"
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure your platform settings and preferences
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Site Configuration
                </CardTitle>
                <CardDescription>
                  Basic site settings and branding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="siteTitle">Site Title</Label>
                    <Input
                      id="siteTitle"
                      value={settings.siteTitle}
                      onChange={(e) =>
                        handleChange("siteTitle", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultLanguage">Default Language</Label>
                    <Select
                      value={settings.defaultLanguage}
                      onValueChange={(value) =>
                        handleChange("defaultLanguage", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteDescription">Site Description</Label>
                  <Textarea
                    id="siteDescription"
                    value={settings.siteDescription}
                    onChange={(e) =>
                      handleChange("siteDescription", e.target.value)
                    }
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save General Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Content Management
                </CardTitle>
                <CardDescription>
                  Configure content publishing and management settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-publish Articles</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically publish new articles when created
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoPublish}
                    onCheckedChange={(checked) =>
                      handleChange("autoPublish", checked)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.timezone}
                    onValueChange={(value) =>
                      handleChange("timezone", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="EST">Eastern Time</SelectItem>
                      <SelectItem value="PST">Pacific Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Content Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Settings
                </CardTitle>
                <CardDescription>
                  Configure email notifications and alerts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email notifications for important events
                    </p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) =>
                      handleChange("emailNotifications", checked)
                    }
                  />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Notification Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Integration Status
                </CardTitle>
                <CardDescription>
                  Status of external service integrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {integrations ? (
                  <div className="grid gap-3">
                    {Object.entries(integrations).map(([key, configured]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <span className="font-medium capitalize">
                          {key === "googleAnalytics"
                            ? "Google Analytics"
                            : key === "openai"
                              ? "OpenAI"
                              : key}
                        </span>
                        {configured ? (
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-800"
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="mr-1 h-3 w-3" />
                            Not Configured
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Skeleton className="h-32 w-full" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  System Settings
                </CardTitle>
                <CardDescription>
                  System maintenance and operational settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable maintenance mode to restrict access during updates
                    </p>
                  </div>
                  <Switch
                    checked={settings.maintenanceMode}
                    onCheckedChange={(checked) =>
                      handleChange("maintenanceMode", checked)
                    }
                  />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save System Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
