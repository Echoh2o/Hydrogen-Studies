/**
 * Login Page Component
 * Split-layout design with value proposition and authentication form
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  LogIn,
  User,
  Lock,
  AlertCircle,
  Droplets,
  BookOpen,
  Search,
  Heart,
  TrendingUp,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { Helmet } from "react-helmet";
import Footer from "@/components/layout/Footer";

// Form validation schema
const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

const getValueFeatures = (studyCount?: string) => [
  {
    icon: BookOpen,
    title: `${studyCount || "1,300+"} Research Studies`,
    description: "Access peer-reviewed hydrogen therapy research, summarized in plain language",
  },
  {
    icon: Heart,
    title: "Track Your Health Interests",
    description: "Save studies related to your health conditions and get personalized updates",
  },
  {
    icon: Search,
    title: "Smart Search & Discovery",
    description: "Find research by condition, body system, or keyword — all in everyday language",
  },
  {
    icon: TrendingUp,
    title: "New Research Alerts",
    description: "Stay informed as new hydrogen studies are published worldwide",
  },
];

export default function LoginPage() {
  const { data: siteStats } = useQuery<{ totalStudies: number }>({
    queryKey: ["/api/public-stats"],
    staleTime: 5 * 60 * 1000,
  });
  const VALUE_FEATURES = getValueFeatures(
    siteStats ? `${siteStats.totalStudies.toLocaleString()}+` : undefined,
  );
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [loginError, setLoginError] = useState<string>("");

  // Get redirect path from URL params or default to home (validated to prevent open redirect)
  const params = new URLSearchParams(location.split("?")[1] || "");
  const rawRedirect = params.get("redirect") || "/";
  const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  // Form setup
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      usernameOrEmail: "",
      password: "",
      rememberMe: false,
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return await response.json();
    },
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/auth/me"] }),
        queryClient.refetchQueries({ queryKey: ["/api/auth/check-session"] }),
      ]);

      toast({
        title: "Login successful",
        description: `Welcome back, ${response.user.username || response.user.email}!`,
      });

      navigate(redirectTo);
    },
    onError: (error: unknown) => {
      let errorMessage = "Login failed. Please try again.";
      if (error instanceof ApiError) {
        if (error.status === 429) {
          errorMessage =
            "Too many login attempts. Please wait a few minutes and try again.";
        } else if (error.status >= 500) {
          errorMessage = "Something went wrong on our end. Please try again.";
        } else {
          // 400 (validation), 401 (bad credentials), 403 (deactivated) —
          // the server's own message is both safe and informative here.
          errorMessage = error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setLoginError(errorMessage);
      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    setLoginError("");
    loginMutation.mutate(data);
  };

  return (
    <>
    <Helmet>
      <title>Login - Hydrogen Studies</title>
      <meta name="description" content="Sign in to your Hydrogen Studies account to save studies, track research, and access personalized features." />
    </Helmet>
    <div className="min-h-screen flex">
      {/* Left Panel — Value Proposition (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-600 via-teal-700 to-teal-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 mb-16">
            <Droplets className="h-10 w-10" />
            <div>
              <span className="text-2xl font-bold block">Hydrogen Studies</span>
              <span className="text-xs text-teal-200">powered by Echo Water</span>
            </div>
          </Link>

          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Your Personal
            <br />
            Research Library
          </h1>
          <p className="text-teal-100 text-lg mb-12 max-w-md">
            Understand the science behind hydrogen therapy with access to the
            world's largest collection of hydrogen research — explained for real people.
          </p>

          <div className="space-y-6">
            {VALUE_FEATURES.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4">
                <div className="bg-white/15 rounded-lg p-2.5 shrink-0">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">{feature.title}</h3>
                  <p className="text-teal-100 text-sm mt-0.5">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-12">
          <div className="flex items-center gap-3 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <Shield className="h-8 w-8 text-teal-200 shrink-0" />
            <div>
              <p className="text-sm font-medium">Free for Echo Water Customers</p>
              <p className="text-xs text-teal-200">
                Your purchase includes full access to Hydrogen Studies
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <Droplets className="h-8 w-8 text-teal-600" />
            <span className="text-xl font-bold">Hydrogen Studies</span>
          </div>

          <Card className="shadow-xl border-0 bg-white dark:bg-gray-800">
            <CardContent className="pt-8 pb-6 px-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Welcome Back</h2>
                <p className="text-muted-foreground mt-1">
                  Sign in to access your research dashboard
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {loginError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{loginError}</AlertDescription>
                    </Alert>
                  )}

                  <FormField
                    control={form.control}
                    name="usernameOrEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username or Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type="text"
                              placeholder="Enter username or email"
                              className="pl-10 h-11"
                              autoComplete="username"
                              data-testid="input-username-or-email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter password"
                              className="pl-10 h-11"
                              autoComplete="current-password"
                              data-testid="input-password"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-between">
                    <FormField
                      control={form.control}
                      name="rememberMe"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-remember-me"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-normal cursor-pointer">
                              Remember me
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <Link
                      href="/forgot-password"
                      className="text-sm text-teal-600 hover:underline"
                      data-testid="link-forgot-password"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary btn-full btn-icon-left"
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign In
                      </>
                    )}
                  </button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3 pb-8 px-8">
              <div className="text-sm text-center text-gray-600 dark:text-gray-400">
                Don't have an account?{" "}
                <Link
                  href="/register"
                  className="text-teal-600 font-semibold hover:underline"
                >
                  Create free account
                </Link>
              </div>
              <div className="text-xs text-center text-gray-500 dark:text-gray-500">
                By signing in, you agree to our{" "}
                <Link href="/terms" className="text-teal-600 hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-teal-600 hover:underline">
                  Privacy Policy
                </Link>
              </div>
            </CardFooter>
          </Card>

          {/* Mobile value proposition */}
          <div className="lg:hidden mt-8 space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">What you get with your free account</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {VALUE_FEATURES.map((feature) => (
                <div key={feature.title} className="flex items-start gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border">
                  <CheckCircle2 className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
                  <span className="text-xs font-medium">{feature.title}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              <span>Free for Echo Water customers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}
